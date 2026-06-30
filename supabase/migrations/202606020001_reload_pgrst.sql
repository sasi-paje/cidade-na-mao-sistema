-- Force PostgREST schema reload
SELECT pg_notify('pgrst', 'reload schema');