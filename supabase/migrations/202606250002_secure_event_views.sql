-- =====================================================================
-- M4 — Views seguras por tenant + view pública dedicada
-- Projeto: tfupwytzrkpzocfxheeq (TESTE/HOMOLOGAÇÃO)
-- Aplicada via MCP apply_migration (migration `secure_event_views`) em 2026-06-25.
--
-- Problema corrigido: v_master_event_full / v_trx_slot_attendance_count /
-- v_master_equipment_availability eram SECURITY DEFINER sem filtro de tenant,
-- vazando dados cross-tenant (inclusive para anon).
--
-- Solução:
--  A) Nova view pública v_public_approved_events (DEFINER): só approved +
--     is_active, dados mínimos (sem id_user/creator), com confirmed_count.
--  B/C/D) Views admin → security_invoker = on: a RLS já existente filtra por
--     tenant/role; anon recebe 0 linhas.
--
-- NÃO altera tabelas-base, RLS das tabelas, funções, nem dados.
-- Rollback no rodapé.
-- =====================================================================

-- A) View pública (anon-safe)
create or replace view public.v_public_approved_events as
  select e.id,
         e.id_tenant,
         e.title,
         e.description,
         e.banner_url,
         e.location,
         e.is_active,
         s.id as id_slot,
         s.requested_at,
         s.approved_at,
         s.capacity,
         ss.code as slot_status,
         e.created_at,
         e.updated_at,
         coalesce(ac.confirmed_count, 0)::bigint as confirmed_count
  from public.master_event e
  join public.trx_event_slot s on s.id_event = e.id
  join public.ref_slot_status ss on ss.id = s.id_slot_status and ss.code = 'approved'
  left join lateral (
    select count(*) as confirmed_count
    from public.trx_event_attendance a
    join public.ref_attendance_status ras on ras.id = a.id_attendance_status
    where a.id_slot = s.id and ras.code = 'confirmed'
  ) ac on true
  where e.is_active = true;

comment on view public.v_public_approved_events is
  'View pública (anon): eventos approved+is_active, dados mínimos, sem id_user/creator. Fonte de /m/eventos.';

grant select on public.v_public_approved_events to anon, authenticated;

-- B,C,D) Views admin → security_invoker (RLS por tenant/role; anon = 0)
alter view public.v_master_event_full             set (security_invoker = on);
alter view public.v_master_equipment_availability set (security_invoker = on);
alter view public.v_trx_slot_attendance_count     set (security_invoker = on);

-- =====================================================================
-- VERIFICAÇÃO (não faz parte da migration)
-- =====================================================================
-- anon:        v_master_event_full=0, v_master_equipment_availability=0,
--              v_trx_slot_attendance_count=0, v_public_approved_events=approved/ativos
-- authenticated/admin: v_master_event_full só do tenant (distinct id_tenant=1)
--
-- =====================================================================
-- ROLLBACK (executar manualmente se necessário)
-- =====================================================================
-- alter view public.v_master_event_full             reset (security_invoker);
-- alter view public.v_master_equipment_availability reset (security_invoker);
-- alter view public.v_trx_slot_attendance_count     reset (security_invoker);
-- drop view if exists public.v_public_approved_events;
