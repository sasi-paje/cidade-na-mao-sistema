-- =====================================================================
-- Corrige RLS de leitura de presença — Projeto tfupwytzrkpzocfxheeq (HOMOLOG).
-- Aplicada no banco (refletida aqui para versionamento).
--
-- Problema: a policy attendance_select liberava o SELECT apenas via
--   EXISTS(master_event ... tenant), e master_event tem RLS (event_select =
--   admin OU criador). Um participante que se inscreve em evento de OUTRA
--   pessoa não enxerga o master_event → o EXISTS falha → não consegue ler a
--   PRÓPRIA inscrição. Resultado: "Meus Eventos" vazio e cards não marcados,
--   apesar de a inscrição estar gravada (confirm_attendance é SECURITY DEFINER).
--
-- Correção: permitir SEMPRE a leitura da própria inscrição
--   (id_user = current_user_id(), função SECURITY DEFINER → sem RLS aninhada),
--   mantendo o acesso original (admin/criador via visibilidade do evento).
-- =====================================================================

alter policy attendance_select on public.trx_event_attendance
using (
  id_user = current_user_id()
  or exists (
    select 1 from master_event e
    where e.id = trx_event_attendance.id_event
      and e.id_tenant = current_tenant_id()
  )
);

-- rollback (volta ao comportamento anterior, que tinha o bug):
-- alter policy attendance_select on public.trx_event_attendance
-- using (
--   exists (select 1 from master_event e
--           where e.id = trx_event_attendance.id_event
--             and e.id_tenant = current_tenant_id())
-- );
