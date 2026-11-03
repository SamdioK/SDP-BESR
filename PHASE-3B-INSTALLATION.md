# SDP-BESR Phase 3B installation

## Included files
- `supabase/migrations/202611060001_sdp_access_audit.sql`
- `supabase/functions/sdp-access-admin/index.ts`
- `web/access-control.js`
- `.github/workflows/deploy-sdp-access-admin.yml`
- `docs/access-control/PHASE-3B-OPERATIONS.md`

## Step 1 — Upload files
Upload all included folders/files to the root of `SamdioK/SDP-BESR` on the `main` branch. Do not overwrite existing migrations.

## Step 2 — Run the new SQL migration
In Supabase Dashboard → SQL Editor → New query, run the complete file:
`supabase/migrations/202611060001_sdp_access_audit.sql`

This creates the access audit table. It does not modify the already-installed Phase 3 migration.

## Step 3 — Replace the login gate markup
In `index.html`, find the existing block beginning `<div id="sdpAuthGate">` and ending at its matching `</div>` immediately before `<div class="app" id="sdpProtectedApp"...>`.
Replace only that gate block with the following:

```html
<div id="sdpAuthGate">
  <div class="sdp-auth-card">
    <img src="assets/sdp-logo.jpg" alt="SDP Logo" width="65">
    <h2>SDP-BESR Secure Access</h2>
    <p>Sign in with an approved account or submit an access request.</p>
    <div id="sdpLoginPanel">
      <form id="sdpAuthForm">
        <label for="sdpAuthEmail">Email Address</label>
        <input id="sdpAuthEmail" type="email" required autocomplete="username">
        <label for="sdpAuthPassword">Password</label>
        <input id="sdpAuthPassword" type="password" required autocomplete="current-password">
        <button id="sdpAuthSubmit" type="submit">Sign In</button>
      </form>
      <button id="sdpShowRequest" type="button" class="secondary" style="width:100%;margin-top:10px">Request an account</button>
    </div>
    <div id="sdpRequestPanel" hidden>
      <label for="sdpRequestName">Full Name</label>
      <input id="sdpRequestName" type="text" autocomplete="name" required>
      <label for="sdpRequestEmail">Email Address</label>
      <input id="sdpRequestEmail" type="email" autocomplete="email" required>
      <label for="sdpRequestPassword">Create Password (minimum 10 characters)</label>
      <input id="sdpRequestPassword" type="password" minlength="10" autocomplete="new-password" required>
      <label for="sdpRequestConfirm">Confirm Password</label>
      <input id="sdpRequestConfirm" type="password" minlength="10" autocomplete="new-password" required>
      <button id="sdpRequestAccess" type="button" style="width:100%;padding:12px;margin-top:18px;border:0;border-radius:7px;background:#ed8735;color:#1d211c;font-weight:800">Submit Access Request</button>
      <button id="sdpBackToLogin" type="button" class="secondary" style="width:100%;margin-top:9px">Back to Sign In</button>
    </div>
    <p id="sdpAuthMessage" role="status" aria-live="polite"></p>
  </div>
</div>
```

## Step 4 — Replace the old authentication script
In `index.html`, find the final inline authentication script that creates `window.sdpSupabase` and calls `verifyAdministrator()`.
Replace that entire script with this block. It must remain after the Supabase CDN library has loaded and before `election-management.js`.

```html
<script>
(function () {
  const SUPABASE_URL = "https://mcbwbcqetrrwxfqfvhkc.supabase.co";
  const SUPABASE_KEY = "sb_publishable_3R6ExeGg6ZTR6gQKKhPDvA_xvlSwme1";
  window.sdpSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
})();
</script>
<script src="web/access-control.js"></script>
```

Do not remove or change the Supabase publishable key. Never put the service-role key in `index.html`.

## Step 5 — Deploy the Edge Function
The included GitHub Actions workflow deploys `sdp-access-admin` when its function file changes or when manually dispatched. It uses the existing `SUPABASE_ACCESS_TOKEN` GitHub Actions secret.

## Step 6 — Supabase Auth settings
In Supabase → Authentication → URL Configuration, ensure the site URL and allowed redirect URLs include your deployed SDP-BESR website address.
Email confirmation may remain enabled. If enabled, a requester must confirm their email before signing in.

## Step 7 — Test
1. Sign in with the existing GPS administrator account. Confirm the existing command-centre workspace still opens.
2. Open **User access management** in the sidebar.
3. Submit a test access request using a separate email address.
4. Refresh the user access list. Confirm the new user is `pending`.
5. Approve the test account with `Read Only` and `Statewide` scope.
6. Confirm the audit entry is created:
   `select * from public.sdp_access_audit order by created_at desc;`
7. Sign in as the test user. The user should receive an approved-but-module-access-not-yet-enabled message, not enter the command centre.
8. Suspend the test account and confirm sign-in is blocked from the operational workspace.

## Important security boundary
This phase enables account requests, administrator approval, suspension/reinstatement and access auditing. It intentionally does not open operational modules to non-GPS roles yet. Existing operational tables still have their existing GPS-admin access policies. We must implement and test module-specific RLS policies before admitting other roles to incidents, results, evidence, polling-unit or camera operations.
