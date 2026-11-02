import {
  adminClient, authenticate, corsHeaders, jsonResponse, parseBody, isUuid,
} from "../_shared/camera-common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const auth = await authenticate(req);
    if ("error" in auth) return jsonResponse(auth.status, { error: auth.error });

    const body = await parseBody(req);
    if (!isUuid(body.camera_device_id) || !isUuid(body.assignment_id)) {
      return jsonResponse(422, { error: "camera_device_id and assignment_id must be UUIDs" });
    }

    const client = adminClient();
    const { data: assignment, error: assignmentError } = await client
      .from("camera_assignments")
      .select("id, camera_device_id, assigned_user_id, assignment_status")
      .eq("id", body.assignment_id)
      .maybeSingle();

    if (assignmentError) throw new Error("Could not validate camera assignment");
    if (!assignment || assignment.camera_device_id !== body.camera_device_id ||
        assignment.assigned_user_id !== auth.user.id ||
        assignment.assignment_status !== "active") {
      return jsonResponse(403, { error: "No active camera assignment for this operator" });
    }

    const { data: camera, error: cameraError } = await client
      .from("camera_devices")
      .select("id, device_status")
      .eq("id", body.camera_device_id)
      .maybeSingle();

    if (cameraError) throw new Error("Could not validate camera device");
    if (!camera || camera.device_status !== "approved") {
      return jsonResponse(403, { error: "Camera is not approved for operation" });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await client
      .from("camera_devices")
      .update({ last_seen_at: now, last_connection_status: "online" })
      .eq("id", camera.id);
    if (updateError) throw new Error("Could not update camera heartbeat");

    const { error: sessionError } = await client
      .from("camera_stream_sessions")
      .update({ last_heartbeat_at: now })
      .eq("camera_device_id", camera.id)
      .in("session_status", ["requested", "live", "reconnecting"]);
    if (sessionError) throw new Error("Heartbeat saved but stream-session heartbeat update failed");

    return jsonResponse(200, { success: true, status: "online", last_seen_at: now });
  } catch (error) {
    console.error("camera-heartbeat error", error);
    return jsonResponse(400, { error: error instanceof Error ? error.message : "Request failed" });
  }
});
