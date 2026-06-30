-- Permite que os fluxos mobile autenticados pelo SASI enviem evidencias.
-- Esses usuarios chegam ao app sem sessao Supabase Auth, entao o upload
-- direto para Storage usa a role anon.

insert into storage.buckets (
  id,
  name,
  "public",
  file_size_limit,
  allowed_mime_types
)
values (
  'bellog-files',
  'bellog-files',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set
  "public" = excluded."public",
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "bellog_files_public_read" on storage.objects;
create policy "bellog_files_public_read"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'bellog-files'
  and (
    name like 'routes/%'
    or name like 'canhotos/%'
    or name like 'nfd/%'
    or name like 'vehicles/%'
    or name like 'users/%'
    or name like 'providers/%'
    or name like 'customers/%'
    or name like 'fiscal_invoice/%'
  )
);

drop policy if exists "bellog_files_mobile_insert" on storage.objects;
create policy "bellog_files_mobile_insert"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'bellog-files'
  and (
    name like 'routes/%'
    or name like 'canhotos/%'
    or name like 'nfd/%'
    or name like 'vehicles/%'
    or name like 'users/%'
    or name like 'providers/%'
    or name like 'customers/%'
    or name like 'fiscal_invoice/%'
  )
);
