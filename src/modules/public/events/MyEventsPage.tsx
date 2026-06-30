import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePublicEvents } from '../../../features/events'
import type { EventFullView } from '../../../features/events'
import { useMyAttendances } from '../../../features/event-attendance'
import { useCurrentUser } from '../../../features/auth'
import { buildPath, PUBLIC_ROUTES } from '../../../app/routes/routePaths'
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

/** `/m/meus-eventos` — participações confirmadas do usuário autenticado. */
export function MyEventsPage() {
  const navigate = useNavigate()
  const { masterUserId } = useCurrentUser()
  const { data: attendances, loading: loadingAtt, error: errorAtt } = useMyAttendances(masterUserId ?? '')
  const { data: allEvents, loading: loadingEvents, error: errorEvents } = usePublicEvents()
  const [showPast, setShowPast] = useState(false)

  const loading = loadingAtt || loadingEvents
  const error = errorAtt || errorEvents

  // Cruza participações (id_event + id_slot) com a view completa dos eventos.
  const confirmedKeys = new Set(attendances.map((a) => `${a.id_event}::${a.id_slot}`))
  const now = Date.now()
  const myEvents = allEvents
    .filter((e) => confirmedKeys.has(`${e.id_event}::${e.id_slot}`))
    .filter((e) => {
      if (showPast) return true
      const t = new Date(e.requested_at).getTime()
      return Number.isNaN(t) || t >= now
    })

  const openEvent = (event: EventFullView) => {
    navigate(buildPath(PUBLIC_ROUTES.eventDetails, { id: event.id_event }))
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

        {!loading && !error && myEvents.length === 0 && (
          <p className="py-12 text-center text-[15px] font-bold text-[#919191]">Nenhum evento</p>
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
