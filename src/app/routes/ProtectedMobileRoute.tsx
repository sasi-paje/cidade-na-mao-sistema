/**
 * ProtectedMobileRoute — guard das rotas `/m/*` que exigem sessão/role.
 *
 * Diferente do ProtectedRoute (web/admin), aqui o padrão é mostrar CTA amigável
 * (em vez de redirecionar direto), preservando a navegação mobile.
 *
 *  - requireAuth (default true): exige sessão.
 *  - allowedRoles: se informado, exige que `role` esteja na lista
 *    (ex.: ['community_leader']). Sem isso, qualquer autenticado passa.
 *
 * Autorização é SEMPRE pela sessão Supabase real (`useCurrentUser`). O token
 * SASI é apenas mecanismo de login: enquanto a troca SASI → sessão acontece
 * (`useSasiAuth().loading`), mostramos o spinner para evitar flicker; ao
 * concluir, o `AuthProvider` já reflete a sessão e o gate decide normalmente.
 *
 * Rotas públicas (`/m/eventos`, `/m/eventos/:id`) NÃO usam este guard.
 */
import { Outlet, useNavigate } from 'react-router-dom'
import { useCurrentUser, type UserRole } from '../../features/auth'
import { useSasiAuth } from '../../features/sasi-token'

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center p-6">{children}</div>
}

function LoginNeeded() {
  return (
    <Centered>
      <div className="max-w-[360px] text-center">
        <h1 className="text-[20px] font-bold text-[#0f3255]">Acesso pelo app SASI</h1>
        <p className="mt-2 text-[14px] text-[#919191]">
          Esta área abre pelo link do aplicativo SASI.
        </p>
      </div>
    </Centered>
  )
}

function RoleRestricted() {
  const navigate = useNavigate()
  return (
    <Centered>
      <div className="max-w-[360px] text-center">
        <h1 className="text-[20px] font-bold text-[#0f3255]">Acesso restrito</h1>
        <p className="mt-2 text-[14px] text-[#919191]">
          Esta área é exclusiva para líderes comunitários.
        </p>
        <button
          type="button"
          onClick={() => navigate('/m/eventos')}
          className="mt-5 rounded-[6px] bg-[#1e558b] px-5 py-2 text-[14px] font-semibold text-white"
        >
          Ir para eventos
        </button>
      </div>
    </Centered>
  )
}

export function ProtectedMobileRoute({
  requireAuth = true,
  allowedRoles,
}: {
  requireAuth?: boolean
  allowedRoles?: UserRole[]
}) {
  const { loading, isAuthenticated, role } = useCurrentUser()
  const sasi = useSasiAuth()

  // Aguarda tanto a resolução Supabase quanto a troca SASI em andamento.
  if (loading || sasi.loading) {
    return (
      <Centered>
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#1e558b] border-t-transparent" />
      </Centered>
    )
  }

  // Fonte única de autorização: sessão Supabase real.
  if (requireAuth && !isAuthenticated) return <LoginNeeded />
  if (allowedRoles && (!role || !allowedRoles.includes(role))) return <RoleRestricted />

  return <Outlet />
}
