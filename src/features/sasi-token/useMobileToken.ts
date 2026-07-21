import { useParams } from 'react-router-dom'

/**
 * useMobileToken / withMobileToken — helpers do FLUXO MOBILE (`/m/:tenant/*`).
 *
 * O token SASI serve só para IDENTIFICAR a pessoa e criar/recuperar a sessão
 * Supabase — não define cargo/role nem qual fluxo abrir (isso é o LINK). O
 * `SasiSessionBoundary` global captura o token e o remove da URL logo após a
 * troca por sessão (o token não fica exposto na barra de endereço); a
 * continuidade entre telas se dá pela sessão Supabase.
 *
 * O TENANT vive no PATH (`/m/:tenant/...`), não na query. Os padrões de rota
 * (`USER_MOBILE_ROUTES`/`LEADER_MOBILE_ROUTES`) contêm o segmento `:tenant`;
 * `withMobileToken` substitui esse `:tenant` pelo slug do tenant atual (lido do
 * próprio path via `useParams`), de modo que a navegação entre telas preserva o
 * tenant sem precisar reanexar nada na query.
 */

/** Normaliza um slug de tenant (trim + lowercase). Vazio → null. */
function normalizeTenant(value: string | null | undefined): string | null {
  const slug = (value ?? '').trim().toLowerCase()
  return slug === '' ? null : slug
}

/** Lê o token de uma query string (`?token=`), útil fora de componentes. */
export function getTokenFromSearch(search: string): string | null {
  const token = (new URLSearchParams(search).get('token') ?? '').trim()
  return token === '' ? null : token
}

/**
 * Substitui o segmento `:tenant` de um path mobile pelo slug informado
 * (preservando query/hash já existentes). Sem tenant, retorna o path inalterado
 * — a rota `/m/:tenant/*` só casa com tenant presente, então isso é defensivo.
 */
export function withMobileToken(path: string, tenant: string | null | undefined): string {
  const slug = normalizeTenant(tenant)
  if (!slug) return path
  return path.replace(':tenant', encodeURIComponent(slug))
}

/**
 * Hook: tenant atual do fluxo mobile (do PATH). `tenant` é o slug normalizado
 * (ou null); `withMobileToken` substitui o `:tenant` do padrão de rota pelo slug
 * atual, preservando o tenant ao navegar entre telas.
 */
export function useMobileToken() {
  const params = useParams<{ tenant?: string }>()
  const tenant = normalizeTenant(params.tenant)
  return {
    /** Slug do tenant do path (normalizado) ou null. */
    tenant,
    /** Substitui `:tenant` no padrão de rota pelo slug do tenant atual. */
    withMobileToken: (path: string) => withMobileToken(path, tenant),
  }
}
