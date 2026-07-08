import { supabase, hasSupabaseEnv, STORAGE_ENV_FOLDER } from '../../../lib/supabase/client'

/** Bucket público de banners de evento (imagens leves; ver migration do bucket). */
export const BANNER_BUCKET = 'event-banners'

/**
 * Garante que o `banner_url` seja uma URL leve do Storage.
 *
 * - `null`/vazio → `null`.
 * - Já é URL http(s) (ex.: banner não alterado, já migrado) → repassa como está.
 * - É data URI base64 (upload novo vindo do `BannerUploadField`) → sobe a imagem
 *   para o Supabase Storage e devolve a URL pública.
 *
 * Falha de upload LANÇA — o submit mostra erro; nunca cai de volta para gravar
 * base64 no banco (a razão de existir desta migração).
 *
 * Sem env do Supabase (dev/mock) mantém o data URI (o fluxo mock não usa Storage).
 */
export async function uploadBannerIfDataUri(
  bannerUrl: string | null | undefined,
): Promise<string | null> {
  if (!bannerUrl) return null
  if (!bannerUrl.startsWith('data:')) return bannerUrl
  if (!hasSupabaseEnv()) return bannerUrl

  const blob = await (await fetch(bannerUrl)).blob()
  const mime = blob.type || 'image/jpeg'
  const ext = (mime.split('/')[1] || 'jpg').split('+')[0] // image/svg+xml → svg
  const path = [STORAGE_ENV_FOLDER, 'events', `${crypto.randomUUID()}.${ext}`].join('/')

  const { error } = await supabase.storage
    .from(BANNER_BUCKET)
    .upload(path, blob, { contentType: mime, upsert: false })
  if (error) throw new Error(`Falha ao enviar o banner: ${error.message}`)

  return supabase.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl
}
