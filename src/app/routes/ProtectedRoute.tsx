/**
 * ProtectedRoute — guarda de rotas da área admin/web (`/web/*`).
 *
 * Autenticação web é via token SASI (deep-link `?sasi-token=...`), igual ao
 * mobile — NÃO há mais login de e-mail/senha aqui.
 *
 * Regras:
 *  - enquanto o contexto carrega OU a troca SASI está em andamento → "validando
 *    acesso" (nunca redireciona para /login)
 *  - sem sessão Supabase após a validação → tela neutra `AccessRequired`
 *  - autenticado sem admin (ou sem cadastro) → "acesso restrito" amigável
 *  - admin → renderiza as rotas filhas (<Outlet/>)
 *
 * `/m/*` (público) NÃO usa este guard.
 */
import { Outlet, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../../features/auth'
import { signOut } from '../../features/auth'
import { useSasiAuth } from '../../features/sasi-token'
import { AccessRequired } from './AccessRequired'

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-[#f0f4f9] flex items-center justify-center p-6">
      {children}
    </div>
  )
}

function AccessDenied() {
  const navigate = useNavigate()
  return (
    <FullScreen>
      <div className="max-w-[420px] text-center">
        <h1 className="text-[22px] font-bold text-[#0f3255]">Acesso restrito</h1>
        <p className="mt-2 text-[14px] text-[#919191]">
          Sua conta está autenticada, mas não tem permissão de administrador para esta área.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/m/eventos', { replace: true })}
            className="rounded-[6px] bg-[#1e558b] px-4 py-2 text-[14px] font-semibold text-white"
          >
            Ir para eventos
          </button>
          <button
            type="button"
            onClick={async () => { await signOut(); navigate('/login', { replace: true }) }}
            className="rounded-[6px] border border-[#1e558b] px-4 py-2 text-[14px] font-semibold text-[#1e558b]"
          >
            Sair
          </button>
        </div>
      </div>
    </FullScreen>
  )
}

export function ProtectedRoute({ requireAdmin = true }: { requireAdmin?: boolean }) {
  const { loading, isAuthenticated, isAdmin } = useCurrentUser()
  const sasi = useSasiAuth()

  // Aguarda a resolução do contexto e/ou uma troca SASI em andamento, para não
  // decidir o acesso antes de a sessão Supabase ser emitida.
  if (loading || sasi.loading) {
    return (
      <FullScreen>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1e558b] border-t-transparent rounded-full animate-spin" />
          <span className="text-[14px] text-[#5b6675]">Validando acesso…</span>
        </div>
      </FullScreen>
    )
  }

  // Autorização é sempre pela sessão Supabase real (SASI é só login).
  // Sem sessão → tela neutra (sem formulário de login legado), nunca /login.
  if (!isAuthenticated) {
    return <AccessRequired />
  }

  if (requireAdmin && !isAdmin) {
    return <AccessDenied />
  }

  return <Outlet />
}
