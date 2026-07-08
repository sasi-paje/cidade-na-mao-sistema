import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePublicEvents } from '../../../features/events'
import type { EventFullView } from '../../../features/events'
import { useMyAttendances } from '../../../features/event-attendance'
import { useCurrentUser } from '../../../features/auth'
import { useMobileToken } from '../../../features/sasi-token'
import { buildPath, USER_MOBILE_ROUTES, LEADER_MOBILE_ROUTES } from '../../../app/routes/routePaths'
import { EventCard } from './EventCard'
import { EventsTabs } from './EventsTabs'
import { EventsPanel } from './EventsPanel'

/** Toggle no estilo do guia ("Mostrar eventos passados"). */
function PastToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-row items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className="relative h-[22px] w-[42px] shrink-0 rounded-full transition-colors"
        style={{ background: on ? '#1E558B' : '#C9CFD8' }}
      >
        <span
          className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-[left]"
          style={{ left: on ? '22px' : '2px' }}
        />
      </button>
      <span className="text-[14px]" style={{ fontWeight: on ? 700 : 400, color: on ? '#2a2a2a' : '#919191' }}>
        Mostrar eventos passados
      </span>
    </div>
  )
}

/** `/m/usuario/meus-eventos` (e `/m/lider/meus-eventos`) — participações confirmadas do usuário autenticado. */
export function MyEventsPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { withMobileToken } = useMobileToken()
  // Mantém o usuário no MESMO fluxo (líder ou usuário) ao abrir o detalhe.
  const isLeaderFlow = pathname.startsWith('/m/lider')
  const detailPattern = isLeaderFlow
    ? LEADER_MOBILE_ROUTES.eventDetails
    : USER_MOBILE_ROUTES.eventDetails
  const { masterUserId } = useCurrentUser()
  const { data: attendances, loading: loadingAtt, error: errorAtt } = useMyAttendances(masterUserId)
  const { data: allEvents, loading: loadingEvents, error: errorEvents } = usePublicEvents()
  // Mostra todos os eventos confirmados por padrão (inclui passados); o toggle
  // permite ocultar os que já aconteceram, evitando "Meus Eventos" vazio quando
  // a participação é em evento que já passou.
  const [showPast, setShowPast] = useState(true)

  const loading = loadingAtt || loadingEvents
  const error = errorAtt || errorEvents

  // Cruza participações (id_event + id_slot) com a view completa dos eventos.
  const confirmedKeys = new Set(attendances.map((a) => `${a.id_event}::${a.id_slot}`))
  const now = Date.now()
  // Todos os eventos confirmados do usuário (sem filtro de data).
  const confirmedAll = allEvents.filter((e) => confirmedKeys.has(`${e.id_event}::${e.id_slot}`))
  const myEvents = confirmedAll.filter((e) => {
    if (showPast) return true
    const t = new Date(e.requested_at).getTime()
    return Number.isNaN(t) || t >= now
  })
  // Eventos confirmados ocultos só pelo filtro "futuros" (já aconteceram).
  const hiddenPastCount = confirmedAll.length - myEvents.length

  const openEvent = (event: EventFullView) => {
    navigate(withMobileToken(buildPath(detailPattern, { id: event.id_event })))
  }

  return (
    <>
      <EventsTabs />

      <EventsPanel
        title="Meus Eventos"
        headerExtra={<PastToggle on={showPast} onToggle={() => setShowPast((v) => !v)} />}
      >
        {loading && <p className="py-8 text-center text-[15px] text-[#919191]">Carregando...</p>}

        {error && (
          <p className="py-8 text-center text-[15px] text-[#eb5757]">Não foi possível carregar seus eventos.</p>
        )}

        {!loading && !error && !masterUserId && (
          <p className="py-12 text-center text-[15px] font-bold text-[#919191]">
            Acesse pelo app SASI para ver seus eventos.
          </p>
        )}

        {!loading && !error && masterUserId && myEvents.length === 0 && (
          hiddenPastCount > 0 ? (
            <p className="py-12 text-center text-[14px] text-[#919191]">
              {hiddenPastCount === 1
                ? 'Sua participação confirmada é em um evento que já aconteceu. Ative "Mostrar eventos passados" acima para vê-la.'
                : `Suas ${hiddenPastCount} participações confirmadas são em eventos que já aconteceram. Ative "Mostrar eventos passados" acima para vê-las.`}
            </p>
          ) : (
            <p className="py-12 text-center text-[15px] font-bold text-[#919191]">Nenhum evento</p>
          )
        )}

        {!loading && !error && myEvents.length > 0 && (
          <div className="flex flex-col gap-4">
            {myEvents.map((event) => (
              <EventCard key={event.id_slot} event={event} onClick={openEvent} confirmed />
            ))}
          </div>
        )}
      </EventsPanel>
    </>
  )
}
