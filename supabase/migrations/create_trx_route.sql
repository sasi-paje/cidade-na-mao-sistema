-- Migration: Create trx_route table
-- Created: 2026-04-07

create table public.trx_route (
  id bigint generated always as identity not null,
  route_code text not null,
  departure_date date not null,
  id_route_status bigint not null,
  id_route_delivery_status bigint not null,
  id_route_type bigint null,
  id_vehicle bigint not null,
  id_driver bigint null,
  starts_at timestamp with time zone null,
  ends_at timestamp with time zone null,
  vehicle_start_photo_path text null,
  observation text null,
  daily_count integer null,
  transported_weight numeric(12, 3) null,
  nominal_capacity numeric(12, 3) null,
  utilization_percent numeric(5, 2) null,
  is_active boolean not null default true,
  is_test boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null,
  created_by bigint null,
  updated_by bigint null,
  area text null,
  responsible text null,
  assistant text null,
  constraint trx_route_pkey primary key (id),
  constraint uq_trx_route_route_code_test unique (route_code, is_test),
  constraint fk_trx_route_status foreign KEY (id_route_status) references ref_route_status (id),
  constraint fk_trx_route_delivery_status foreign KEY (id_route_delivery_status) references ref_route_delivery_status (id),
  constraint fk_trx_route_vehicle foreign KEY (id_vehicle) references master_fleet_vehicle (id),
  constraint fk_trx_route_type foreign KEY (id_route_type) references ref_route_type (id),
  constraint fk_trx_route_driver foreign KEY (id_driver) references master_person_driver (id)
) TABLESPACE pg_default;

create index IF not exists ix_trx_route_departure_date on public.trx_route using btree (departure_date) TABLESPACE pg_default;

create index IF not exists ix_trx_route_status on public.trx_route using btree (id_route_status) TABLESPACE pg_default;

create index IF not exists ix_trx_route_vehicle on public.trx_route using btree (id_vehicle) TABLESPACE pg_default;

create trigger trg_trx_route_updated_at BEFORE
update on trx_route for EACH row
execute FUNCTION set_updated_at ();
