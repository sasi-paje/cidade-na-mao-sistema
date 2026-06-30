-- Force PostgREST schema cache reload
DO $$
BEGIN
  -- Just notify to reload - no actual change
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

-- Reset PostgREST connection pool to pick up new schema
SELECT pg_notify('pgrst', 'reload');