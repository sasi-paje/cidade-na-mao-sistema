-- Garante o bucket usado pela Edge Function register-route-arrival.
-- O upload e feito pela Edge Function com SUPABASE_SERVICE_ROLE_KEY.

insert into storage.buckets (
  id,
  name,
  "public",
  file_size_limit,
  allowed_mime_types
)
values (
  'route-arrivals',
  'route-arrivals',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  "public" = excluded."public",
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();
