import { useNavigate } from 'react-router-dom'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { useEventRequests } from '../../../../features/events'
import type { EventFullView } from '../../../../features/events'
import { useCurrentUser } from '../../../../features/auth'
import { buildPath, LEADER_ROUTES } from '../../../../app/routes/routePaths'
import { formatDayMonthShort } from '../../../../utils/eventDate'
import { EventsTabs } from '../../../public/events/EventsTabs'
import { EventsPanel } from '../../../public/events/EventsPanel'
import { EventCalendarModal } from '../../../public/events/EventCalendarModal'
import { useEventDateFilter } from '../../../public/events/useEventDateFilter'
import { EventRequestCard } from '../components/EventRequestCard'

/** `/m/eventos-solicitados` — solicitações de evento do líder (sessão real). */
export function MyEventRequestsPage() {
  const navigate = useNavigate()
  const { masterUserId } = useCurrentUser()
  const { data, loading, error } = useEventRequests(masterUserId ?? '')
  const { filterDay, open, setOpen, eventDateKeys, filtered, initialMonth, select, clear } =
    useEventDateFilter(data)

  const openDetails = (request: EventFullView) => {
    navigate(buildPath(LEADER_ROUTES.requestedEventDetails, { id: request.id_event }))
  }

  return (
    <>
      <EventsTabs />

      <EventsPanel
        title="Eventos Solicitados"
        showCalendar
        onCalendarClick={() => setOpen(true)}
        calendarLabel={filterDay ? formatDayMonthShort(filterDay) : undefined}
      >
        {loading && <p className="py-8 text-center text-[15px] text-[#919191]">Carregando...</p>}

        {error && (
          <p className="py-8 text-center text-[15px] text-[#eb5757]">Não foi possível carregar as solicitações.</p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <p className="py-10 text-center text-[15px] text-[#919191]">
            {filterDay ? 'Nenhum evento marcado para esta data' : 'Nenhum evento solicitado'}
          </p>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-4">
            {filtered.map((request) => (
              <EventRequestCard key={request.id_slot} request={request} onOpenDetails={openDetails} />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate(LEADER_ROUTES.requestEvent)}
          className="mt-1 flex h-[46px] flex-row items-center justify-center gap-2 rounded-[8px] bg-[#1e558b] text-[15px] font-bold text-white"
        >
          <MaterialIcon name="note_add" size={20} />
          Solicitar Evento
        </button>
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
