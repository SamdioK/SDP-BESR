import {
  adminClient, authenticate, corsHeaders, jsonResponse, parseBody, requireGpsAdmin, isUuid,
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
    const cameraId = body.camera_device_id;
    if (!isUuid(cameraId)) return jsonResponse(422, { error: "camera_device_id must be a UUID" });
    if (!["approve", "suspend", "retire"].includes(String(action))) {
      return jsonResponse(422, { error: "action must be approve, suspend or retire" });
    }

    const { data: camera, error: readError } = await client
      .from("camera_devices")
      .select("id, device_status")
      .eq("id", cameraId)
      .maybeSingle();

    if (readError) throw new Error("Could not load camera device");
    if (!camera) return jsonResponse(404, { error: "Camera device not found" });
    if (action === "approve" && camera.device_status !== "pending") {
      return jsonResponse(409, { error: "Only pending devices can be approved" });
    }
    if (action === "suspend" && !["approved", "pending"].includes(camera.device_status)) {
      return jsonResponse(409, { error: "Only pending or approved devices can be suspended" });
    }
    if (action === "retire" && camera.device_status === "retired") {
      return jsonResponse(409, { error: "Camera is already retired" });
    }

    const nextStatus = action === "approve" ? "approved" : action === "suspend" ? "suspended" : "retired";
    const update: Record<string, unknown> = { device_status: nextStatus };
    if (action === "approve") {
      update.approved_by = auth.user.id;
      update.approved_at = new Date().toISOString();
    }

    const { data, error } = await client
      .from("camera_devices")
      .update(update)
      .eq("id", cameraId)
      .select("id, device_code, device_name, device_status, approved_by, approved_at, updated_at")
      .single();

    if (error) throw new Error("Could not update camera status");

    if (action !== "approve") {
      // Prevent a suspended/retired camera from remaining operationally assigned.
      const { error: assignmentError } = await client
        .from("camera_assignments")
        .update({ assignment_status: "suspended" })
        .eq("camera_device_id", cameraId)
        .eq("assignment_status", "active");
      if (assignmentError) throw new Error("Camera status changed but active assignment suspension failed; inspect assignments");
    }

    return jsonResponse(200, { success: true, camera: data });
  } catch (error) {
    console.error("camera-admin-manage error", error);
    return jsonResponse(400, { error: error instanceof Error ? error.message : "Request failed" });
  }
});
