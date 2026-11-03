# SDP-BESR Phase 3 — Multi-user access foundation

## Purpose
Separate authentication (who can sign in) from authorisation (what each user may do).

## Account policy
- New Supabase Auth accounts automatically receive a `pending` access record.
- Pending accounts must not enter the protected application.
- Existing `gps_platform_admins` members are backfilled as active `gps_admin` users.
- Existing GPS administrators are not silently elevated to super administrators.
- Self-registration is an account-request mechanism only; it does not grant access.
- Approval and role assignment must be handled by a trusted server-side administrator workflow.

## Roles
`super_admin`, `gps_admin`, `situation_room_admin`, `camera_admin`, `camera_operator`, `lga_coordinator`, `ward_officer`, `incident_verifier`, `evidence_officer`, `legal_officer`, `read_only`.

Accounts can be scoped to state, LGA, ward or polling unit.

## Database objects
- `public.sdp_user_access`: one access record per Auth user.
- `public.sdp_my_access()`: returns only the signed-in user's access profile.
- `public.sdp_handle_new_auth_user()`: creates a pending record for new Auth accounts.
- `sdp_auth_user_access_created`: Auth user creation trigger.

## Installation
1. Open the SDP-BESR Supabase Dashboard.
2. Open SQL Editor and create a new query.
3. Copy the SQL from `supabase/migrations/202611050001_sdp_multi_user_access.sql`.
4. Run it once.
5. Verify the table and function exist and existing GPS administrators are active `gps_admin` users.

## Security and limitations
- Never put the service-role key in browser code.
- Users must not assign their own role or approve their own account.
- Pending users are not authorised to enter the protected application.
- This is the database foundation only. The administrator Edge Function, login/request interface, module-level permission enforcement and row-level scope policies must be deployed and tested before operational use.
- Existing election and camera policies are not weakened by this migration.
- Preserve incident provenance and independent review; unverified reports must not be represented as established facts.

## Acceptance checks
- Existing GPS administrators have active `gps_admin` records.
- A new Auth user receives a `pending` record.
- Authenticated users can read only their own profile.
- Anonymous users cannot read access records.
- Pending users cannot enter the protected application.
