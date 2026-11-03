# GitHub installation instructions — Phase 2 testing documents

**Repository:** `SamdioK/SDP-BESR`  
**Branch:** `main`  
**Destination:** `docs/live-camera-network/`

## Files to add

Place these two files in the existing folder:

```text
docs/live-camera-network/
├── PHASE-2-TESTING.md
└── PHASE-2-TESTING-GITHUB-INSTALLATION.md
```

The first file is the complete functional test page. This file explains how to install both documents.

## Upload using GitHub on Android

1. Open `https://github.com/SamdioK/SDP-BESR`.
2. Confirm the branch is `main`.
3. Open `docs` → `live-camera-network`.
4. Tap **Add file** (or the `+` menu) → **Upload files**.
5. Upload `PHASE-2-TESTING.md`.
6. Upload `PHASE-2-TESTING-GITHUB-INSTALLATION.md`.
7. Use this commit message:

   `Add Phase 2 camera functional testing guide`

8. Commit to `main`, following the repository's established workflow.

If **Upload files** is not shown on mobile, enable the browser's desktop-site view or use **Add file → Create new file** and paste the complete contents from each Markdown file.

## Verify

Return to `docs/live-camera-network/` and confirm both files appear. Open each file and check that headings, SQL, JSON braces, and code blocks render correctly.

## Do not

- Rerun `202611030001_live_camera_network.sql`.
- Rerun `202611040001_camera_phase2_integration.sql`.
- Redeploy Edge Functions just to install documentation.
- Put access tokens, passwords, database credentials, or the service-role key in GitHub files.
- Replace `deploy-camera-edge-functions.yml` or existing Phase 1/Phase 2 files.

## After installation

Open `PHASE-2-TESTING.md` and follow its sequence, starting with the unauthenticated registration check. Use test accounts and a clearly labelled test device. Do not mark functional testing complete until the acceptance criteria in the testing page are met.
