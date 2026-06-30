-- Migration: Create ref_route_delivery_status table
-- Created: 2026-04-07

create table public.ref_route_delivery_status (
  id bigint generated always as identity not null,
  code text not null,
  name text not null,
  description text null,
  display_order integer null,
  is_active boolean not null default true,
  is_test boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null,
  constraint ref_route_delivery_status_pkey primary key (id),
  constraint ref_route_delivery_status_code_key unique (code)
) TABLESPACE pg_default;

create trigger trg_ref_route_delivery_status_updated_at BEFORE
update on ref_route_delivery_status for EACH row
execute FUNCTION set_updated_at ();

-- Insert default delivery status values
insert into ref_route_delivery_status (code, name, description, display_order) values
  ('pending', 'Pendente', 'Rota ainda não iniciada', 1),
  ('in_progress', 'Em Andamento', 'Rota em execução', 2),
  ('completed', 'Concluída', 'Rota finalizada com sucesso', 3),
  ('cancelled', 'Cancelada', 'Rota cancelada', 4),
  ('aborted', 'Abortada', 'Rota abortada/interrompida', 5);
