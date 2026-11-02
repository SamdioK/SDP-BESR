-- SDP-BESR Phase 1: Election Management
-- Apply this migration to the existing SDP-BESR Supabase project.
-- Requires the existing public.is_gps_admin() authorization RPC/function.
begin;

create extension if not exists pgcrypto;

create table if not exists public.election_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  election_year integer not null check (election_year between 2000 and 2200),
  state_name text not null default 'Benue State',
  country text not null default 'Nigeria',
  commencement_date date,
  official_inec_reference_url text,
  notes text,
  status text not null default 'draft'
    check (status in ('draft','upcoming','active','completed','archived')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, election_year)
);

create table if not exists public.election_contests (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.election_cycles(id) on delete restrict,
  contest_type text not null
    check (contest_type in ('governorship','senatorial','federal_constituency','state_assembly','other')),
  title text not null,
  constituency_name text,
  election_date date,
  official_inec_reference_url text,
  notes text,
  status text not null default 'draft'
    check (status in ('draft','published','suspended','completed','archived')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, contest_type, title, constituency_name)
);

create table if not exists public.political_parties (
  id uuid primary key default gen_random_uuid(),
  party_name text not null unique,
  abbreviation text not null unique,
  official_colour text,
  logo_url text,
  registration_status text not null default 'pending_verification'
    check (registration_status in ('active','inactive','pending_verification')),
  official_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.election_contest_parties (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.election_contests(id) on delete cascade,
  party_id uuid not null references public.political_parties(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (contest_id, party_id)
);

create table if not exists public.election_candidates (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.election_contests(id) on delete restrict,
  party_id uuid not null references public.political_parties(id) on delete restrict,
  candidate_name text not null,
  running_mate text,
  photo_url text,
  nomination_reference text,
  candidate_status text not null default 'draft'
    check (candidate_status in ('draft','nominated','withdrawn','disqualified')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, party_id)
);

create table if not exists public.election_configuration_audit (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  old_record jsonb,
  new_record jsonb
);

create index if not exists idx_election_contests_cycle on public.election_contests(cycle_id);
create index if not exists idx_election_candidates_contest on public.election_candidates(contest_id);
create index if not exists idx_election_candidates_party on public.election_candidates(party_id);
create index if not exists idx_election_audit_changed_at on public.election_configuration_audit(changed_at desc);

create or replace function public.sdp_em_set_updated_at()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sdp_em_audit_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  old_json jsonb;
  new_json jsonb;
  row_id uuid;
begin
  if tg_op = 'INSERT' then
    new_json := to_jsonb(new);
    row_id := (new_json->>'id')::uuid;
  elsif tg_op = 'UPDATE' then
    old_json := to_jsonb(old);
    new_json := to_jsonb(new);
    row_id := (new_json->>'id')::uuid;
  else
    old_json := to_jsonb(old);
    row_id := (old_json->>'id')::uuid;
  end if;

  insert into public.election_configuration_audit
    (table_name, record_id, operation, changed_by, old_record, new_record)
  values
    (tg_table_name, row_id, tg_op, auth.uid(), old_json, new_json);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['election_cycles','election_contests','political_parties','election_candidates'] loop
    execute format('drop trigger if exists %I on public.%I', 'sdp_em_updated_'||t, t);
    execute format('create trigger %I before update on public.%I for each row execute function public.sdp_em_set_updated_at()', 'sdp_em_updated_'||t, t);
    execute format('drop trigger if exists %I on public.%I', 'sdp_em_audit_'||t, t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.sdp_em_audit_change()', 'sdp_em_audit_'||t, t);
  end loop;
end $$;

drop trigger if exists sdp_em_audit_election_contest_parties on public.election_contest_parties;
create trigger sdp_em_audit_election_contest_parties
after insert or update or delete on public.election_contest_parties
for each row execute function public.sdp_em_audit_change();

alter table public.election_cycles enable row level security;
alter table public.election_contests enable row level security;
alter table public.political_parties enable row level security;
alter table public.election_contest_parties enable row level security;
alter table public.election_candidates enable row level security;
alter table public.election_configuration_audit enable row level security;

-- The existing SDP-BESR admin gate uses this same public.is_gps_admin() function.
-- Keep configuration and audit data restricted to authorised administrators.
do $$
declare
  t text;
begin
  foreach t in array array[
    'election_cycles','election_contests','political_parties',
    'election_contest_parties','election_candidates','election_configuration_audit'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'sdp_em_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_gps_admin()) with check (public.is_gps_admin())',
      'sdp_em_admin_all', t
    );
  end loop;
end $$;

grant select, insert, update, delete on
  public.election_cycles,
  public.election_contests,
  public.political_parties,
  public.election_contest_parties,
  public.election_candidates
to authenticated;

grant select on public.election_configuration_audit to authenticated;
grant usage, select on sequence public.election_configuration_audit_id_seq to authenticated;

commit;
