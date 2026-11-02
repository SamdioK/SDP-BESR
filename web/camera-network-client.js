/**
 * SDP-BESR Phase 2 browser helper.
 * Requires an already-authenticated Supabase JS client.
 * Never place a service-role key in browser code.
 */
export function createCameraNetworkClient(supabase) {
  if (!supabase || typeof supabase.functions?.invoke !== "function") {
    throw new Error("An authenticated Supabase client is required");
  }

  async function invoke(name, body) {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      const message = error.message || `Request to ${name} failed`;
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  return Object.freeze({
    register: (input) => invoke("camera-device-register", input),
    manageCamera: (input) => invoke("camera-admin-manage", input),
    manageAssignment: (input) => invoke("camera-assignment-manage", input),
    heartbeat: (input) => invoke("camera-heartbeat", input),
  });
}
