/**
 * Captura do token SASI a partir da URL (deep-link), para `/m/*` e `/web/*`.
 *
 * O token chega como query param e é guardado em `sessionStorage` durante a
 * navegação SPA, sem permanecer visível na barra de endereço. Escopo aqui é só
 * **captura/armazenamento**: a validação contra a API SASI e a criação de
 * sessão Supabase são feitas na edge function / `sasi-auth.service`.
 *
 * Aliases aceitos, em ordem de prioridade (o caso principal é `?token=`):
 *   token → sasi-token → sasiToken → sasi-refresh-token → sasiRefreshToken
 *
 * Os dois últimos são **refresh tokens** (o backend faz refresh → access antes
 * de identificar o usuário); os três primeiros são tratados como **access
 * token** já emitido. Nunca usar `localStorage` — apenas `sessionStorage`.
 */

/** Tipo do token capturado: access (já emitido) ou refresh (precisa trocar). */
export type SasiTokenKind = 'access' | 'refresh'

/** Params de access token, em ordem de prioridade. */
const ACCESS_PARAMS = ['token', 'sasi-token', 'sasiToken'] as const
/** Params de refresh token, em ordem de prioridade. */
const REFRESH_PARAMS = ['sasi-refresh-token', 'sasiRefreshToken'] as const
/** Todos os aliases aceitos, na ordem oficial de prioridade. */
const ALL_PARAMS: readonly string[] = [...ACCESS_PARAMS, ...REFRESH_PARAMS]

/** Chaves do sessionStorage (valor + tipo do token capturado). */
const STORAGE_KEY = 'sasi-token'
const STORAGE_KIND_KEY = 'sasi-token-kind'

function readParams(search?: string): URLSearchParams | null {
  if (search === undefined && typeof window === 'undefined') return null
  return new URLSearchParams(search ?? window.location.search)
}

function kindForParam(param: string): SasiTokenKind {
  return (REFRESH_PARAMS as readonly string[]).includes(param) ? 'refresh' : 'access'
}

/**
 * Lê o token SASI dos query params informados (ou da URL atual), testando os
 * aliases em ordem de prioridade. Retorna o valor (string) ou null.
 */
export function getSasiTokenFromUrl(search?: string): string | null {
  const params = readParams(search)
  if (!params) return null
  for (const name of ALL_PARAMS) {
    const value = params.get(name)
    if (value && value.trim()) return value.trim()
  }
  return null
}

/**
 * Qual alias está presente na URL (e seu tipo), em ordem de prioridade.
 * Útil para escolher entre enviar `token` ou `refreshToken` à edge function e
 * para saber qual param remover da URL. null se nenhum.
 */
export function getSasiTokenParamFromUrl(
  search?: string,
): { param: string; value: string; kind: SasiTokenKind } | null {
  const params = readParams(search)
  if (!params) return null
  for (const name of ALL_PARAMS) {
    const value = params.get(name)
    if (value && value.trim()) {
      return { param: name, value: value.trim(), kind: kindForParam(name) }
    }
  }
  return null
}

/** Indica se há token SASI (qualquer alias) presente na URL. */
export function hasSasiToken(search?: string): boolean {
  return getSasiTokenFromUrl(search) !== null
}

/** Persiste o token capturado (e seu tipo) para uso posterior na sessão. */
export function storeSasiToken(token: string, kind: SasiTokenKind = 'access'): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token)
    window.sessionStorage.setItem(STORAGE_KIND_KEY, kind)
  } catch {
    // sessionStorage indisponível (modo privado/SSR) — ignora silenciosamente.
  }
}

/** Recupera o token previamente persistido (ou null). */
export function getStoredSasiToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Recupera o tipo do token persistido (default 'access' p/ compat). */
export function getStoredSasiTokenKind(): SasiTokenKind {
  if (typeof window === 'undefined') return 'access'
  try {
    return (window.sessionStorage.getItem(STORAGE_KIND_KEY) as SasiTokenKind) || 'access'
  } catch {
    return 'access'
  }
}

/** Remove o token persistido (valor + tipo). */
export function clearSasiToken(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
    window.sessionStorage.removeItem(STORAGE_KIND_KEY)
  } catch {
    // ignora
  }
}

/**
 * Token efetivo da sessão (string): prioriza o da URL (e o persiste, com tipo),
 * com fallback no que já estava guardado. Mantido por compatibilidade.
 */
export function resolveSasiToken(): string | null {
  const fromUrl = getSasiTokenParamFromUrl()
  if (fromUrl) {
    storeSasiToken(fromUrl.value, fromUrl.kind)
    return fromUrl.value
  }
  return getStoredSasiToken()
}

/**
 * Igual a `resolveSasiToken`, mas devolve também o tipo do token — usado pelo
 * provider para escolher entre `token` (access) e `refreshToken` ao chamar a
 * edge function.
 */
export function resolveSasiTokenWithKind(): { value: string; kind: SasiTokenKind } | null {
  const fromUrl = getSasiTokenParamFromUrl()
  if (fromUrl) {
    storeSasiToken(fromUrl.value, fromUrl.kind)
    return { value: fromUrl.value, kind: fromUrl.kind }
  }
  const stored = getStoredSasiToken()
  if (!stored) return null
  return { value: stored, kind: getStoredSasiTokenKind() }
}

/** Alias principal (compat). A lista completa fica em `SASI_TOKEN_PARAMS`. */
export const SASI_TOKEN_PARAM = 'sasi-token'
/** Todos os aliases aceitos, em ordem de prioridade. */
export const SASI_TOKEN_PARAMS = ALL_PARAMS
