-- =====================================================================
-- Limpeza de eventos de carga (homologação) — SOFT-DELETE
-- Projeto: tfupwytzrkpzocfxheeq
--
-- Problema: a view pública `v_public_approved_events` (fonte de /m/eventos)
-- retorna 2.764 "Evento de Carga N" (dados de teste de carga) contra apenas
-- 19 eventos reais. O feed usa `order by requested_at asc` + `limit 100`, então
-- as 100 primeiras linhas são todas de carga e os eventos reais (aprovados,
-- ativos e futuros) NUNCA aparecem na lista.
--
-- Solução: soft-delete (is_active = false) dos eventos de carga. Eles saem da
-- view pública imediatamente (a view tem `where e.is_active = true`), sem DELETE
-- e de forma reversível. NÃO altera slots, presença nem equipamentos.
--
-- Rodar no SQL Editor do Supabase (admin) OU via CLI linkada.
-- =====================================================================

-- (1) CONFERÊNCIA — quantos serão afetados (esperado: ~2.764)
select count(*) as carga_ativos
from public.master_event
where title like 'Evento de Carga%'
  and is_active = true;

-- (2) SOFT-DELETE dos eventos de carga
update public.master_event
   set is_active = false,
       updated_at = now()
 where title like 'Evento de Carga%'
   and is_active = true;

-- (3) VERIFICAÇÃO — o que sobra no feed público (esperado: só eventos reais)
select id, title, is_active
from public.master_event
where is_active = true
  and title not like 'Evento de Carga%'
order by title;

-- =====================================================================
-- ROLLBACK (se precisar trazer a carga de volta)
-- update public.master_event
--    set is_active = true, updated_at = now()
--  where title like 'Evento de Carga%';
-- =====================================================================
