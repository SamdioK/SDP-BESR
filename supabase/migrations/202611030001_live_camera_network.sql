-- SDP-BESR Phase 1: Live Polling Unit Camera Network
-- Date: 2026-11-03
-- Requires the existing public.is_gps_admin() function used by SDP-BESR.
--
-- IMPORTANT:
-- * This migration creates the camera-management data model only.
-- * It does not create video streams or expose camera credentials.
-- * polling_unit_id is deliberately stored as a UUID without a foreign key
--   because the existing polling-unit table/schema has not yet been verified.
-- * All direct client access is GPS-admin-only. Future Edge Functions must
--   validate the caller, assignment and permissions before using service role.

begin;

create extension if not exists pgcrypto;

-- Registered physical/mobile camera endpoints. No RTSP password or stream
-- publishing secret is stored in this table.
create table if not exists public.camera_devices (
  id uuid primary key default gen_random_uuid(),
  device_code text not null unique,
  device_name text not null,
  device_type text not null
    check (device_type in ('mobile','fixed')),
  connection_method text not null
    check (connection_method in ('webrtc_mobile','rtsp_gateway','usb_gateway')),
  device_status text not null default 'pending'
    check (device_status in ('pending','approved','suspended','retired')),
  owner_user_id uuid references auth.users(id) on delete set null,
  registered_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  last_seen_at timestamptz,
  last_connection_status text not null default 'never_connected'
    check (last_connection_status in ('never_connected','online','offline','error')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Assignments bind a registered camera to a polling unit and an authorised
-- operator. polling_unit_id is a UUID but intentionally has no FK yet.
create table if not exists public.camera_assignments (
  id uuid primary key default gen_random_uuid(),
  camera_device_id uuid not null
    references public.camera_devices(id) on delete restrict,
  polling_unit_id uuid not null,
  polling_unit_code text,
  polling_unit_name text not null,
  ward_name text not null,
  lga_name text not null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  assignment_status text not null default 'pending'
    check (assignment_status in ('pending','active','suspended','ended')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists idx_camera_assignments_unit
  on public.camera_assignments(polling_unit_id);
create index if not exists idx_camera_assignments_user
  on public.camera_assignments(assigned_user_id);
create index if not exists idx_camera_assignments_camera_status
  on public.camera_assignments(camera_device_id, assignment_status);

-- A row represents a stream attempt/session, not stored video.
create table if not exists public.camera_stream_sessions (
  id uuid primary key default gen_random_uuid(),
  camera_device_id uuid not null
    references public.camera_devices(id) on delete restrict,
  camera_assignment_id uuid not null
    references public.camera_assignments(id) on delete restrict,
  publisher_user_id uuid references auth.users(id) on delete set null,
  video_provider text not null default 'livekit'
    check (video_provider in ('livekit','other')),
  provider_room_name text,
  session_status text not null default 'requested'
    check (session_status in ('requested','live','reconnecting','ended','failed','revoked')),
  started_at timestamptz,
  ended_at timestamptz,
  last_heartbeat_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create index if not exists idx_camera_sessions_status
  on public.camera_stream_sessions(session_status, created_at desc);
create index if not exists idx_camera_sessions_device
  on public.camera_stream_sessions(camera_device_id, created_at desc);

-- Audit trail for camera registration, approval, assignment and status changes.
create table if not exists public.camera_device_audit (
  id bigint generated always as identity primary key,
  entity_type text not null
    check (entity_type in ('camera_device','camera_assignment','camera_stream_session')),
  entity_id uuid not null,
  operation text not null
    check (operation in ('INSERT','UPDATE','DELETE','APPROVE','SUSPEND','REVOKE')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  old_record jsonb,
  new_record jsonb
);

create index if not exists idx_camera_device_audit_entity
  on public.camera_device_audit(entity_type, entity_id, changed_at desc);

-- Records who was granted/viewed a stream. The actual token is never stored.
create table if not exists public.camera_access_logs (
  id bigint generated always as identity primary key,
  stream_session_id uuid not null
    references public.camera_stream_sessions(id) on delete restrict,
  viewer_user_id uuid references auth.users(id) on delete set null,
  access_action text not null
    check (access_action in ('view_granted','view_started','view_ended','view_denied')),
  accessed_at timestamptz not null default now(),
  client_label text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_camera_access_logs_session
  on public.camera_access_logs(stream_session_id, accessed_at desc);

-- Incident reports are records of allegations/observations and must not be
-- presented as verified facts until reviewed by an authorised reviewer.
create table if not exists public.camera_incidents (
  id uuid primary key default gen_random_uuid(),
  polling_unit_id uuid not null,
  camera_device_id uuid references public.camera_devices(id) on delete set null,
  stream_session_id uuid references public.camera_stream_sessions(id) on delete set null,
  reported_by uuid references auth.users(id) on delete set null,
  incident_category text not null
    check (incident_category in (
      'security_concern','access_obstruction','equipment_issue',
      'procedure_concern','other'
    )),
  incident_description text not null,
  observed_at timestamptz,
  incident_status text not null default 'submitted'
    check (incident_status in ('submitted','under_review','referred','closed','unsubstantiated')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_camera_incidents_unit
  on public.camera_incidents(polling_unit_id, created_at desc);
create index if not exists idx_camera_incidents_status
  on public.camera_incidents(incident_status, created_at desc);

-- Updated-at trigger.
create or replace function public.sdp_camera_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'camera_devices',
    'camera_assignments',
    'camera_stream_sessions',
    'camera_incidents'
  ] loop
    execute format('drop trigger if exists %I on public.%I',
      'sdp_camera_updated_' || t, t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.sdp_camera_set_updated_at()',
      'sdp_camera_updated_' || t, t
    );
  end loop;
end;
$$;

-- Audit trigger. SECURITY DEFINER is limited to this insert-only operation.
create or replace function public.sdp_camera_write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_json jsonb;
  new_json jsonb;
  entity_uuid uuid;
begin
  if tg_op = 'INSERT' then
    new_json := to_jsonb(new);
    entity_uuid := (new_json ->> 'id')::uuid;
  elsif tg_op = 'UPDATE' then
    old_json := to_jsonb(old);
    new_json := to_jsonb(new);
    entity_uuid := (new_json ->> 'id')::uuid;
  else
    old_json := to_jsonb(old);
    entity_uuid := (old_json ->> 'id')::uuid;
  end if;

  insert into public.camera_device_audit
    (entity_type, entity_id, operation, changed_by, old_record, new_record)
  values
    (
      case tg_table_name
        when 'camera_devices' then 'camera_device'
        when 'camera_assignments' then 'camera_assignment'
        else 'camera_stream_session'
      end,
      entity_uuid,
      tg_op,
      auth.uid(),
      old_json,
      new_json
    );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'camera_devices',
    'camera_assignments',
    'camera_stream_sessions'
  ] loop
    execute format('drop trigger if exists %I on public.%I',
      'sdp_camera_audit_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.sdp_camera_write_audit()',
      'sdp_camera_audit_' || t, t
    );
  end loop;
end;
$$;

-- RLS: direct browser access is restricted to authenticated GPS administrators.
-- Future field-agent operations must go through Edge Functions which validate
-- the signed-in user, active assignment, approved device and stream permissions.
alter table public.camera_devices enable row level security;
alter table public.camera_assignments enable row level security;
alter table public.camera_stream_sessions enable row level security;
alter table public.camera_device_audit enable row level security;
alter table public.camera_access_logs enable row level security;
alter table public.camera_incidents enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'camera_devices',
    'camera_assignments',
    'camera_stream_sessions',
    'camera_device_audit',
    'camera_access_logs',
    'camera_incidents'
  ] loop
    execute format('drop policy if exists %I on public.%I',
      'sdp_camera_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_gps_admin()) with check (public.is_gps_admin())',
      'sdp_camera_admin_all', t
    );
  end loop;
end;
$$;

grant select, insert, update, delete on
  public.camera_devices,
  public.camera_assignments,
  public.camera_stream_sessions,
  public.camera_incidents
to authenticated;

grant select on
  public.camera_device_audit,
  public.camera_access_logs
to authenticated;

grant usage, select on sequence
  public.camera_device_audit_id_seq,
  public.camera_access_logs_id_seq
to authenticated;

-- No anon policies or public grants are created.
-- No Storage bucket is created in Phase 1.
-- No RTSP credentials, LiveKit API secrets or access tokens are stored here.

commit;
