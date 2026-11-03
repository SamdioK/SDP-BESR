# SDP-BESR Live Camera Network — Phase 2 Functional Testing Page

**Repository:** `SamdioK/SDP-BESR`  
**Branch:** `main`  
**Scope:** Camera registration, GPS-admin approval, polling-unit assignment, operator heartbeat, and access-control checks.

## 1. Purpose

This page verifies the four deployed Phase 2 Supabase Edge Functions:

1. `camera-device-register`
2. `camera-admin-manage`
3. `camera-assignment-manage`
4. `camera-heartbeat`

Deployment success alone does not mean functional tests have passed. Record actual HTTP responses and database state.

## 2. Scope and safety

Phase 2 does **not** open a phone camera, capture/transmit video or audio, issue LiveKit tokens, connect RTSP cameras, record streams, or create a public video wall.

Use dedicated test accounts and a clearly labelled test device. Do not use an operational election camera or live assignment for destructive tests. Cameras must never be pointed at voting cubicles, ballot choices, voter accreditation details, or personal voter information.

## 3. Prepare test accounts and identifiers

Prepare:
- a valid Supabase Auth **non-admin test registrant**;
- a GPS administrator whose user UUID exists in `public.gps_platform_admins.user_id`;
- a valid Supabase Auth **test operator**;
- a verified polling-unit record in `public.benue_polling_units`.

Find verified test polling units in Supabase SQL Editor:

```sql
SELECT id, full_code, lga_name, ward_name, pu_name, verification_status
FROM public.benue_polling_units
WHERE verification_status = 'verified'
ORDER BY full_code
LIMIT 10;
```

Copy one returned `id` as `VERIFIED_POLLING_UNIT_UUID`.

Find user UUIDs in **Authentication → Users**. Confirm the GPS administrator membership:

```sql
SELECT user_id
FROM public.gps_platform_admins
WHERE user_id = 'GPS_ADMIN_USER_UUID';
```

Do not put access tokens, passwords, or service-role keys in GitHub, this document, or chat.

## 4. How to invoke a function

In the Supabase Dashboard for the SDP-BESR project:

1. Open **Edge Functions** and select the function.
2. Open its **Test** panel (label may vary).
3. Select `POST` and paste the JSON body from the relevant test.
4. For authenticated tests, include `Authorization: Bearer USER_ACCESS_TOKEN` for the correct test user if the panel does not attach a session automatically.
5. Send the request and record the HTTP status and response.
6. For unauthenticated tests, omit the Authorization header.

Use the access token of the relevant test user, never the service-role key as a user token.

## 5. Functional test sequence

Run tests in order. Keep returned UUIDs in a private test worksheet.

### Test 1 — Unauthenticated registration is rejected

Function: `camera-device-register`  
Authentication: none.

```json
{
  "device_name": "SDP-BESR TEST Android Phone",
  "device_type": "mobile",
  "connection_method": "webrtc_mobile"
}
```

Expected: HTTP `401`; missing bearer token; no camera row created.

### Test 2 — Authenticated registration succeeds

Function: `camera-device-register`  
Authentication: non-admin test registrant.

```json
{
  "device_name": "SDP-BESR TEST Android Phone",
  "device_type": "mobile",
  "connection_method": "webrtc_mobile"
}
```

Expected: HTTP `201`, `success: true`, a returned `camera.id`, generated `device_code`, and `device_status = pending`.

Record `camera.id` as `TEST_CAMERA_UUID`. The function derives owner/registrant from the authenticated user. Do not send `owner_user_id`, `registered_by`, `device_code`, or `device_status` from the client.

### Test 3 — Invalid device type is rejected

Function: `camera-device-register`; authentication: test registrant.

```json
{
  "device_name": "SDP-BESR TEST Invalid Device",
  "device_type": "drone",
  "connection_method": "webrtc_mobile"
}
```

Expected: HTTP `422`; device type must be `mobile` or `fixed`.

### Test 4 — Invalid connection method is rejected

Function: `camera-device-register`; authentication: test registrant.

```json
{
  "device_name": "SDP-BESR TEST Invalid Connection",
  "device_type": "mobile",
  "connection_method": "rtsp_gateway"
}
```

Expected: HTTP `422`; connection method is not valid for the device type.

### Test 5 — Non-admin cannot approve a camera

Function: `camera-admin-manage`; authentication: non-admin test registrant.

```json
{
  "action": "approve",
  "camera_device_id": "TEST_CAMERA_UUID"
}
```

Expected: HTTP `403`; GPS administrator access required; camera remains pending.

### Test 6 — GPS administrator approves the test camera

Function: `camera-admin-manage`; authentication: GPS administrator.

```json
{
  "action": "approve",
  "camera_device_id": "TEST_CAMERA_UUID"
}
```

Expected: HTTP `200`; `success: true`; `device_status = approved`; `approved_by` matches the admin UUID and `approved_at` is populated.

### Test 7 — GPS administrator creates an assignment

Function: `camera-assignment-manage`; authentication: GPS administrator.

```json
{
  "action": "create",
  "camera_device_id": "TEST_CAMERA_UUID",
  "polling_unit_id": "VERIFIED_POLLING_UNIT_UUID",
  "assigned_user_id": "TEST_OPERATOR_USER_UUID"
}
```

Expected: HTTP `201`; assignment has the test camera, verified polling unit, operator, and `assignment_status = pending`.

Record returned `assignment.id` as `TEST_ASSIGNMENT_UUID`.

### Test 8 — Unverified polling unit is rejected

Run only if a genuine unverified test record already exists and can be used without altering production data. Use the Test 7 body with that record's UUID.

Expected: HTTP `422`; polling unit not found or not verified; no assignment created. Do not change a real polling unit's verification status to manufacture this test.

### Test 9 — Activate the test assignment

Function: `camera-assignment-manage`; authentication: GPS administrator.

```json
{
  "action": "activate",
  "assignment_id": "TEST_ASSIGNMENT_UUID"
}
```

Expected: HTTP `200`; assignment becomes `active`; `approved_by`, `approved_at`, and `starts_at` are populated; `ends_at` is null. Camera must remain approved and polling unit verified.

### Test 10 — Second active assignment for the same camera is blocked

Only run with a separate disposable pending assignment for the same test camera. Do not alter an operational assignment. Attempt to activate the second assignment.

Expected: HTTP `409`; duplicate active assignment is rejected by the partial unique index `uq_camera_one_active_assignment`.

### Test 11 — Assigned operator heartbeat succeeds

Function: `camera-heartbeat`; authenticate as the exact operator assigned in Test 7.

```json
{
  "camera_device_id": "TEST_CAMERA_UUID",
  "assignment_id": "TEST_ASSIGNMENT_UUID"
}
```

Expected: HTTP `200`; `success: true`, `status = online`, and populated `last_seen_at`.

### Test 12 — Different user heartbeat is rejected

Function: `camera-heartbeat`; authenticate as a different user who is not assigned to the active assignment. Use the Test 11 body.

Expected: HTTP `403`; no active camera assignment for this operator.

### Test 13 — Invalid UUID is rejected

For each function, submit a malformed value for a required UUID field.

Expected: HTTP `422`; validation message; no database change.

## 6. Database verification

Run these read-only checks in SQL Editor.

### 6.1 Test cameras

```sql
SELECT
  id, device_code, device_name, device_type, connection_method,
  device_status, owner_user_id, registered_by,
  approved_by, approved_at, last_seen_at, last_connection_status
FROM public.camera_devices
WHERE device_name LIKE 'SDP-BESR TEST%';
```

### 6.2 Test assignments

```sql
SELECT
  id, camera_device_id, polling_unit_id, polling_unit_code,
  assigned_user_id, assignment_status, approved_by,
  approved_at, starts_at, ends_at
FROM public.camera_assignments
WHERE camera_device_id IN (
  SELECT id FROM public.camera_devices
  WHERE device_name LIKE 'SDP-BESR TEST%'
)
ORDER BY created_at DESC;
```

### 6.3 Unique index

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'camera_assignments'
  AND indexname = 'uq_camera_one_active_assignment';
```

Expected: a partial unique index on `camera_device_id` for rows whose status is `active`.

## 7. Security and privacy acceptance checklist

- [ ] Unauthenticated requests are rejected.
- [ ] Non-admins cannot approve, suspend, retire, or manage assignments.
- [ ] Only verified polling units can receive assignments.
- [ ] Only approved cameras can be assigned and activated.
- [ ] Only the assigned operator can send a heartbeat for an active assignment.
- [ ] A camera cannot have two active assignments.
- [ ] Service-role key is absent from browser files, HTML, GitHub files, and client responses.
- [ ] Camera tables have no permissive direct client-write policies.
- [ ] No video, image, audio, or stream was captured or transmitted during these tests.
- [ ] Test records are clearly distinguished from operational records.

## 8. Test result record

| Test | Actual HTTP status | Actual result | Pass/Fail | Notes |
|---|---:|---|---|---|
| 1. Unauthenticated registration | | | | |
| 2. Authenticated registration | | | | |
| 3. Invalid device type | | | | |
| 4. Invalid connection method | | | | |
| 5. Non-admin approval denied | | | | |
| 6. Admin approval | | | | |
| 7. Assignment creation | | | | |
| 8. Unverified polling unit denied | | | | |
| 9. Assignment activation | | | | |
| 10. Duplicate active assignment denied | | | | |
| 11. Assigned operator heartbeat | | | | |
| 12. Wrong operator heartbeat denied | | | | |
| 13. Invalid UUID validation | | | | |

## 9. Implementation observations

Watch these cases and stop if they occur:

1. Assignment activation performs a nested polling-unit lookup. If it returns an unexpected error, capture the response and function log; do not repeatedly activate or edit rows manually.
2. Camera suspension/retirement updates the camera before suspending active assignments. If the function reports that camera status changed but assignment suspension failed, inspect both records before proceeding.
3. Heartbeat updates timestamps for matching camera sessions in `requested`, `live`, or `reconnecting` states. This does not create or transmit a stream.

Report the exact response/log for any unexpected behaviour before continuing.

## 10. Test cleanup

Do not automatically delete test records. After approval, end or suspend the test assignment through the administrator function and retain the audit trail until the project lead approves cleanup. Never delete or alter polling-unit registry records as part of camera testing.

## 11. Phase 2 functional completion criteria

Mark functional testing complete only when applicable positive and negative tests pass, database state agrees with function responses, no secret is exposed, no video/audio transmission occurs, skipped tests are documented, and discovered defects are resolved or formally accepted before operational use.

**End of Phase 2 Functional Testing Page.**
