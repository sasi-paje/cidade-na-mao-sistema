import { useLocation, useNavigate } from 'react-router-dom'
import { usePublicEvents } from '../../../features/events'
import type { EventFullView } from '../../../features/events'
import { useMyAttendances } from '../../../features/event-attendance'
import { useCurrentUser } from '../../../features/auth'
import { useMobileToken } from '../../../features/sasi-token'
import { buildPath, USER_MOBILE_ROUTES, LEADER_MOBILE_ROUTES, isLeaderPath } from '../../../app/routes/routePaths'
import { formatDayMonthShort } from '../../../utils/eventDate'
import { EventCard } from './EventCard'
import { EventsTabs } from './EventsTabs'
import { EventsPanel } from './EventsPanel'
import { EventCalendarModal } from './EventCalendarModal'
import { useEventDateFilter } from './useEventDateFilter'

/** `/m/usuario/eventos` (e `/m/lider/eventos`) — lista de eventos aprovados (público) com filtro por data. */
export function PublicEventsPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { withMobileToken } = useMobileToken()
  const { masterUserId } = useCurrentUser()
  // Mantém o usuário no MESMO fluxo (líder ou usuário) ao abrir o detalhe.
  const isLeaderFlow = isLeaderPath(pathname)
  const detailPattern = isLeaderFlow
    ? LEADER_MOBILE_ROUTES.eventDetails
    : USER_MOBILE_ROUTES.eventDetails
  // Busca TODOS os eventos aprovados/ativos (inclusive passados) para alimentar o
  // calendário: a lista padrão mostra só os próximos (upcomingByDefault), mas ao
  // selecionar uma data passada o evento daquele dia aparece.
  const { data, loading, error } = usePublicEvents()
  const { data: attendances } = useMyAttendances(masterUserId)
  const { filterDay, open, setOpen, eventDateKeys, filtered, initialMonth, select, clear } =
    useEventDateFilter(data, { upcomingByDefault: true })

  // Marca no card os eventos em que o usuário já se inscreveu (id_event + id_slot).
  const confirmedKeys = new Set(attendances.map((a) => `${a.id_event}::${a.id_slot}`))

  const openEvent = (event: EventFullView) => {
    navigate(withMobileToken(buildPath(detailPattern, { id: event.id_event })))
  }

  return (
    <>
      <EventsTabs />

      <EventsPanel
        title="Eventos"
        showCalendar
        onCalendarClick={() => setOpen(true)}
        calendarLabel={filterDay ? formatDayMonthShort(filterDay) : undefined}
      >
        {loading && <p className="py-8 text-center text-[15px] text-[#919191]">Carregando eventos...</p>}

        {error && (
          <p className="py-8 text-center text-[15px] text-[#eb5757]">Não foi possível carregar os eventos.</p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <p className="py-10 text-center text-[15px] text-[#919191]">
            {filterDay ? 'Nenhum evento marcado para esta data' : 'Nenhum evento disponível no momento.'}
          </p>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-4">
            {filtered.map((event) => (
              <EventCard
                key={event.id_slot}
                event={event}
                onClick={openEvent}
                confirmed={confirmedKeys.has(`${event.id_event}::${event.id_slot}`)}
              />
            ))}
          </div>
        )}
      </EventsPanel>

      {open && (
        <EventCalendarModal
          value={filterDay}
          eventDateKeys={eventDateKeys}
          initialMonth={initialMonth}
          onSelect={select}
          onClear={clear}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
