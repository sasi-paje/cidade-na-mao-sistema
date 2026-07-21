import { Routes, Route, Navigate } from 'react-router-dom'
import { PublicRoutes } from './PublicRoutes'
import { AdminRoutes } from './AdminRoutes'
import { AccessRequired } from './AccessRequired'
import { USER_MOBILE_ROUTES, stripTenant } from './routePaths'

/** Entrada mobile SEM tenant (o `MobileTenantInjector` injeta o slug da sessão). */
const MOBILE_ENTRY = stripTenant(USER_MOBILE_ROUTES.events)

/** Tela 404 simples. */
function NotFound() {
  return (
    <div className="min-h-dvh w-full bg-[#f0f4f9] flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-[22px] font-bold text-[#0f3255]">Página não encontrada</h1>
        <p className="mt-2 text-[14px] text-[#919191]">
          O endereço acessado não existe.{' '}
          <a href={MOBILE_ENTRY} className="font-semibold text-[#1e558b]">
            Ir para eventos
          </a>
        </p>
      </div>
    </div>
  )
}

/**
 * Composição raiz do roteamento (react-router).
 *  - `/`        → redireciona para /m/eventos
 *  - `/m/*`     → área pública/mobile (público + líder)
 *  - `/web/*`   → área admin/web (login via token SASI)
 *  - `/login`, `/reset-password` → tela neutra de acesso SASI
 *    (sem e-mail/senha, sem reset manual, sem login legado)
 *  - `*`        → 404
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={MOBILE_ENTRY} replace />} />

      {PublicRoutes()}
      {AdminRoutes()}

      {/* Login/recuperação por e-mail/senha saíram do projeto SASI: ambas as
          rotas legadas mostram a tela neutra de acesso (sem UI legada). */}
      <Route path="/login" element={<AccessRequired />} />
      <Route path="/reset-password" element={<AccessRequired />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
