-- Ensure route responsible reference table and trx_route FK exist.
-- This migration is idempotent - only runs if needed

create table if not exists public.ref_route_responsible (
  id bigint generated always as identity primary key,
  name text not null,
  slug text null,
  description text null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null
);

alter table public.trx_route
  add column if not exists id_route_responsible bigint;

-- Only update id_route_responsible if the responsible text column exists
DO $$
BEGIN
  -- Check if responsible column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trx_route'
      AND column_name = 'responsible'
  ) THEN
    -- Safe update using text comparison
    UPDATE public.trx_route
    SET id_route_responsible = responsible_ref.id
    FROM public.ref_route_responsible responsible_ref
    WHERE public.trx_route.id_route_responsible IS NULL
      AND public.trx_route.responsible IS NOT NULL
      AND lower(public.trx_route.responsible) = lower(responsible_ref.name);
  ELSE
    RAISE NOTICE 'Column responsible does not exist, skipping update';
  END IF;
END $$;

-- Add NOT NULL constraint only if column exists and has data
DO $$
BEGIN
  -- Check if column exists and has values
  IF EXISTS (
    SELECT 1 FROM public.trx_route
    WHERE id_route_responsible IS NULL
    LIMIT 1
  ) THEN
    -- Cannot set NOT NULL if there are NULLs, do nothing
    RAISE NOTICE 'Cannot set NOT NULL - there are still NULL values';
  ELSE
    -- No NULLs, we can set NOT NULL safely
    ALTER TABLE public.trx_route
      ALTER COLUMN id_route_responsible SET NOT NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not set NOT NULL: %', SQLERRM;
END $$;

-- Add FK constraint if not exists
DO $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_trx_route_route_responsible'
  ) then
    alter table public.trx_route
      add constraint fk_trx_route_route_responsible
      foreign key (id_route_responsible)
      references public.ref_route_responsible (id);
  end if;
end $$;