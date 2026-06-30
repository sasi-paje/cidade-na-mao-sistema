import { Route } from 'react-router-dom'
import { AdminWebLayout } from '../layouts/AdminWebLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { ADMIN_ROUTES } from './routePaths'
import { WebEventsPage } from '../../modules/admin/events/pages/WebEventsPage'
import { WebEventDetailsPage } from '../../modules/admin/events/pages/WebEventDetailsPage'
import { WebEquipmentPage } from '../../modules/admin/equipment/pages/WebEquipmentPage'

/**
 * Rotas da área admin/web (`/web/*`).
 *  - A captura/troca do token SASI (`?token=...` e aliases) é feita pelo
 *    `SasiSessionBoundary` global (em `main.tsx`), acima de todas as rotas.
 *  - `ProtectedRoute` (exige sessão + role admin) → `AdminWebLayout`.
 */
export function AdminRoutes() {
  return (
    <Route element={<ProtectedRoute requireAdmin />}>
      <Route element={<AdminWebLayout />}>
        <Route path={ADMIN_ROUTES.events} element={<WebEventsPage />} />
        <Route path={ADMIN_ROUTES.eventDetails} element={<WebEventDetailsPage />} />
        <Route path={ADMIN_ROUTES.equipment} element={<WebEquipmentPage />} />
      </Route>
    </Route>
  )
}
