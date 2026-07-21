/**
 * MobileTokenRoute — guard ÚNICO das rotas `/m/*` (usuário comum e líder).
 *
 * Regra de negócio: o LINK acessado define o fluxo; o token só IDENTIFICA a
 * pessoa e cria/recupera a sessão. Portanto este guard:
 *   - NÃO valida cargo/role;
 *   - NÃO bloqueia rota de líder nem de usuário comum por perfil;
 *   - apenas exige uma sessão/token válido (mostra loading durante a troca
 *     SASI → sessão e erro amigável se não houver acesso válido).
 *
 * Tenant no PATH (`/m/:tenant/...`): a URL mobile é sempre escopada por tenant,
 * mas quem AUTORIZA é a sessão (RLS/RPCs). Assim:
 *   - o `:tenant` do path precisa casar com o slug OU o nome do tenant da sessão;
 *   - se divergir, bloqueamos (fail-closed) — a URL nunca sobrepõe a sessão.
 *
 * URLs mobile SEM tenant (`/m/usuario/*`, `/m/lider/*`, `/`) não chegam aqui:
 * são resolvidas antes pelo `MobileTenantInjector`, que injeta o slug da sessão
 * no path. A autorização efetiva de dados continua no backend (RLS/RPCs) pela
 * sessão. O token é capturado/limpo da URL pelo `SasiSessionBoundary` global.
 */
import { Outlet, useParams } from 'react-router-dom'
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

export function MobileTokenRoute() {
  const { loading, isAuthenticated, tenantSlug, tenantName } = useCurrentUser()
  const sasi = useSasiAuth()
  const { tenant } = useParams<{ tenant?: string }>()

  // Aguarda a resolução da sessão Supabase e a troca SASI em andamento.
  if (loading || sasi.loading) {
    return (
      <Centered>
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#1e558b] border-t-transparent" />
      </Centered>
    )
  }

  // Sem sessão válida (token ausente/ inválido) → erro amigável. Nunca por role.
  if (!isAuthenticated) return <InvalidAccess />

  // Tenant do PATH x tenant da sessão. A sessão é a fonte de verdade.
  const pathTenant = normalizeTenant(tenant)
  const sessionSlug = normalizeTenant(tenantSlug)
  const sessionName = normalizeTenant(tenantName)

  // Defensivo: a rota `/m/:tenant/*` só casa com tenant presente. Sem tenant no
  // path, segue sem escopo explícito — a RLS decide.
  if (!pathTenant) return <Outlet />

  // O `:tenant` do path precisa casar com o slug OU o nome do tenant da sessão
  // (mesma semântica do web). Divergência → bloqueia (fail-closed).
  const matchesSession = pathTenant === sessionSlug || pathTenant === sessionName
  if (!matchesSession) {
    return <InvalidAccess message="Este link é de outra comunidade. Abra pelo app SASI." />
  }

  return <Outlet />
}
