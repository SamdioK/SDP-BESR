-- SDP-BESR Phase 2: verified polling-unit integration and assignment integrity
-- Depends on Phase 1 camera tables and public.benue_polling_units.
-- The confirmed registry primary key is id UUID; official full_code is UNIQUE.
-- GPS administrators are determined by public.is_gps_admin().

begin;

-- Link assignments to the authoritative polling-unit registry.
-- NOT VALID allows the constraint to be installed without immediately scanning
-- historical rows; VALIDATE below then checks existing data. If historical
-- orphan rows exist, the transaction fails and no partial migration is committed.
alter table public.camera_assignments
  add constraint camera_assignments_polling_unit_id_fkey
  foreign key (polling_unit_id)
  references public.benue_polling_units(id)
  on update cascade
  on delete restrict
  not valid;

alter table public.camera_assignments
  validate constraint camera_assignments_polling_unit_id_fkey;

-- Ensure a camera cannot be actively assigned to two polling units at once.
create unique index if not exists uq_camera_one_active_assignment
  on public.camera_assignments(camera_device_id)
  where assignment_status = 'active';

-- Fast lookup of verified polling units by official code and location.
create index if not exists idx_benue_polling_units_verified_full_code
  on public.benue_polling_units(full_code)
  where verification_status = 'verified';

create index if not exists idx_benue_polling_units_verified_location
  on public.benue_polling_units(lga_name, ward_name, pu_name)
  where verification_status = 'verified';

comment on constraint camera_assignments_polling_unit_id_fkey
  on public.camera_assignments is
  'Links camera assignments to the authoritative Benue polling-unit registry.';

comment on index public.uq_camera_one_active_assignment is
  'One active polling-unit assignment per camera device.';

commit;
