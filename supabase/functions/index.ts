import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedRoles = [
  "situation_room_admin", "camera_admin", "camera_operator",
  "lga_coordinator", "ward_officer", "incident_verifier",
  "evidence_officer", "legal_officer", "read_only"
];
const allowedScopes = ["state", "lga", "ward", "polling_unit"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) throw new Error("Server configuration incomplete.");

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token === authHeader) return json({ error: "Missing bearer token" }, 401);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Unauthorised" }, 401);

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const actorId = authData.user.id;
    const { data: actor } = await admin
      .from("sdp_user_access")
      .select("role,account_status")
      .eq("user_id", actorId)
      .maybeSingle();

    const legacy = await userClient.rpc("is_gps_admin");
    const isLegacyGpsAdmin = !legacy.error && legacy.data === true;
    const isPrivileged = actor?.account_status === "active" &&
      ["gps_admin", "super_admin"].includes(actor.role);
    if (!isPrivileged && !isLegacyGpsAdmin) {
      return json({ error: "Only an active platform administrator can manage access." }, 403);
    }

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "list") {
      const { data, error } = await admin
        .from("sdp_user_access")
        .select("user_id,full_name,email,role,account_status,scope_type,scope_value,created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ users: data || [] });
    }

    if (!["approve", "suspend", "reinstate"].includes(action)) {
      return json({ error: "Unsupported action." }, 400);
    }

    const targetId = String(body.user_id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
      return json({ error: "A valid user_id is required." }, 400);
    }
    if (targetId === actorId && action !== "approve") {
      return json({ error: "You cannot suspend or reinstate your own account." }, 400);
    }

    const { data: target, error: targetError } = await admin
      .from("sdp_user_access")
      .select("role,account_status")
      .eq("user_id", targetId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return json({ error: "Access request not found." }, 404);

    if (action === "approve") {
      const role = String(body.role || "");
      const scopeType = String(body.scope_type || "state");
      const scopeValue = String(body.scope_value || "").trim();
      if (!allowedRoles.includes(role)) return json({ error: "Select a permitted role. GPS Admin and Super Admin cannot be assigned through this request screen." }, 400);
      if (!allowedScopes.includes(scopeType)) return json({ error: "Invalid access scope." }, 400);
      if (scopeType !== "state" && !scopeValue) return json({ error: "A scope value is required for LGA, ward or polling-unit access." }, 400);
      if (scopeType === "state" && scopeValue) return json({ error: "Statewide access must not include a scope value." }, 400);

      const { error } = await admin.from("sdp_user_access").update({
        role, account_status: "active", scope_type: scopeType,
        scope_value: scopeType === "state" ? null : scopeValue,
        approved_by: actorId, approved_at: new Date().toISOString()
      }).eq("user_id", targetId);
      if (error) throw error;
      const { error: auditError } = await admin.from("sdp_access_audit").insert({
        actor_user_id: actorId, target_user_id: targetId, action: "approved",
        old_role: target.role, new_role: role, old_status: target.account_status,
        new_status: "active", scope_type: scopeType,
        scope_value: scopeType === "state" ? null : scopeValue
      });
      if (auditError) throw auditError;
      return json({ success: true, message: "Account approved. Operational module access remains subject to module-level authorisation." });
    }

    if (["gps_admin", "super_admin"].includes(target.role) && actor?.role !== "super_admin") {
      return json({ error: "Only a super administrator may change another platform administrator's status." }, 403);
    }

    const nextStatus = action === "suspend" ? "suspended" : "active";
    const { error } = await admin.from("sdp_user_access").update({
      account_status: nextStatus,
      ...(action === "reinstate" ? { approved_by: actorId, approved_at: new Date().toISOString() } : {})
    }).eq("user_id", targetId);
    if (error) throw error;
    const { error: auditError } = await admin.from("sdp_access_audit").insert({
      actor_user_id: actorId, target_user_id: targetId,
      action: action === "suspend" ? "suspended" : "reinstated",
      old_role: target.role, new_role: target.role,
      old_status: target.account_status, new_status: nextStatus
    });
    if (auditError) throw auditError;
    return json({ success: true, message: action === "suspend" ? "Account suspended." : "Account reinstated." });
  } catch (error) {
    console.error("sdp-access-admin:", error);
    return json({ error: error?.message || "Unexpected server error." }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
