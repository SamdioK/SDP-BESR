# Phase 2 verification and test plan

Use test accounts and test polling-unit assignments first.

## 1. Verify database integration

```sql
SELECT
  conname,
  convalidated,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.camera_assignments'::regclass
  AND conname = 'camera_assignments_polling_unit_id_fkey';

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'camera_assignments'
  AND indexname = 'uq_camera_one_active_assignment';
```

Expected: the foreign key exists and is validated; the unique partial index exists.

## 2. Registration tests

As an authenticated non-admin test user, invoke `camera-device-register`:

```json
{
  "device_name": "Test Android Phone",
  "device_type": "mobile",
  "connection_method": "webrtc_mobile"
}
```

Expected: HTTP 201, a device record with `device_status = pending`, and a generated device code.

Attempt an unauthenticated request. Expected: HTTP 401.

## 3. Administrator tests

As a GPS administrator, invoke `camera-admin-manage`:

```json
{
  "action": "approve",
  "camera_device_id": "UUID_FROM_REGISTRATION"
}
```

Expected: device status becomes `approved`, with `approved_by` and `approved_at` set.

Test `suspend` and `retire` only on disposable test records. A non-admin must receive HTTP 403.

## 4. Assignment tests

As a GPS administrator, invoke `camera-assignment-manage`:

```json
{
  "action": "create",
  "camera_device_id": "APPROVED_CAMERA_UUID",
  "polling_unit_id": "VERIFIED_BENUE_POLLING_UNIT_UUID",
  "assigned_user_id": "AUTHENTICATED_OPERATOR_UUID"
}
```

Expected: assignment is created as `pending`.

Then:

```json
{
  "action": "activate",
  "assignment_id": "ASSIGNMENT_UUID"
}
```

Expected: assignment becomes `active`, and the camera must be approved.

Try an unverified polling unit. Expected: HTTP 422.

Try activating a second assignment for the same camera while its first assignment is active. Expected: HTTP 409.

## 5. Heartbeat tests

As the operator assigned to the active camera:

```json
{
  "camera_device_id": "CAMERA_UUID",
  "assignment_id": "ACTIVE_ASSIGNMENT_UUID"
}
```

Expected: `last_seen_at` is updated and `last_connection_status = online`.

Try as a different authenticated user. Expected: HTTP 403.

## 6. Privacy and security checks

- No service-role key appears in browser files or network responses.
- No camera stream, image, audio or video is captured or transmitted by this phase.
- No camera is assigned to a polling unit unless its registry record is verified.
- No direct authenticated client write policy has been added to the camera tables.
- Keep cameras outside voting cubicles and away from ballot choices and voter personal information.
