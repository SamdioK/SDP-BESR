# Phase 1 installation and verification

## Apply the migration

Run the complete SQL migration in the Supabase SQL Editor. Do not rename the migration or change the existing `is_gps_admin()` function.

## Expected tables

1. `camera_devices`
2. `camera_assignments`
3. `camera_stream_sessions`
4. `camera_device_audit`
5. `camera_access_logs`
6. `camera_incidents`

## Verification

Run the two SQL verification queries in the package README. All six tables should exist and have Row Level Security enabled.

## If an error occurs

Copy the full Supabase error, including the line number, and provide it before making further changes. In particular, do not disable RLS to make the migration pass.
