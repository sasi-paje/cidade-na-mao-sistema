import { Route } from 'react-router-dom'
import { MobileLayout } from '../layouts/MobileLayout'
import { ProtectedMobileRoute } from './ProtectedMobileRoute'
import { PublicEventsPage } from '../../modules/public/events/PublicEventsPage'
import { PublicEventDetailsPage } from '../../modules/public/events/PublicEventDetailsPage'
import { MyEventsPage } from '../../modules/public/events/MyEventsPage'
import { MyEventRequestsPage } from '../../modules/community-leader/event-requests/pages/MyEventRequestsPage'
import { RequestEventPage } from '../../modules/community-leader/event-requests/pages/RequestEventPage'
import { EventRequestDetailsPage } from '../../modules/community-leader/event-requests/pages/EventRequestDetailsPage'
import { PUBLIC_ROUTES, LEADER_ROUTES } from './routePaths'

/**
 * Rotas da área pública/mobile (`/m/*`) sob o MobileLayout.
 *  - Público/anônimo: lista e detalhe de eventos aprovados.
 *  - Exige login (qualquer role): meus-eventos.
 *  - Exige login + community_leader: fluxo do líder.
 */
export function PublicRoutes() {
  return (
    <Route element={<MobileLayout />}>
      {/* Público/anônimo */}
      <Route path={PUBLIC_ROUTES.events} element={<PublicEventsPage />} />
      <Route path={PUBLIC_ROUTES.eventDetails} element={<PublicEventDetailsPage />} />

      {/* Exige login (qualquer role autenticada) */}
      <Route element={<ProtectedMobileRoute requireAuth />}>
        <Route path={PUBLIC_ROUTES.myEvents} element={<MyEventsPage />} />
      </Route>

      {/* Exige login + community_leader */}
      <Route element={<ProtectedMobileRoute requireAuth allowedRoles={['community_leader']} />}>
        <Route path={LEADER_ROUTES.requestedEvents} element={<MyEventRequestsPage />} />
        <Route path={LEADER_ROUTES.requestEvent} element={<RequestEventPage />} />
        <Route path={LEADER_ROUTES.requestedEventDetails} element={<EventRequestDetailsPage />} />
      </Route>
    </Route>
  )
}
