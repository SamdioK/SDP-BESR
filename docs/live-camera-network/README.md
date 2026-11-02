# SDP-BESR — Live Polling Unit Camera Network
## Phase 1: Database foundation and access control

This package adds the database foundation for the combined mobile-phone and fixed-camera network.

### Package contents

- `supabase/migrations/202611030001_live_camera_network.sql` — creates camera registration, polling-unit assignment, stream-session, access-log, incident and audit tables.
- `docs/PHASE-1-IMPLEMENTATION.md` — installation and verification guide.

### Important compatibility decision

The existing SDP-BESR polling-unit table name and exact schema have not yet been verified. For that reason, `polling_unit_id` is stored as a UUID but is not yet declared as a foreign key. This avoids accidentally linking the new module to a guessed table or column. The next integration step will connect it to the verified polling-unit registry.

### Prerequisites

1. Use the existing SDP-BESR Supabase project:
   `https://mcbwbcqetrrwxfqfvhkc.supabase.co`
2. The existing `public.is_gps_admin()` function must be present and return `true` for authorised GPS administrators.
3. Take a database backup or use a staging project before applying a new migration.

### Installation — Android-friendly steps

1. Download and extract this ZIP.
2. Open the Supabase Dashboard for the SDP-BESR project.
3. Open **SQL Editor** and create a new query.
4. Open `supabase/migrations/202611030001_live_camera_network.sql` from the extracted folder.
5. Copy the entire SQL file and paste it into the SQL Editor.
6. Run it once.
7. If Supabase reports an error, stop and share the complete error text. Do not repeatedly run partial fragments.

### Verification query

After a successful migration, run:

```sql
select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'camera_devices',
    'camera_assignments',
    'camera_stream_sessions',
    'camera_device_audit',
    'camera_access_logs',
    'camera_incidents'
  )
order by table_name;
```

Expected result: six table names.

Check RLS:

```sql
select
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'camera_%'
order by tablename;
```

Expected result: `rowsecurity = true` for all six tables.

### What Phase 1 does

- Creates a registry for mobile and fixed cameras.
- Creates assignments linking a camera to a polling-unit identifier and an authorised operator.
- Tracks stream session metadata; it does not transport or store video.
- Records stream access events without storing access tokens.
- Creates incident-report records.
- Creates an audit trail for device, assignment and session changes.
- Enables RLS and restricts direct authenticated browser access to GPS administrators.

### What Phase 1 deliberately does not do

- It does not start a camera or transmit video.
- It does not create a LiveKit account or configure LiveKit credentials.
- It does not create public Storage buckets.
- It does not expose RTSP camera credentials or service-role keys.
- It does not yet allow field agents to write directly to these tables. Field-agent operations will be implemented through authenticated Edge Functions with assignment checks.

### Security and election safeguards

The network must not film voters marking ballots, ballot choices, voting cubicles or personal voter information. Camera placement and operation must be approved and compliant with INEC requirements and applicable law. Audio capture is not included in this phase. Incident records are reports requiring review, not automatically verified findings.

### Next phase

Before writing Phase 2, verify the existing polling-unit registry table and its columns. Then implement the mobile-device registration and assignment Edge Functions, with short-lived permissions and no client-side service-role key.
