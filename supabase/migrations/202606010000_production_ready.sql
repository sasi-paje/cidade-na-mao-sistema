-- =====================================================
-- BELLOG PRODUCTION READINESS MIGRATION
-- =====================================================
-- This migration ensures the database is ready for production
-- All changes are idempotent (can be run multiple times safely)
-- =====================================================

-- =====================================================
-- 1. ADD is_initial TO ref_route_status
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ref_route_status'
      AND column_name = 'is_initial'
  ) THEN
    ALTER TABLE public.ref_route_status
    ADD COLUMN is_initial boolean NOT NULL DEFAULT false;

    COMMENT ON COLUMN public.ref_route_status.is_initial
      IS 'Se true, este é o status inicial padrão para novas rotas';
  END IF;
END $$;

-- =====================================================
-- 2. ADD is_initial TO ref_route_delivery_status
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ref_route_delivery_status'
      AND column_name = 'is_initial'
  ) THEN
    ALTER TABLE public.ref_route_delivery_status
    ADD COLUMN is_initial boolean NOT NULL DEFAULT false;

    COMMENT ON COLUMN public.ref_route_delivery_status.is_initial
      IS 'Se true, este é o status inicial padrão para novas rotas';
  END IF;
END $$;

-- =====================================================
-- 3. ADD allows_route_edition TO ref_route_delivery_status
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ref_route_delivery_status'
      AND column_name = 'allows_route_edition'
  ) THEN
    ALTER TABLE public.ref_route_delivery_status
    ADD COLUMN allows_route_edition boolean NOT NULL DEFAULT true;

    COMMENT ON COLUMN public.ref_route_delivery_status.allows_route_edition
      IS 'Se false, a rota não pode ter sua montagem (notas) alterada';
  END IF;
END $$;

-- =====================================================
-- 4. ADD is_test TO ref_route_responsible
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ref_route_responsible'
      AND column_name = 'is_test'
  ) THEN
    ALTER TABLE public.ref_route_responsible
    ADD COLUMN is_test boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- =====================================================
-- 5. ADD id_route_responsible TO trx_route
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trx_route'
      AND column_name = 'id_route_responsible'
  ) THEN
    ALTER TABLE public.trx_route
    ADD COLUMN id_route_responsible bigint NULL;

    COMMENT ON COLUMN public.trx_route.id_route_responsible
      IS 'FK para ref_route_responsible - responsável pela rota';

    -- Add FK if ref_route_responsible exists
    ALTER TABLE public.trx_route
    ADD CONSTRAINT fk_trx_route_responsible
    FOREIGN KEY (id_route_responsible) REFERENCES public.ref_route_responsible(id);
  END IF;
END $$;

-- =====================================================
-- 6. ADD attempt_number TO rel_route_invoice
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rel_route_invoice'
      AND column_name = 'attempt_number'
  ) THEN
    ALTER TABLE public.rel_route_invoice
    ADD COLUMN attempt_number integer NOT NULL DEFAULT 1;

    COMMENT ON COLUMN public.rel_route_invoice.attempt_number
      IS 'Número da tentativa desta nota nesta rota (1, 2, 3...)';
  END IF;
END $$;

-- =====================================================
-- 7. ADD release_fields TO rel_route_invoice
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rel_route_invoice'
      AND column_name = 'released_at'
  ) THEN
    ALTER TABLE public.rel_route_invoice
    ADD COLUMN released_at timestamp with time zone NULL;

    COMMENT ON COLUMN public.rel_route_invoice.released_at
      IS 'Quando a nota foi liberada da rota (por entrega, cancelamento, etc.)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rel_route_invoice'
      AND column_name = 'release_reason'
  ) THEN
    ALTER TABLE public.rel_route_invoice
    ADD COLUMN release_reason text NULL;

    COMMENT ON COLUMN public.rel_route_invoice.release_reason
      IS 'Motivo da liberação (entrega_total, entrega_parcial, negada, abortada, etc.)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rel_route_invoice'
      AND column_name = 'planned_box_quantity'
  ) THEN
    ALTER TABLE public.rel_route_invoice
    ADD COLUMN planned_box_quantity integer NULL;

    COMMENT ON COLUMN public.rel_route_invoice.planned_box_quantity
      IS 'Quantidade planejada de caixas para esta tentativa';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rel_route_invoice'
      AND column_name = 'planned_amount'
  ) THEN
    ALTER TABLE public.rel_route_invoice
    ADD COLUMN planned_amount numeric(12, 2) NULL;

    COMMENT ON COLUMN public.rel_route_invoice.planned_amount
      IS 'Valor planejado para esta tentativa';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rel_route_invoice'
      AND column_name = 'id_previous_route_invoice'
  ) THEN
    ALTER TABLE public.rel_route_invoice
    ADD COLUMN id_previous_route_invoice bigint NULL;

    COMMENT ON COLUMN public.rel_route_invoice.id_previous_route_invoice
      IS 'FK para rel_route_invoice anterior - permite rastrear cadeia de tentativas';
  END IF;
END $$;

-- =====================================================
-- 8. ADD id_route_invoice TO trx_route_invoice_delivery
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trx_route_invoice_delivery'
      AND column_name = 'id_route_invoice'
  ) THEN
    ALTER TABLE public.trx_route_invoice_delivery
    ADD COLUMN id_route_invoice bigint NULL;

    COMMENT ON COLUMN public.trx_route_invoice_delivery.id_route_invoice
      IS 'FK para rel_route_invoice - vincula o resultado à tentativa específica';
  END IF;
END $$;

-- =====================================================
-- 9. ADD is_test TO trx_route_invoice_delivery
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trx_route_invoice_delivery'
      AND column_name = 'is_test'
  ) THEN
    ALTER TABLE public.trx_route_invoice_delivery
    ADD COLUMN is_test boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- =====================================================
-- 10. CREATE UNIQUE INDEX FOR is_initial
-- =====================================================
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_route_status_initial
  ON public.ref_route_status(is_test) WHERE is_initial = true;
EXCEPTION WHEN others THEN
  -- Index may already exist, ignore error
END $$;

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_route_delivery_status_initial
  ON public.ref_route_delivery_status(is_test) WHERE is_initial = true;
EXCEPTION WHEN others THEN
  -- Index may already exist, ignore error
END $$;

-- =====================================================
-- 11. ADD UNIQUE CONSTRAINT FOR vehicle+date route
-- =====================================================
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_trx_route_vehicle_date_active
  ON public.trx_route(id_vehicle, departure_date, is_test)
  WHERE is_active = true;
EXCEPTION WHEN others THEN
  -- Index may already exist, ignore error
END $$;

-- =====================================================
-- 12. ADD INDEXES FOR COMMON QUERIES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_rel_route_invoice_route_active
ON public.rel_route_invoice(id_route) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_rel_route_invoice_invoice_active
ON public.rel_route_invoice(id_fiscal_invoice) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_trx_route_invoice_delivery_route
ON public.trx_route_invoice_delivery(id_route);

CREATE INDEX IF NOT EXISTS idx_trx_route_invoice_delivery_invoice
ON public.trx_route_invoice_delivery(id_fiscal_invoice);

-- =====================================================
-- 13. CREATE ref_fiscal_invoice_status TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ref_fiscal_invoice_status (
  id bigint generated always as identity not null,
  code text not null,
  name text not null,
  description text null,
  is_active boolean not null default true,
  is_test boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null,
  constraint ref_fiscal_invoice_status_pkey primary key (id),
  constraint ref_fiscal_invoice_status_code_key unique (code, is_test)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ref_fiscal_invoice_status_updated_at'
  ) THEN
    CREATE TRIGGER trg_ref_fiscal_invoice_status_updated_at
    BEFORE UPDATE ON ref_fiscal_invoice_status
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- =====================================================
-- 14. SEED ref_fiscal_invoice_status
-- =====================================================
INSERT INTO public.ref_fiscal_invoice_status (code, name, description, is_test)
VALUES
  ('DISPONIVEL', 'Disponível', 'Nota disponível para atribuição a rotas', false),
  ('EM_ROTA', 'Em Rota', 'Nota vinculada a uma rota ativa', false),
  ('ENTREGUE', 'Entregue', 'Nota entregue com sucesso', false),
  ('PARCIAL_PENDENTE', 'Parcial Pendente', 'Entrega parcial, saldo pendente para reentrega', false),
  ('NEGADA_REPROGRAMAR', 'Negada Reprogramar', 'Entrega negada, pode ser reprogramada', false),
  ('ABORTADA_REPROGRAMAR', 'Abortada Reprogramar', 'Entrega abortada, pode ser reprogramada', false),
  ('CANCELADA', 'Cancelada', 'Nota cancelada', false)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 15. CREATE ref_delivery_reason_type WITH BEHAVIOR FIELDS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ref_delivery_reason_type (
  id bigint generated always as identity not null,
  code text not null,
  name text not null,
  description text null,
  id_result_invoice_status bigint null,
  releases_to_available boolean not null default false,
  finalizes_invoice boolean not null default false,
  uses_returned_balance boolean not null default false,
  requires_reason boolean not null default false,
  is_active boolean not null default true,
  is_test boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null,
  constraint ref_delivery_reason_type_pkey primary key (id),
  constraint ref_delivery_reason_type_code_key unique (code, is_test)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ref_delivery_reason_type_updated_at'
  ) THEN
    CREATE TRIGGER trg_ref_delivery_reason_type_updated_at
    BEFORE UPDATE ON ref_delivery_reason_type
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- =====================================================
-- 16. SEED ref_delivery_reason_type
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ref_delivery_reason_type'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE public.ref_delivery_reason_type ADD COLUMN description text null;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ref_delivery_reason_type'
      AND column_name = 'id_result_invoice_status'
  ) THEN
    ALTER TABLE public.ref_delivery_reason_type ADD COLUMN id_result_invoice_status bigint null;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ref_delivery_reason_type'
      AND column_name = 'releases_to_available'
  ) THEN
    ALTER TABLE public.ref_delivery_reason_type ADD COLUMN releases_to_available boolean not null default false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ref_delivery_reason_type'
      AND column_name = 'finalizes_invoice'
  ) THEN
    ALTER TABLE public.ref_delivery_reason_type ADD COLUMN finalizes_invoice boolean not null default false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ref_delivery_reason_type'
      AND column_name = 'uses_returned_balance'
  ) THEN
    ALTER TABLE public.ref_delivery_reason_type ADD COLUMN uses_returned_balance boolean not null default false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ref_delivery_reason_type'
      AND column_name = 'requires_reason'
  ) THEN
    ALTER TABLE public.ref_delivery_reason_type ADD COLUMN requires_reason boolean not null default false;
  END IF;
END $$;

INSERT INTO public.ref_delivery_reason_type (code, name, id_result_invoice_status, releases_to_available, finalizes_invoice, uses_returned_balance, requires_reason, is_test)
VALUES
  ('ENTREGA_TOTAL', 'Entrega Total', (SELECT id FROM public.ref_fiscal_invoice_status WHERE code = 'ENTREGUE' LIMIT 1), false, true, false, false, false),
  ('ENTREGA_PARCIAL', 'Entrega Parcial', (SELECT id FROM public.ref_fiscal_invoice_status WHERE code = 'PARCIAL_PENDENTE' LIMIT 1), true, false, true, false, false),
  ('ENTREGA_NEGADA', 'Entrega Negada', (SELECT id FROM public.ref_fiscal_invoice_status WHERE code = 'NEGADA_REPROGRAMAR' LIMIT 1), true, false, false, true, false),
  ('ENTREGA_ABORTADA', 'Entrega Abortada', (SELECT id FROM public.ref_fiscal_invoice_status WHERE code = 'ABORTADA_REPROGRAMAR' LIMIT 1), true, false, false, true, false)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 17. MARK INITIAL STATUSES IN ref_route_status
-- =====================================================
UPDATE public.ref_route_status SET is_initial = true WHERE code = 'pending';
UPDATE public.ref_route_status SET is_initial = true WHERE name ilike '%Pendente%' AND is_initial = false;

-- =====================================================
-- 18. MARK INITIAL STATUSES AND ALLOWS_EDITION IN ref_route_delivery_status
-- =====================================================
UPDATE public.ref_route_delivery_status SET is_initial = true WHERE code = 'pending';
UPDATE public.ref_route_delivery_status SET is_initial = true WHERE name ilike '%Pendente%' AND is_initial = false;

UPDATE public.ref_route_delivery_status SET allows_route_edition = true WHERE code = 'pending';
UPDATE public.ref_route_delivery_status SET allows_route_edition = false WHERE code IN ('in_progress', 'completed');

-- =====================================================
-- 19. ADD FOREIGN KEYS IF MISSING IN rel_route_invoice
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_rel_route_invoice_route'
  ) THEN
    ALTER TABLE public.rel_route_invoice
    ADD CONSTRAINT fk_rel_route_invoice_route
    FOREIGN KEY (id_route) REFERENCES public.trx_route(id);
  END IF;
EXCEPTION WHEN others THEN
  -- FK may already exist
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_rel_route_invoice_invoice'
  ) THEN
    ALTER TABLE public.rel_route_invoice
    ADD CONSTRAINT fk_rel_route_invoice_invoice
    FOREIGN KEY (id_fiscal_invoice) REFERENCES public.trx_fiscal_invoice(id);
  END IF;
EXCEPTION WHEN others THEN
  -- FK may already exist
END $$;

-- =====================================================
-- 20. ADD FK TO trx_route_invoice_delivery
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_trx_route_invoice_delivery_route'
  ) THEN
    ALTER TABLE public.trx_route_invoice_delivery
    ADD CONSTRAINT fk_trx_route_invoice_delivery_route
    FOREIGN KEY (id_route) REFERENCES public.trx_route(id);
  END IF;
EXCEPTION WHEN others THEN
  -- FK may already exist
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_trx_route_invoice_delivery_invoice'
  ) THEN
    ALTER TABLE public.trx_route_invoice_delivery
    ADD CONSTRAINT fk_trx_route_invoice_delivery_invoice
    FOREIGN KEY (id_fiscal_invoice) REFERENCES public.trx_fiscal_invoice(id);
  END IF;
EXCEPTION WHEN others THEN
  -- FK may already exist
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_trx_route_invoice_delivery_route_invoice'
  ) THEN
    ALTER TABLE public.trx_route_invoice_delivery
    ADD CONSTRAINT fk_trx_route_invoice_delivery_route_invoice
    FOREIGN KEY (id_route_invoice) REFERENCES public.rel_route_invoice(id);
  END IF;
EXCEPTION WHEN others THEN
  -- FK may already exist
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.ref_fiscal_invoice_status IS 'Status possíveis para notas fiscais';
COMMENT ON TABLE public.ref_delivery_reason_type IS 'Tipos de resultado de entrega com comportamento';
COMMENT ON TABLE public.rel_route_invoice IS 'Vínculo planejado entre rota e nota - cada aparição é uma tentativa';
COMMENT ON TABLE public.trx_route_invoice_delivery IS 'Resultado da entrega de uma tentativa específica';

COMMENT ON COLUMN public.ref_route_delivery_status.allows_route_edition IS
  'Se false, a montagem da rota (notas) não pode ser alterada durante entrega';
COMMENT ON COLUMN public.rel_route_invoice.attempt_number IS
  'Número sequencial da tentativa desta nota (1, 2, 3...)';
COMMENT ON COLUMN public.rel_route_invoice.id_previous_route_invoice IS
  'Permite rastrear a cadeia de tentativas da mesma nota ao longo do tempo';