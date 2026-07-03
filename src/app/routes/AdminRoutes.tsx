import { Route } from 'react-router-dom'
import { AdminWebLayout } from '../layouts/AdminWebLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { WebTenantBoundary } from './WebTenantBoundary'
import { ADMIN_ROUTES } from './routePaths'
import { isWebPublicMode } from '../../lib/supabase/client'
import { WebEventsPage } from '../../modules/admin/events/pages/WebEventsPage'
import { WebEventDetailsPage } from '../../modules/admin/events/pages/WebEventDetailsPage'
import { WebEquipmentPage } from '../../modules/admin/equipment/pages/WebEquipmentPage'

/**
 * Rotas da área admin/web (`/web/*`).
 *  - A captura/troca do token SASI (`?token=...`) é feita pelo
 *    `SasiSessionBoundary` global (em `main.tsx`), acima de todas as rotas.
 *  - MODO WEB PÚBLICO (`VITE_WEB_PUBLIC_MODE=true`): sem login/sessão — o
 *    `WebTenantBoundary` valida o `?tenant=` da URL e libera as telas.
 *  - MODO PADRÃO: `ProtectedRoute` (exige sessão + role admin).
 */
export function AdminRoutes() {
  const guard = isWebPublicMode() ? <WebTenantBoundary /> : <ProtectedRoute requireAdmin />
  return (
    <Route element={guard}>
      <Route element={<AdminWebLayout />}>
        <Route path={ADMIN_ROUTES.events} element={<WebEventsPage />} />
        <Route path={ADMIN_ROUTES.eventDetails} element={<WebEventDetailsPage />} />
        <Route path={ADMIN_ROUTES.equipment} element={<WebEquipmentPage />} />
      </Route>
    </Route>
  )
}
