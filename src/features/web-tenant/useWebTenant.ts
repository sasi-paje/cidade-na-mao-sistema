import { useSearchParams } from 'react-router-dom'

/**
 * web-tenant — tenant do modo web público, lido SEMPRE da query string
 * (`?tenant=slug`). Fonte de verdade é a URL — nunca localStorage.
 */

/** Normaliza o slug (trim + lowercase). Vazio → null. */
function normalizeTenant(value: string | null | undefined): string | null {
  const slug = (value ?? '').trim().toLowerCase()
  return slug === '' ? null : slug
}

/** Lê o tenant de uma query string (`?tenant=`), útil fora de componentes. */
export function getTenantFromSearch(search: string): string | null {
  return normalizeTenant(new URLSearchParams(search).get('tenant'))
}

/**
 * Hook: tenant atual do modo web público (da URL). `tenant` é o slug
 * normalizado (ou null se ausente); `withTenant` preserva o `?tenant=` ao
 * navegar entre telas web.
 */
export function useWebTenant() {
  const [searchParams] = useSearchParams()
  const tenant = normalizeTenant(searchParams.get('tenant'))
  return {
    /** Slug do tenant (normalizado) ou null se não informado na URL. */
    tenant,
    /** Anexa `?tenant=slug` a um path, preservando o contexto do tenant. */
    withTenant: (path: string) => withTenant(path, tenant),
  }
}

/**
 * Anexa `?tenant=slug` a um path (preservando query existente). Sem tenant,
 * retorna o path inalterado. Usado para preservar o contexto na navegação web.
 */
export function withTenant(path: string, tenant: string | null | undefined): string {
  const slug = normalizeTenant(tenant)
  if (!slug) return path
  const [base, hash] = path.split('#')
  const sep = base.includes('?') ? '&' : '?'
  const withQuery = `${base}${sep}tenant=${encodeURIComponent(slug)}`
  return hash ? `${withQuery}#${hash}` : withQuery
}
