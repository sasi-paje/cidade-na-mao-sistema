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
 * A autorização efetiva de dados continua no backend (RLS/RPCs) pela sessão.
 * O token é capturado/limpo da URL pelo `SasiSessionBoundary` global.
 */
import { Outlet } from 'react-router-dom'
import { useCurrentUser } from '../../features/auth'
import { useSasiAuth } from '../../features/sasi-token'

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center p-6">{children}</div>
}

function InvalidAccess() {
  return (
    <Centered>
      <div className="max-w-[360px] text-center">
        <h1 className="text-[20px] font-bold text-[#0f3255]">Acesso inválido</h1>
        <p className="mt-2 text-[14px] text-[#919191]">
          Abra esta tela pelo link do aplicativo SASI.
        </p>
      </div>
    </Centered>
  )
}

export function MobileTokenRoute() {
  const { loading, isAuthenticated } = useCurrentUser()
  const sasi = useSasiAuth()

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

  return <Outlet />
}
