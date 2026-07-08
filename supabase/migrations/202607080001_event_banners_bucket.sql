-- =====================================================================
-- Bucket de banners de evento (Storage) — substitui base64 na coluna
-- master_event.banner_url por URL pública leve.
-- Projeto: tfupwytzrkpzocfxheeq
--
-- Segue o padrão já provado do bucket `bellog-files`: bucket público, limite
-- de tamanho e MIME de imagem, com read público e insert para sessões válidas.
-- Caminhos por ambiente: `test/events/%` e `prod/events/%` (ver STORAGE_ENV_FOLDER).
--
-- NÃO altera master_event, RLS de tabelas, RPCs nem views — banner_url continua
-- text; muda apenas o CONTEÚDO gravado (URL em vez de data URI).
-- =====================================================================

insert into storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
values (
  'event-banners',
  'event-banners',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']::text[]
)
on conflict (id) do update
set "public" = excluded."public",
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública (banners de evento são públicos por natureza).
drop policy if exists "event_banners_public_read" on storage.objects;
create policy "event_banners_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'event-banners');

-- Upload: sessões válidas (líder/admin via sessão SASI = authenticated; e anon,
-- para o modo web público por tenant), restrito ao prefixo events/.
drop policy if exists "event_banners_insert" on storage.objects;
create policy "event_banners_insert"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'event-banners'
  and (name like 'test/events/%' or name like 'prod/events/%')
);

-- =====================================================================
-- ROLLBACK (manual)
-- drop policy if exists "event_banners_public_read" on storage.objects;
-- drop policy if exists "event_banners_insert" on storage.objects;
-- delete from storage.buckets where id = 'event-banners';  -- só se vazio
-- =====================================================================
