-- =====================================================
-- FIX rel_route_invoice AND RELATED STRUCTURE
-- =====================================================

-- 1. Remove attempt_number from trx_fiscal_invoice
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trx_fiscal_invoice'
      AND column_name = 'attempt_number'
  ) THEN
    ALTER TABLE public.trx_fiscal_invoice DROP COLUMN attempt_number;
  END IF;
END $$;

-- 2. Add id_previous_route_invoice FK to rel_route_invoice
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rel_route_invoice'
      AND column_name = 'id_previous_route_invoice'
  ) THEN
    ALTER TABLE public.rel_route_invoice ADD COLUMN id_previous_route_invoice bigint NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_rel_route_invoice_previous'
  ) THEN
    ALTER TABLE public.rel_route_invoice
    ADD CONSTRAINT fk_rel_route_invoice_previous
    FOREIGN KEY (id_previous_route_invoice) REFERENCES public.rel_route_invoice(id);
  END IF;
END $$;

-- 3. Fix blocking index - drop old and create new
DROP INDEX IF EXISTS public.ux_rel_route_invoice_active_invoice_test;

CREATE UNIQUE INDEX IF NOT EXISTS ux_rel_route_invoice_blocking_invoice_test
ON public.rel_route_invoice (id_fiscal_invoice, is_test)
WHERE is_active = true
  AND released_at IS NULL;

-- 4. Alter planned_amount to numeric(14,2)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rel_route_invoice'
      AND column_name = 'planned_amount'
  ) THEN
    ALTER TABLE public.rel_route_invoice ALTER COLUMN planned_amount TYPE numeric(14,2);
  END IF;
END $$;

-- 5. Add comment for id_previous_route_invoice
COMMENT ON COLUMN public.rel_route_invoice.id_previous_route_invoice IS
  'FK para rel_route_invoice anterior - rastreia cadeia de tentativas da mesma nota';

-- 6. Reload PostgREST schema
SELECT pg_notify('pgrst', 'reload schema');