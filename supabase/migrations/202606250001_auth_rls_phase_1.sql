-- =====================================================================
-- Fase 1 — Auth/RLS: bridge de identidade + funções de contexto + refs
-- Projeto: tfupwytzrkpzocfxheeq
-- Proposta: ver docs/MIGRACAO-SUPABASE-AUTH-RLS.md
--
-- ESCOPO (somente):
--   M1 — bridge master_user.id_auth_user -> auth.users(id)
--   M2 — current_user_id() / current_tenant_id() / current_user_role() via auth.uid()
--   M3 — policies SELECT (authenticated) nos catálogos ref_*
--
-- NÃO inclui: RPCs de escrita, alteração de views admin, trigger em auth.users,
--             remoção de mocks, alteração de frontend/services.
--
-- Idempotente. Comportamentalmente neutro até o 1º usuário ser vinculado (Fase 2).
-- Rollback no final do arquivo (bloco comentado).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- M1 — Bridge de identidade
-- ---------------------------------------------------------------------
alter table public.master_user
  add column if not exists id_auth_user uuid;

comment on column public.master_user.id_auth_user is
  'Vínculo com auth.users(id) do Supabase Auth. NULL = usuário ainda não provisionado para login. Preenchido no provisionamento/primeiro login (ver docs/MIGRACAO-SUPABASE-AUTH-RLS.md).';

-- UNIQUE parcial: permite vários NULL, garante 1:1 quando preenchido.
create unique index if not exists ux_master_user_id_auth_user
  on public.master_user (id_auth_user)
  where id_auth_user is not null;

-- FK para auth.users (idempotente via guarda de exceção).
do $$
begin
  alter table public.master_user
    add constraint fk_master_user_auth_user
    foreign key (id_auth_user)
    references auth.users (id)
    on delete set null;
exception
  when duplicate_object then null;  -- constraint já existe
end $$;

-- ---------------------------------------------------------------------
-- M2 — Funções de contexto baseadas em auth.uid()
--   Mantêm nome/assinatura (policies existentes continuam válidas).
--   SECURITY DEFINER + search_path fixo => leem master_user/rel_user_role/
--   ref_user_role sem depender de RLS. Retornam NULL se não autenticado.
-- ---------------------------------------------------------------------
create or replace function public.current_user_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select mu.id
  from public.master_user mu
  where mu.id_auth_user = auth.uid()
    and mu.is_active = true
  limit 1;
$$;

create or replace function public.current_tenant_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select mu.id_tenant
  from public.master_user mu
  where mu.id_auth_user = auth.uid()
    and mu.is_active = true
  limit 1;
$$;

create or replace function public.current_user_role()
  returns text
  language sql
  stable
  security definer
  set search_path = public
as $$
  select r.code
  from public.master_user mu
  join public.rel_user_role ur on ur.id_user = mu.id and ur.id_tenant = mu.id_tenant
  join public.ref_user_role r  on r.id = ur.id_role
  where mu.id_auth_user = auth.uid()
    and mu.is_active = true
  limit 1;
$$;

grant execute on function public.current_user_id()   to anon, authenticated;
grant execute on function public.current_tenant_id() to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;

-- ---------------------------------------------------------------------
-- M3 — Leitura dos catálogos ref_* para usuários autenticados
--   Catálogos globais (sem tenant) => SELECT using(true). Escrita continua
--   sem policy (bloqueada, exceto service_role).
-- ---------------------------------------------------------------------
drop policy if exists ref_slot_status_select       on public.ref_slot_status;
create policy ref_slot_status_select       on public.ref_slot_status       for select to authenticated using (true);

drop policy if exists ref_approval_decision_select on public.ref_approval_decision;
create policy ref_approval_decision_select on public.ref_approval_decision for select to authenticated using (true);

drop policy if exists ref_attendance_status_select on public.ref_attendance_status;
create policy ref_attendance_status_select on public.ref_attendance_status for select to authenticated using (true);

drop policy if exists ref_user_role_select         on public.ref_user_role;
create policy ref_user_role_select         on public.ref_user_role         for select to authenticated using (true);

commit;

-- =====================================================================
-- VERIFICAÇÃO (rodar após aplicar; não faz parte da migration)
-- =====================================================================
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='master_user' and column_name='id_auth_user';
-- select proname, prosecdef from pg_proc
--  where pronamespace='public'::regnamespace and proname in ('current_user_id','current_tenant_id','current_user_role');
-- select tablename, policyname, cmd, roles::text from pg_policies
--  where schemaname='public' and tablename like 'ref_%' order by tablename;
-- select public.current_user_id(), public.current_tenant_id(), public.current_user_role(); -- null sem usuário vinculado

-- =====================================================================
-- ROLLBACK (executar manualmente se necessário; restaura o estado anterior)
-- =====================================================================
-- begin;
-- -- M3
-- drop policy if exists ref_slot_status_select       on public.ref_slot_status;
-- drop policy if exists ref_approval_decision_select on public.ref_approval_decision;
-- drop policy if exists ref_attendance_status_select on public.ref_attendance_status;
-- drop policy if exists ref_user_role_select         on public.ref_user_role;
--
-- -- M2 — restaurar corpos ORIGINAIS (GUC), como auditado em 2026-06-25
-- create or replace function public.current_user_id()
--   returns uuid language sql stable as $fn$
--   select nullif(current_setting('app.user_id', true), '')::uuid;
-- $fn$;
-- create or replace function public.current_tenant_id()
--   returns uuid language sql stable as $fn$
--   select nullif(current_setting('app.tenant_id', true), '')::uuid;
-- $fn$;
-- create or replace function public.current_user_role()
--   returns text language sql stable as $fn$
--   select r.code
--   from rel_user_role ur
--   join ref_user_role r on r.id = ur.id_role
--   where ur.id_user   = current_user_id()
--     and ur.id_tenant = current_tenant_id()
--   limit 1;
-- $fn$;
--
-- -- M1
-- alter table public.master_user drop constraint if exists fk_master_user_auth_user;
-- drop index if exists public.ux_master_user_id_auth_user;
-- alter table public.master_user drop column if exists id_auth_user;
-- commit;
