import { Route } from 'react-router-dom'
import { AdminWebLayout } from '../layouts/AdminWebLayout'
import { WebTenantBoundary } from './WebTenantBoundary'
import { ADMIN_ROUTES } from './routePaths'
import { WebEventsPage } from '../../modules/admin/events/pages/WebEventsPage'
import { WebEventDetailsPage } from '../../modules/admin/events/pages/WebEventDetailsPage'
import { WebEquipmentPage } from '../../modules/admin/equipment/pages/WebEquipmentPage'

/**
 * Rotas da área admin/web (`/web/*`) — MODO WEB PÚBLICO POR TENANT (definitivo).
 *
 * Regra de negócio: as telas web NÃO têm login próprio, token SASI obrigatório,
 * AccessRequired nem AccessDenied. Quem tiver a URL do tenant opera aquele
 * tenant. O `WebTenantBoundary` apenas exige um `?tenant=` válido na URL — não
 * há dependência de sessão Supabase nem role admin no frontend.
 *
 * O isolamento por tenant é feito no backend pelas RPCs `web_*_by_tenant`
 * (EXECUTE liberado a anon/authenticated); as RPCs admin_* continuam restritas
 * a authenticated e nunca são chamadas pelo modo web.
 */
export function AdminRoutes() {
  return (
    <Route element={<WebTenantBoundary />}>
      <Route element={<AdminWebLayout />}>
        <Route path={ADMIN_ROUTES.events} element={<WebEventsPage />} />
        <Route path={ADMIN_ROUTES.eventDetails} element={<WebEventDetailsPage />} />
        <Route path={ADMIN_ROUTES.equipment} element={<WebEquipmentPage />} />
      </Route>
    </Route>
  )
}
