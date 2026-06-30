-- =====================================================
-- Garante a coluna is_test nas tabelas transacionais/relacionais
-- que precisam separar TESTE (is_test = true) de PRODUÇÃO (is_test = false).
--
-- Idempotente e NÃO destrutivo:
--   - ADD COLUMN IF NOT EXISTS com default false (registros antigos = produção).
--   - Não altera dados, não remove nada, não usa TRUNCATE/DELETE.
--
-- Regra do projeto: is_test = false → produção | is_test = true → teste.
-- =====================================================

-- Tabelas transacionais (trx_*)
alter table if exists public.trx_route
  add column if not exists is_test boolean not null default false;
alter table if exists public.trx_route_stop
  add column if not exists is_test boolean not null default false;
alter table if exists public.trx_route_history
  add column if not exists is_test boolean not null default false;
alter table if exists public.trx_fiscal_invoice
  add column if not exists is_test boolean not null default false;
alter table if exists public.trx_fiscal_invoice_import
  add column if not exists is_test boolean not null default false;
alter table if exists public.trx_route_invoice_delivery
  add column if not exists is_test boolean not null default false;

-- Tabelas de relacionamento (rel_*)
alter table if exists public.rel_route_invoice
  add column if not exists is_test boolean not null default false;
alter table if exists public.rel_route_driver
  add column if not exists is_test boolean not null default false;
alter table if exists public.rel_route_helper
  add column if not exists is_test boolean not null default false;
alter table if exists public.rel_route_responsible
  add column if not exists is_test boolean not null default false;
alter table if exists public.rel_route_destination
  add column if not exists is_test boolean not null default false;
alter table if exists public.rel_person_company_role_type
  add column if not exists is_test boolean not null default false;

-- Tabelas master (master_*)
alter table if exists public.master_person_driver
  add column if not exists is_test boolean not null default false;
alter table if exists public.master_fleet_vehicle
  add column if not exists is_test boolean not null default false;
alter table if exists public.master_person_company
  add column if not exists is_test boolean not null default false;
alter table if exists public.master_person_company_address
  add column if not exists is_test boolean not null default false;

-- Índices para acelerar o filtro por ambiente nas tabelas de maior volume.
create index if not exists trx_route_is_test_idx
  on public.trx_route (is_test);
create index if not exists trx_route_stop_is_test_idx
  on public.trx_route_stop (is_test);
create index if not exists trx_fiscal_invoice_is_test_idx
  on public.trx_fiscal_invoice (is_test);
create index if not exists rel_route_invoice_is_test_idx
  on public.rel_route_invoice (is_test);
create index if not exists trx_route_invoice_delivery_is_test_idx
  on public.trx_route_invoice_delivery (is_test);
