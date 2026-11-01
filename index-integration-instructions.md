# Integrate Election Management into index.html

The repository already contains the main SDP-BESR shell and the existing Supabase authentication bootstrap. Preserve those systems.

## A. Replace the existing placeholder section

Find the element beginning:

`<section class="view" id="view-elections">`

Replace that entire section through its matching `</section>` with the contents of `election-management-section.html`.

## B. Add the stylesheet

Copy the CSS in `election-management.css` into the existing `<style>` element, immediately before `</style>`.

## C. Add the modal markup

Copy the markup in `election-management-modal.html` immediately before the existing `<script src="election-management.js"></script>` or, if that script tag is not yet present, immediately before `</body>`.

## D. Load the JavaScript

Immediately before `</body>`, after the existing Supabase authentication script, add:

`<script src="election-management.js"></script>`

The existing authentication script creates `window.sdpSupabase`; the module controller uses that client and does not create a second Supabase client.

## E. Apply the database migration

Run `supabase/migrations/202611010001_election_management.sql` in the SQL Editor of the existing SDP-BESR Supabase project. Confirm the existing `public.is_gps_admin()` function is present before applying it.

## F. Verify

Sign in with an authorised administrator account and open Election Management. Test create/list workflows for cycles, contests, parties and candidates. Test publication with test data first. Inspect `election_configuration_audit` and confirm RLS blocks unauthorised access.
