import { Outlet } from 'react-router-dom'

/**
 * Layout da área admin/web (`/web/*`) — somente o corpo da página.
 *
 * A navbar/topbar (título "Cidade na Mão — Painel", links Eventos/Equipamentos,
 * usuário e botão Sair) foi removida da visualização. As rotas seguem
 * acessíveis por URL (`/web/eventos`, `/web/eventos/:id`, `/web/equipamentos`)
 * e a proteção admin continua no `ProtectedRoute`, acima deste layout.
 */
export function AdminWebLayout() {
  return (
    <div className="h-dvh w-full overflow-hidden bg-white">
      <main className="h-full overflow-hidden p-6">
        <Outlet />
      </main>
    </div>
  )
}
