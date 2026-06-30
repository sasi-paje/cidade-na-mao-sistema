-- Add responsible_name and responsible_type columns to master_fleet_vehicle
alter table public.master_fleet_vehicle
  add column if not exists responsible_name text null,
  add column if not exists responsible_type text null;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
