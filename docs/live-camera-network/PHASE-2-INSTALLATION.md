# Phase 2 installation — SDP-BESR camera network

## A. Database migration

1. Open the SDP-BESR Supabase project.
2. Open **SQL Editor → New Query**.
3. Open `supabase/migrations/202611040001_camera_phase2_integration.sql`.
4. Copy the entire file into SQL Editor and run it once.
5. Do not rerun edited fragments if an error occurs. Save the complete error and resolve it first.

The migration adds a foreign key from `camera_assignments.polling_unit_id` to `benue_polling_units.id` using `NOT VALID` then validates it. This is safe only when existing assignment rows reference real polling-unit UUIDs. If validation reports orphan rows, stop and inspect them; do not delete records or remove the constraint without review.

It also adds a partial unique index preventing one camera from having more than one active assignment.

## B. Deploy Edge Functions

Deploy these function folders from the project root using Supabase CLI or your established deployment workflow:

- `camera-device-register`
- `camera-admin-manage`
- `camera-assignment-manage`
- `camera-heartbeat`

The `_shared/camera-common.ts` file must be deployed with them.

Example CLI commands:

```bash
supabase functions deploy camera-device-register
supabase functions deploy camera-admin-manage
supabase functions deploy camera-assignment-manage
supabase functions deploy camera-heartbeat
```

If deploying through GitHub Actions, make sure the workflow deploys all four folders and includes the shared `_shared` module. Do not create or commit secrets in the repository.

## C. Function secrets

Set the following secrets in Supabase Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key must remain server-side. Never paste it into `index.html`, `web/camera-network-client.js`, a public repository file, or a user-facing message.

Supabase automatically supplies these environment variables in standard hosted Edge Functions; explicitly configure them only if your deployment setup requires it.

## D. Client integration

`web/camera-network-client.js` exports a small client helper. Load it as a module after the existing authenticated app has initialised `window.sdpSupabase`.

Example:

```html
<script type="module">
  import { createCameraNetworkClient } from "./web/camera-network-client.js";

  const cameraApi = createCameraNetworkClient(window.sdpSupabase);

  // Registration example:
  // const result = await cameraApi.register({
  //   device_name: "Field Phone 01",
  //   device_type: "mobile",
  //   connection_method: "webrtc_mobile"
  // });
</script>
```

Do not expose service-role credentials. The client helper uses the current Supabase user's access token and invokes Edge Functions.

## E. What is not enabled yet

This phase does not open the phone camera, publish a stream, issue LiveKit tokens, bridge RTSP, or create a public video wall. Those are later phases and require separate privacy, authorisation and infrastructure checks.
