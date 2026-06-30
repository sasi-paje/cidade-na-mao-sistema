-- =====================================================
-- FIX: allows_route_edition data correction
-- Regra: SOMENTE Pendente permite edição de montagem.
-- Pendente = true | Em Andamento / Concluída / Cancelada / Abortada = false
--
-- Estratégia segura (fail-closed):
--   1. Zera tudo para false
--   2. Ativa somente onde code/name/description indica Pendente
-- =====================================================

-- Passo 1: Bloqueia todos (fail-closed)
UPDATE public.ref_route_delivery_status
SET allows_route_edition = false;

-- Passo 2: Libera apenas Pendente (por code, name ou description — robusto contra variação de dados)
UPDATE public.ref_route_delivery_status
SET allows_route_edition = true
WHERE is_active = true
  AND (
    lower(code)        IN ('pending', 'pendente')
    OR lower(name)        IN ('pending', 'pendente')
    OR lower(description) IN ('pending', 'pendente')
  );

-- Passo 3: Garante que is_test rows sigam a mesma regra
UPDATE public.ref_route_delivery_status
SET allows_route_edition = true
WHERE is_test = true
  AND (
    lower(code)        IN ('pending', 'pendente')
    OR lower(name)        IN ('pending', 'pendente')
    OR lower(description) IN ('pending', 'pendente')
  );

-- Passo 4: Recarrega cache do PostgREST para refletir os dados imediatamente
SELECT pg_notify('pgrst', 'reload schema');
