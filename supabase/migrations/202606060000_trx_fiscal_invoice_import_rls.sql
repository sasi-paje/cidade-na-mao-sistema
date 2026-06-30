-- RLS policies for trx_fiscal_invoice_import
-- The table already has RLS enabled. These policies allow the app (anon + authenticated)
-- to create import batches, read back the generated id, and mark batches inactive.

-- INSERT: create the import batch before processing files
drop policy if exists "anon_insert_trx_fiscal_invoice_import" on public.trx_fiscal_invoice_import;
create policy "anon_insert_trx_fiscal_invoice_import"
on public.trx_fiscal_invoice_import
for insert
to anon, authenticated
with check (true);

-- SELECT: return the id after insert (required by .select('id').single())
drop policy if exists "anon_select_trx_fiscal_invoice_import" on public.trx_fiscal_invoice_import;
create policy "anon_select_trx_fiscal_invoice_import"
on public.trx_fiscal_invoice_import
for select
to anon, authenticated
using (true);

-- UPDATE: mark batch as is_active = false when no notes were imported
drop policy if exists "anon_update_trx_fiscal_invoice_import" on public.trx_fiscal_invoice_import;
create policy "anon_update_trx_fiscal_invoice_import"
on public.trx_fiscal_invoice_import
for update
to anon, authenticated
using (true)
with check (true);
