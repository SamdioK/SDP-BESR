-- SDP-BESR Phase 3B: access audit foundation
begin;

create table if not exists public.sdp_access_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('approved','suspended','reinstated')),
  old_role text,
  new_role text,
  old_status text,
  new_status text,
  scope_type text,
  scope_value text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sdp_access_audit_target_created
  on public.sdp_access_audit(target_user_id, created_at desc);

alter table public.sdp_access_audit enable row level security;
revoke all on public.sdp_access_audit from anon, authenticated;
grant select on public.sdp_access_audit to authenticated;

drop policy if exists sdp_access_audit_admin_read on public.sdp_access_audit;
create policy sdp_access_audit_admin_read on public.sdp_access_audit
for select to authenticated
using (
  exists (
    select 1 from public.sdp_user_access a
    where a.user_id = auth.uid()
      and a.account_status = 'active'
      and a.role in ('gps_admin','super_admin')
  )
);

commit;
