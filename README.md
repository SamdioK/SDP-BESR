# SDP-BESR Live Polling Unit Camera Network — Phase 2

## Scope

Phase 2 implements secure mobile/fixed camera registration, GPS-admin approval, verified polling-unit assignment and operator heartbeat/status updates.

It builds on the successfully installed Phase 1 tables. It does **not** start or transmit video, create LiveKit rooms, accept RTSP credentials, record audio, or store video.

## Confirmed integration facts

The existing polling-unit registry is `public.benue_polling_units`:

- Primary key: `id uuid`
- Unique official key: `full_code text`
- Location fields: `lga_code`, `lga_name`, `ward_code`, `ward_name`, `pu_code`, `pu_name`, `pu_location`
- Verification field: `verification_status`
- Only records with `verification_status = 'verified'` are eligible for camera assignment.

GPS administrators are identified by `public.gps_platform_admins.user_id = auth.uid()`, through the existing `public.is_gps_admin()` function.

## Package contents

- `supabase/migrations/202611040001_camera_phase2_integration.sql`
- `supabase/functions/_shared/camera-common.ts`
- `supabase/functions/camera-device-register/index.ts`
- `supabase/functions/camera-admin-manage/index.ts`
- `supabase/functions/camera-assignment-manage/index.ts`
- `supabase/functions/camera-heartbeat/index.ts`
- `web/camera-network-client.js`
- `docs/PHASE-2-INSTALLATION.md`
- `docs/PHASE-2-TESTING.md`

## Deployment order

1. Back up the SDP-BESR Supabase project.
2. Run the Phase 2 SQL migration once in Supabase SQL Editor.
3. Deploy the four Edge Functions.
4. Set each function's Supabase URL and service-role environment variables using Supabase secrets. Do not put the service-role key in browser code or GitHub.
5. Test using the testing guide.
6. Integrate `web/camera-network-client.js` into the authenticated SDP-BESR application only after the API tests pass.

## Security and operating boundaries

- Only authenticated users may submit a camera registration; every registration starts as `pending`.
- Only GPS administrators can approve/suspend/retire cameras and create/activate/reassign/end assignments.
- Only verified rows in the existing polling-unit registry can be assigned.
- Only the operator named on an active assignment can send its heartbeat.
- Direct browser database writes are not introduced; mutations go through authenticated Edge Functions.
- No face recognition, voter identification, biometric processing, audio capture, ballot-choice capture, or filming inside voting cubicles.
- Camera placement and use must be authorised and compliant with INEC rules and applicable privacy law.
- An incident report or camera feed is not, by itself, proof of an election result or a verified allegation.

## Important

This package is designed for the confirmed Phase 1 schema described in the user's successful installation. It intentionally does not modify `index.html` automatically because the current authentication/navigation integration points must be reviewed before inserting production UI.
