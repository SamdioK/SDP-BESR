# SDP-BESR Phase 3B — Multi-user access and approval

## Purpose
This phase adds controlled access requests, administrator review, account status checks and an access audit trail.

## User request workflow
1. User selects Request an account.
2. User supplies full name, email and a password of at least 10 characters.
3. Supabase Auth creates the account; the Phase 3 database trigger creates a pending `sdp_user_access` row.
4. The user cannot enter the operational workspace while pending.
5. An active GPS or super administrator reviews the request, selects a permitted role and geographical scope, and approves or suspends the account.
6. Approval, suspension and reinstatement are recorded in `sdp_access_audit`.

## Roles assignable through the request screen
Situation Room Admin, Camera Admin, Camera Operator, LGA Coordinator, Ward Officer, Incident Verifier, Evidence Officer, Legal Officer and Read Only.

GPS Admin and Super Admin cannot be assigned through this request screen.

## Security boundary
The full operational workspace remains limited to established GPS administrator/super-administrator access. Other approved users can authenticate and have their role and scope recorded, but are not yet admitted to operational modules. Each module must receive its own server-side authorisation and database RLS policies before it is opened to non-GPS roles. Hiding buttons in a browser is not a security boundary.

The `sdp_user_access` table is read-own only for ordinary authenticated users. Administrative changes are made by the Edge Function with the service-role key held server-side. Never place the service-role key in browser code.

## Training exercise
- Submit a request using a test email.
- Confirm a pending row appears in `sdp_user_access`.
- Sign in as GPS administrator and open User access management.
- Approve the test account with Read Only and Statewide scope.
- Confirm the audit row appears.
- Sign in as the test user and confirm the system reports approval but does not expose the operational workspace.
- Suspend the test account and confirm it cannot enter the workspace.

## Known limitations
- Module-level RLS for incidents, results, evidence, polling-unit reports and camera data is not implemented in this phase.
- Email delivery and confirmation behaviour depend on Supabase Auth settings.
- Invitations and password resets are separate work.
