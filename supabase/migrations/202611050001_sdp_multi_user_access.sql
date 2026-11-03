-- SDP-BESR Phase 3: Controlled multi-user access foundation
begin;

create table if not exists public.sdp_user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text check (role in (
    'super_admin','gps_admin','situation_room_admin','camera_admin',
    'camera_operator','lga_coordinator','ward_officer',
    'incident_verifier','evidence_officer','legal_officer','read_only'
  )),
  account_status text not null default 'pending'
    check (account_status in ('pending','active','suspended')),
  scope_type text not null default 'state'
    check (scope_type in ('state','lga','ward','polling_unit')),
  scope_value text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope_type = 'state' and scope_value is null) or
         (scope_type <> 'state' and nullif(trim(scope_value),'') is not null))
);

create index if not exists idx_sdp_user_access_status_role
  on public.sdp_user_access(account_status, role);

create or replace function public.sdp_user_access_set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists sdp_user_access_updated_at on public.sdp_user_access;
create trigger sdp_user_access_updated_at before update on public.sdp_user_access
for each row execute function public.sdp_user_access_set_updated_at();

create or replace function public.sdp_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.sdp_user_access(user_id, full_name, email, account_status)
  values (new.id, nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')), ''), new.email, 'pending')
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = coalesce(public.sdp_user_access.full_name, excluded.full_name);
  return new;
end;
$$;

drop trigger if exists sdp_auth_user_access_created on auth.users;
create trigger sdp_auth_user_access_created after insert on auth.users
for each row execute function public.sdp_handle_new_auth_user();

-- Preserve existing GPS administrator membership and privileges.
insert into public.sdp_user_access(user_id,email,role,account_status,approved_at)
select g.user_id, u.email, 'gps_admin', 'active', now()
from public.gps_platform_admins g join auth.users u on u.id = g.user_id
on conflict (user_id) do update set
  email = excluded.email,
  role = case when public.sdp_user_access.role is null then 'gps_admin' else public.sdp_user_access.role end,
  account_status = 'active',
  approved_at = coalesce(public.sdp_user_access.approved_at, now());

alter table public.sdp_user_access enable row level security;
revoke all on public.sdp_user_access from anon, authenticated;
grant select on public.sdp_user_access to authenticated;

drop policy if exists sdp_user_access_read_own on public.sdp_user_access;
create policy sdp_user_access_read_own on public.sdp_user_access
for select to authenticated using (user_id = auth.uid());

create or replace function public.sdp_my_access()
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
      'user_id',a.user_id,'full_name',a.full_name,'email',a.email,
      'role',a.role,'account_status',a.account_status,
      'scope_type',a.scope_type,'scope_value',a.scope_value
    ) from public.sdp_user_access a where a.user_id = auth.uid()),
    jsonb_build_object('account_status','not_registered')
  );
$$;
revoke all on function public.sdp_my_access() from public, anon;
grant execute on function public.sdp_my_access() to authenticated;

commit;
