import { useSearchParams } from 'react-router-dom'

/**
 * useMobileToken / withMobileToken — helpers do FLUXO MOBILE (`/m/*`).
 *
 * O token SASI serve só para IDENTIFICAR a pessoa e criar/recuperar a sessão
 * Supabase — não define cargo/role nem qual fluxo abrir (isso é o LINK). Estes
 * helpers preservam o `?token=` na navegação mobile quando ele está presente na
 * URL. Observação de segurança: o `SasiSessionBoundary` global captura o token
 * e o remove da URL logo após a troca por sessão (o token não fica exposto na
 * barra de endereço); a continuidade entre telas se dá pela sessão Supabase.
 * `withMobileToken` reanexa o token apenas enquanto ele existe na URL.
 */

/** Normaliza o token (vazio → null). */
function normalizeToken(value: string | null | undefined): string | null {
  const token = (value ?? '').trim()
  return token === '' ? null : token
}

/** Lê o token de uma query string (`?token=`), útil fora de componentes. */
export function getTokenFromSearch(search: string): string | null {
  return normalizeToken(new URLSearchParams(search).get('token'))
}

/**
 * Anexa `?token=slug` a um path (preservando query existente). Sem token,
 * retorna o path inalterado. Usado para preservar o token na navegação mobile.
 */
export function withMobileToken(path: string, token: string | null | undefined): string {
  const value = normalizeToken(token)
  if (!value) return path
  const [base, hash] = path.split('#')
  const sep = base.includes('?') ? '&' : '?'
  const withQuery = `${base}${sep}token=${encodeURIComponent(value)}`
  return hash ? `${withQuery}#${hash}` : withQuery
}

/**
 * Hook: token atual do fluxo mobile (da URL). `token` é o valor normalizado
 * (ou null); `withMobileToken` preserva o `?token=` ao navegar entre telas.
 */
export function useMobileToken() {
  const [searchParams] = useSearchParams()
  const token = normalizeToken(searchParams.get('token'))
  return {
    /** Token da URL (normalizado) ou null. */
    token,
    /** Anexa `?token=` a um path, preservando o token na navegação. */
    withMobileToken: (path: string) => withMobileToken(path, token),
  }
}
