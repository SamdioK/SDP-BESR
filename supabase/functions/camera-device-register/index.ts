import {
  adminClient, authenticate, corsHeaders, jsonResponse, parseBody, requiredText,
} from "../_shared/camera-common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const auth = await authenticate(req);
    if ("error" in auth) return jsonResponse(auth.status, { error: auth.error });

    const body = await parseBody(req);
    const deviceName = requiredText(body.device_name, "device_name", 100);
    const deviceType = body.device_type;
    const connectionMethod = body.connection_method;

    if (!["mobile", "fixed"].includes(String(deviceType))) {
      return jsonResponse(422, { error: "device_type must be mobile or fixed" });
    }
    const allowedMethods = deviceType === "mobile"
      ? ["webrtc_mobile", "usb_gateway"]
      : ["rtsp_gateway", "usb_gateway"];
    if (!allowedMethods.includes(String(connectionMethod))) {
      return jsonResponse(422, { error: "connection_method is not valid for this device type" });
    }

    // Do not accept owner_user_id, registered_by, device_code or status from clients.
    const client = adminClient();
    const deviceCode = `SDP-CAM-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const { data, error } = await client
      .from("camera_devices")
      .insert({
        device_code: deviceCode,
        device_name: deviceName,
        device_type: deviceType,
        connection_method: connectionMethod,
        device_status: "pending",
        owner_user_id: auth.user.id,
        registered_by: auth.user.id,
        metadata: {},
      })
      .select("id, device_code, device_name, device_type, connection_method, device_status, created_at")
      .single();

    if (error) {
      console.error("camera-device-register insert failed", error.message);
      return jsonResponse(500, { error: "Could not register camera device" });
    }
    return jsonResponse(201, { success: true, camera: data });
  } catch (error) {
    console.error("camera-device-register error", error);
    return jsonResponse(400, { error: error instanceof Error ? error.message : "Request failed" });
  }
});
