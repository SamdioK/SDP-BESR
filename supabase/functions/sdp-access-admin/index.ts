
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedRoles = [
  "situation_room_admin",
  "camera_admin",
  "camera_operator",
  "lga_coordinator",
  "ward_officer",
  "incident_verifier",
  "evidence_officer",
  "legal_officer",
  "read_only",
];

const allowedScopes = [
  "state",
  "lga",
  "ward",
  "polling_unit",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !anonKey || !serviceKey) {
      throw new Error("Server configuration incomplete.");
    }

    // Authenticate the requesting user.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!token || token === authHeader) {
      return json({ error: "Missing bearer token" }, 401);
    }

    const userClient = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await userClient.auth.getUser(token);

    if (authError || !authData.user) {
      return json({ error: "Unauthorised" }, 401);
    }

    // Server-side administrative client.
    const admin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const actorId = authData.user.id;

    const { data: actor, error: actorError } = await admin
      .from("sdp_user_access")
      .select("role,account_status")
      .eq("user_id", actorId)
      .maybeSingle();

    if (actorError) throw actorError;

    // Retain compatibility with the existing GPS administrator system.
    const legacy = await userClient.rpc("is_gps_admin");

    const isLegacyGpsAdmin =
      !legacy.error && legacy.data === true;

    const isPrivileged =
      actor?.account_status === "active" &&
      ["gps_admin", "super_admin"].includes(actor.role);

    if (!isPrivileged && !isLegacyGpsAdmin) {
      return json({
        error: "Only an active platform administrator can manage access.",
      }, 403);
    }

    const body = await req.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Invalid request body." }, 400);
    }

    const action = String(body.action || "");

    // LIST USERS
    if (action === "list") {
      const { data, error } = await admin
        .from("sdp_user_access")
        .select(
          "user_id,full_name,email,role,account_status,scope_type,scope_value,created_at"
        )
        .order("created_at", { ascending: true });

      if (error) throw error;

      return json({ users: data || [] });
    }

    // VALIDATE ACTION
    if (!["approve", "suspend", "reinstate"].includes(action)) {
      return json({ error: "Unsupported action." }, 400);
    }

    // VALIDATE TARGET USER
    const targetId = String(body.user_id || "");

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        targetId
      )
    ) {
      return json({ error: "A valid user_id is required." }, 400);
    }

    if (targetId === actorId && action !== "approve") {
      return json({
        error: "You cannot suspend or reinstate your own account.",
      }, 400);
    }

    const { data: target, error: targetError } = await admin
      .from("sdp_user_access")
      .select("role,account_status")
      .eq("user_id", targetId)
      .maybeSingle();

    if (targetError) throw targetError;

    if (!target) {
      return json({ error: "Access request not found." }, 404);
    }

    // APPROVE USER
    if (action === "approve") {
      const role = String(body.role || "");
      const scopeType = String(body.scope_type || "state");

      // Geographical values supplied by the dropdowns.
      // These are validated below against the database.
      const lgaName = String(body.lga_name || "").trim();
      const wardCode = String(body.ward_code || "").trim();
      const fullCode = String(body.full_code || "").trim();

      if (!allowedRoles.includes(role)) {
        return json({
          error:
            "Select a permitted role. GPS Admin and Super Admin cannot be assigned through this request screen.",
        }, 400);
      }

      if (!allowedScopes.includes(scopeType)) {
        return json({ error: "Invalid access scope." }, 400);
      }

      // This value is derived from verified database records.
      // Never trust body.scope_value for approval.
      let scopeValue: string | null = null;

      // STATEWIDE ACCESS
      if (scopeType === "state") {
        scopeValue = null;
      }

      // LGA ACCESS
      else if (scopeType === "lga") {
        if (!lgaName) {
          return json({ error: "Select an LGA." }, 400);
        }

        const { data, error } = await admin
          .from("benue_polling_units")
          .select("lga_name")
          .eq("verification_status", "verified")
          .eq("lga_name", lgaName)
          .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
          return json({
            error:
              "The selected LGA was not found in the verified Benue geographical directory.",
          }, 400);
        }

        scopeValue = lgaName;
      }

      // WARD ACCESS
      else if (scopeType === "ward") {
        if (!lgaName || !wardCode) {
          return json({
            error: "Select both an LGA and a ward.",
          }, 400);
        }

        const { data, error } = await admin
          .from("benue_polling_units")
          .select("lga_name,ward_code")
          .eq("verification_status", "verified")
          .eq("lga_name", lgaName)
          .eq("ward_code", wardCode)
          .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
          return json({
            error:
              "The selected ward does not belong to the selected LGA in the verified directory.",
          }, 400);
        }

        // Include LGA to prevent duplicate ward-code ambiguity.
        scopeValue = `${lgaName}|${wardCode}`;
      }

      // POLLING UNIT ACCESS
      else if (scopeType === "polling_unit") {
        if (!lgaName || !wardCode || !fullCode) {
          return json({
            error: "Select an LGA, ward and polling unit.",
          }, 400);
        }

        const { data, error } = await admin
          .from("benue_polling_units")
          .select("lga_name,ward_code,full_code")
          .eq("verification_status", "verified")
          .eq("lga_name", lgaName)
          .eq("ward_code", wardCode)
          .eq("full_code", fullCode)
          .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
          return json({
            error:
              "The selected polling unit does not match the selected LGA and ward in the verified directory.",
          }, 400);
        }

        scopeValue = fullCode;
      }

      // UPDATE USER ACCESS
      const { error: updateError } = await admin
        .from("sdp_user_access")
        .update({
          role,
          account_status: "active",
          scope_type: scopeType,
          scope_value: scopeValue,
          approved_by: actorId,
          approved_at: new Date().toISOString(),
        })
        .eq("user_id", targetId);

      if (updateError) throw updateError;

      // RECORD APPROVAL IN AUDIT LOG
      const { error: auditError } = await admin
        .from("sdp_access_audit")
        .insert({
          actor_user_id: actorId,
          target_user_id: targetId,
          action: "approved",
          old_role: target.role,
          new_role: role,
          old_status: target.account_status,
          new_status: "active",
          scope_type: scopeType,
          scope_value: scopeValue,
        });

      if (auditError) throw auditError;

      return json({
        success: true,
        message:
          "Account approved. Operational module access remains subject to module-level authorisation.",
      });
    }

    // PROTECT PLATFORM ADMINISTRATORS
    if (
      ["gps_admin", "super_admin"].includes(target.role) &&
      actor?.role !== "super_admin"
    ) {
      return json({
        error:
          "Only a super administrator may change another platform administrator's status.",
      }, 403);
    }

    // SUSPEND OR REINSTATE
    const nextStatus =
      action === "suspend" ? "suspended" : "active";

    const { error: updateError } = await admin
      .from("sdp_user_access")
      .update({
        account_status: nextStatus,
        ...(action === "reinstate"
          ? {
              approved_by: actorId,
              approved_at: new Date().toISOString(),
            }
          : {}),
      })
      .eq("user_id", targetId);

    if (updateError) throw updateError;

    // RECORD STATUS CHANGE IN AUDIT LOG
    const { error: auditError } = await admin
      .from("sdp_access_audit")
      .insert({
        actor_user_id: actorId,
        target_user_id: targetId,
        action:
          action === "suspend" ? "suspended" : "reinstated",
        old_role: target.role,
        new_role: target.role,
        old_status: target.account_status,
        new_status: nextStatus,
      });

    if (auditError) throw auditError;

    return json({
      success: true,
      message:
        action === "suspend"
          ? "Account suspended."
          : "Account reinstated.",
    });

  } catch (error) {
    console.error("sdp-access-admin:", error);

    return json({
      error: error?.message || "Unexpected server error.",
    }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
