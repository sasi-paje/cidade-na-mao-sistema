/**
 * MobileTenantInjector — resolve URLs mobile SEM tenant no path.
 *
 * Com o tenant no PATH (`/m/:tenant/...`), links que chegam sem o segmento de
 * tenant (`/m/usuario/*`, `/m/lider/*`, redirects de `/` e legados) não casam
 * com a rota canônica. Este componente injeta o slug do tenant da SESSÃO no
 * path e redireciona, preservando o restante do caminho e a query.
 *
 *   /m/usuario/eventos            (sessão: borba)  →  /m/borba/usuario/eventos
 *   /m/lider/eventos-solicitados  (sessão: borba)  →  /m/borba/lider/eventos-solicitados
 *
 * Fail-closed: sem sessão válida (ou sessão sem tenant) → "Acesso inválido".
 * Não há fallback via `?tenant=` — o tenant vem sempre da sessão ou do path.
 * O token é capturado/limpo da URL pelo `SasiSessionBoundary` global.
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useCurrentUser } from '../../features/auth'
import { useSasiAuth } from '../../features/sasi-token'

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center p-6">{children}</div>
}

function InvalidAccess({ message }: { message?: string }) {
  return (
    <Centered>
      <div className="max-w-[360px] text-center">
        <h1 className="text-[20px] font-bold text-[#0f3255]">Acesso inválido</h1>
        <p className="mt-2 text-[14px] text-[#919191]">
          {message ?? 'Abra esta tela pelo link do aplicativo SASI.'}
        </p>
      </div>
    </Centered>
  )
}

/** Normaliza um slug/nome de tenant (trim + lowercase). Vazio → null. */
function normalizeTenant(value: string | null | undefined): string | null {
  const slug = (value ?? '').trim().toLowerCase()
  return slug === '' ? null : slug
}

export function MobileTenantInjector() {
  const { loading, isAuthenticated, tenantSlug } = useCurrentUser()
  const sasi = useSasiAuth()
  const { pathname, search } = useLocation()

  // Aguarda a resolução da sessão Supabase e a troca SASI em andamento.
  if (loading || sasi.loading) {
    return (
      <Centered>
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#1e558b] border-t-transparent" />
      </Centered>
    )
  }

  // Sem sessão válida (token ausente/inválido) → erro amigável. Nunca por role.
  if (!isAuthenticated) return <InvalidAccess />

  const slug = normalizeTenant(tenantSlug)
  // Sessão sem tenant não permite montar o path escopado — bloqueia (fail-closed).
  if (!slug) {
    return <InvalidAccess message="Sua conta não está associada a uma comunidade. Abra pelo app SASI." />
  }

  // Injeta o slug logo após `/m/`, preservando o restante do path e a query.
  const target = pathname.replace(/^\/m\//, `/m/${slug}/`)
  return <Navigate to={{ pathname: target, search }} replace />
}
