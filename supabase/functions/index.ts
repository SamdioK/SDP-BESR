import {
  adminClient, authenticate, corsHeaders, jsonResponse, parseBody, requireGpsAdmin,
  isUuid,
} from "../_shared/camera-common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const auth = await authenticate(req);
    if ("error" in auth) return jsonResponse(auth.status, { error: auth.error });

    const client = adminClient();
    if (!(await requireGpsAdmin(client, auth.user.id))) {
      return jsonResponse(403, { error: "GPS administrator access required" });
    }

    const body = await parseBody(req);
    const action = body.action;

    if (action === "create") {
      if (!isUuid(body.camera_device_id) || !isUuid(body.polling_unit_id) || !isUuid(body.assigned_user_id)) {
        return jsonResponse(422, { error: "camera_device_id, polling_unit_id and assigned_user_id must be UUIDs" });
      }

      const { data: camera, error: cameraError } = await client
        .from("camera_devices")
        .select("id, device_status")
        .eq("id", body.camera_device_id)
        .maybeSingle();
      if (cameraError) throw new Error("Could not load camera");
      if (!camera) return jsonResponse(404, { error: "Camera not found" });
      if (camera.device_status !== "approved") {
        return jsonResponse(409, { error: "Only approved cameras can be assigned" });
      }

      const { data: pu, error: puError } = await client
        .from("benue_polling_units")
        .select("id, full_code, lga_name, ward_name, pu_name, verification_status")
        .eq("id", body.polling_unit_id)
        .eq("verification_status", "verified")
        .maybeSingle();
      if (puError) throw new Error("Could not verify polling unit");
      if (!pu) return jsonResponse(422, { error: "Polling unit not found or not verified" });

      const { data: operator, error: operatorError } = await client.auth.admin.getUserById(String(body.assigned_user_id));
      if (operatorError || !operator.user) return jsonResponse(422, { error: "Assigned operator account does not exist" });

      const { data, error } = await client
        .from("camera_assignments")
        .insert({
          camera_device_id: camera.id,
          polling_unit_id: pu.id,
          polling_unit_code: pu.full_code,
          polling_unit_name: pu.pu_name,
          ward_name: pu.ward_name,
          lga_name: pu.lga_name,
          assigned_user_id: operator.user.id,
          assignment_status: "pending",
          created_by: auth.user.id,
        })
        .select("*")
        .single();

      if (error) {
        console.error("assignment create failed", error.message);
        return jsonResponse(500, { error: "Could not create assignment" });
      }
      return jsonResponse(201, { success: true, assignment: data });
    }

    if (action === "activate" || action === "suspend" || action === "end") {
      if (!isUuid(body.assignment_id)) return jsonResponse(422, { error: "assignment_id must be a UUID" });
      const { data: assignment, error: readError } = await client
        .from("camera_assignments")
        .select("id, camera_device_id, assignment_status")
        .eq("id", body.assignment_id)
        .maybeSingle();
      if (readError) throw new Error("Could not load assignment");
      if (!assignment) return jsonResponse(404, { error: "Assignment not found" });

      if (action === "activate") {
        const { data: camera } = await client
          .from("camera_devices")
          .select("device_status")
          .eq("id", assignment.camera_device_id)
          .maybeSingle();
        if (!camera || camera.device_status !== "approved") {
          return jsonResponse(409, { error: "Camera must be approved before activation" });
        }
        const { data: pu } = await client
          .from("benue_polling_units")
          .select("id")
          .eq("id", (await client.from("camera_assignments").select("polling_unit_id").eq("id", assignment.id).single()).data?.polling_unit_id)
          .eq("verification_status", "verified")
          .maybeSingle();
        if (!pu) return jsonResponse(409, { error: "Polling unit is no longer verified" });
      }

      const next = action === "activate" ? "active" : action === "suspend" ? "suspended" : "ended";
      const update: Record<string, unknown> = { assignment_status: next };
      if (action === "activate") {
        update.approved_by = auth.user.id;
        update.approved_at = new Date().toISOString();
        update.starts_at = new Date().toISOString();
        update.ends_at = null;
      }
      if (action === "end") update.ends_at = new Date().toISOString();

      const { data, error } = await client
        .from("camera_assignments")
        .update(update)
        .eq("id", assignment.id)
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505") return jsonResponse(409, { error: "This camera already has another active assignment" });
        throw new Error("Could not update assignment");
      }
      return jsonResponse(200, { success: true, assignment: data });
    }

    return jsonResponse(422, { error: "action must be create, activate, suspend or end" });
  } catch (error) {
    console.error("camera-assignment-manage error", error);
    return jsonResponse(400, { error: error instanceof Error ? error.message : "Request failed" });
  }
});
