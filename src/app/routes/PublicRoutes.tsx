import { Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { MobileLayout } from '../layouts/MobileLayout'
import { MobileTokenRoute } from './MobileTokenRoute'
import { MobileTenantInjector } from './MobileTenantInjector'
import { PublicEventsPage } from '../../modules/public/events/PublicEventsPage'
import { PublicEventDetailsPage } from '../../modules/public/events/PublicEventDetailsPage'
import { MyEventsPage } from '../../modules/public/events/MyEventsPage'
import { MyEventRequestsPage } from '../../modules/community-leader/event-requests/pages/MyEventRequestsPage'
import { RequestEventPage } from '../../modules/community-leader/event-requests/pages/RequestEventPage'
import { EventRequestDetailsPage } from '../../modules/community-leader/event-requests/pages/EventRequestDetailsPage'
import {
  USER_MOBILE_ROUTES,
  LEADER_MOBILE_ROUTES,
  PUBLIC_ROUTES,
  LEADER_ROUTES,
  stripTenant,
} from './routePaths'

/**
 * Redirect de compatibilidade das rotas legadas `/m/*` → `/m/usuario/*` ou
 * `/m/lider/*`, PRESERVANDO a query string (`?token=`) e o `:id`.
 */
function LegacyRedirect({ to }: { to: string }) {
  const params = useParams()
  const { search } = useLocation()
  const pathname = Object.entries(params).reduce<string>(
    (acc, [key, value]) => (value ? acc.replace(`:${key}`, value) : acc),
    to,
  )
  return <Navigate to={{ pathname, search }} replace />
}

/**
 * Rotas da área mobile (`/m/*`) sob o MobileLayout.
 *
 * DOIS FLUXOS separados pelo LINK (não por cargo/role):
 *  - Usuário comum: `/m/:tenant/usuario/*`
 *  - Líder de comunidade: `/m/:tenant/lider/*`
 *
 * O tenant vive no PATH. Rotas canônicas exigem `:tenant` e passam pelo guard
 * `MobileTokenRoute` (só token/sessão, nunca role). URLs mobile SEM tenant
 * (`/m/usuario/*`, `/m/lider/*`, redirects legados) caem no `MobileTenantInjector`,
 * que injeta o slug do tenant da sessão no path.
 */
export function PublicRoutes() {
  return (
    <Route element={<MobileLayout />}>
      {/* Guard único: só token/sessão, nunca role. Tenant no path (`:tenant`). */}
      <Route element={<MobileTokenRoute />}>
        {/* Fluxo de usuário comum */}
        <Route path={USER_MOBILE_ROUTES.events} element={<PublicEventsPage />} />
        <Route path={USER_MOBILE_ROUTES.eventDetails} element={<PublicEventDetailsPage />} />
        <Route path={USER_MOBILE_ROUTES.myEvents} element={<MyEventsPage />} />

        {/* Fluxo de líder de comunidade */}
        <Route path={LEADER_MOBILE_ROUTES.requestedEvents} element={<MyEventRequestsPage />} />
        <Route path={LEADER_MOBILE_ROUTES.requestedEventDetails} element={<EventRequestDetailsPage />} />
        <Route path={LEADER_MOBILE_ROUTES.requestEvent} element={<RequestEventPage />} />
        <Route path={LEADER_MOBILE_ROUTES.events} element={<PublicEventsPage />} />
        <Route path={LEADER_MOBILE_ROUTES.eventDetails} element={<PublicEventDetailsPage />} />
        <Route path={LEADER_MOBILE_ROUTES.myEvents} element={<MyEventsPage />} />
      </Route>

      {/* Injetor de tenant: paths mobile SEM tenant → injeta o slug da sessão.
          Cobre qualquer sub-path (splat) dos dois fluxos, preservando query. */}
      <Route path="/m/usuario/*" element={<MobileTenantInjector />} />
      <Route path="/m/lider/*" element={<MobileTenantInjector />} />

      {/* Redirects de compatibilidade (legados sem prefixo → path sem tenant;
          o injetor acima completa com o slug da sessão). Preservam `:id`/query. */}
      <Route path={PUBLIC_ROUTES.events} element={<LegacyRedirect to={stripTenant(USER_MOBILE_ROUTES.events)} />} />
      <Route path={PUBLIC_ROUTES.eventDetails} element={<LegacyRedirect to={stripTenant(USER_MOBILE_ROUTES.eventDetails)} />} />
      <Route path={PUBLIC_ROUTES.myEvents} element={<LegacyRedirect to={stripTenant(USER_MOBILE_ROUTES.myEvents)} />} />
      <Route path={LEADER_ROUTES.requestedEvents} element={<LegacyRedirect to={stripTenant(LEADER_MOBILE_ROUTES.requestedEvents)} />} />
      <Route path={LEADER_ROUTES.requestedEventDetails} element={<LegacyRedirect to={stripTenant(LEADER_MOBILE_ROUTES.requestedEventDetails)} />} />
      <Route path={LEADER_ROUTES.requestEvent} element={<LegacyRedirect to={stripTenant(LEADER_MOBILE_ROUTES.requestEvent)} />} />
    </Route>
  )
}
