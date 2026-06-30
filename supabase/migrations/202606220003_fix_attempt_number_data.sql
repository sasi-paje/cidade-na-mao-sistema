-- =====================================================
-- FIX: Recalcula attempt_number em rel_route_invoice
-- Registros criados antes da RPC de atribuição foram
-- inseridos com attempt_number = 0 (padrão).
-- Corrige usando ROW_NUMBER por invoice, ordenado por
-- created_at ASC (ordem cronológica das tentativas).
-- =====================================================

UPDATE public.rel_route_invoice AS t
SET attempt_number = sub.rn
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY id_fiscal_invoice
      ORDER BY created_at ASC
    ) AS rn
  FROM public.rel_route_invoice
) AS sub
WHERE t.id = sub.id
  AND t.attempt_number = 0;

-- Recarrega schema do PostgREST
NOTIFY pgrst, 'reload schema';
