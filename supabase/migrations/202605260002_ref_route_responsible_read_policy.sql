-- Allow the app to read active route responsible reference records.

alter table public.ref_route_responsible enable row level security;

drop policy if exists "ref_route_responsible_read_active" on public.ref_route_responsible;

create policy "ref_route_responsible_read_active"
on public.ref_route_responsible
for select
to anon, authenticated
using (is_active = true);
