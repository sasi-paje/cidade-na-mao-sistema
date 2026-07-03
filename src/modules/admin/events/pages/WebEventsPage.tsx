import { useMemo, useState } from 'react'
import { useWebEvents } from '../../../../features/events'
import type { EventFullView } from '../../../../features/events'
import { formatDayMonthShort } from '../../../../utils/eventDate'
import { useEventDateFilter } from '../../../public/events/useEventDateFilter'
import { WebEventsToolbar } from '../components/WebEventsToolbar'
import { WebEventsPagination } from '../components/WebEventsPagination'
import { WebEventCard } from '../components/WebEventCard'
import { NewEventModal } from '../components/NewEventModal'
import { EditEventModal } from '../components/EditEventModal'
import { WebEventDetailsDrawer } from '../components/WebEventDetailsDrawer'
import { useToast, ToastContainer } from '../../../../shared/components'
import { useWebTenant } from '../../../../features/web-tenant'

const PAGE_SIZE = 9

/** `/web/eventos` — listagem web/admin de eventos. */
export function WebEventsPage() {
  const { tenant } = useWebTenant()
  const { data: allEvents, loading, error, refetch } = useWebEvents(undefined, tenant)

  // Filtro por data (calendário) — reaproveita a lógica do mobile.
  const { filterDay, eventDateKeys, filtered: byDate, initialMonth, select, clear } =
    useEventDateFilter(allEvents)

  const [search, setSearch] = useState('')
  const [onlyPending, setOnlyPending] = useState(false)
  const [page, setPage] = useState(1)
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventFullView | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const { toasts, showToast, removeToast } = useToast()

  // Filtro combinado (frontend): data + busca por título + apenas pendentes.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return byDate
      .filter((e) => (q ? e.title.toLowerCase().includes(q) : true))
      .filter((e) => (onlyPending ? e.slot_status === 'pending' : true))
  }, [byDate, search, onlyPending])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  // Qualquer mudança de filtro reseta a paginação para a primeira página.
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }
  const handleTogglePending = (value: boolean) => {
    setOnlyPending(value)
    setPage(1)
  }
  const handleSelectDate = (day: Date) => {
    select(day)
    setPage(1)
  }
  const handleClearDate = () => {
    clear()
    setPage(1)
  }

  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const openInfo = (event: EventFullView) => {
    setSelectedEventId(event.id_event)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
      <WebEventsToolbar
        search={search}
        onSearchChange={handleSearchChange}
        onSearchSubmit={() => { /* filtro é aplicado em tempo real */ }}
        calendar={{
          label: filterDay ? formatDayMonthShort(filterDay) : undefined,
          value: filterDay,
          eventDateKeys,
          initialMonth,
          onSelect: handleSelectDate,
          onClear: handleClearDate,
        }}
        onlyPending={onlyPending}
        onTogglePending={handleTogglePending}
        onAddNew={() => setIsNewEventModalOpen(true)}
        pagination={
          <WebEventsPagination
            page={currentPage}
            totalPages={totalPages}
            onFirst={() => setPage(1)}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            onLast={() => setPage(totalPages)}
          />
        }
      />

      </div>

      <section className="mt-5 flex-1 overflow-y-auto">
        {loading && <p className="py-10 text-center text-[14px] text-[#919191]">Carregando eventos...</p>}

        {error && (
          <p className="py-10 text-center text-[14px] text-[#eb5757]">Não foi possível carregar os eventos.</p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <p className="py-10 text-center text-[14px] text-[#919191]">
            {filterDay ? 'Nenhum evento nesta data.' : 'Nenhum evento encontrado.'}
          </p>
        )}

        {!loading && !error && pageItems.length > 0 && (
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((event) => (
              <WebEventCard
                key={event.id_slot}
                event={event}
                onOpenInfo={openInfo}
                onEdit={(e) => setEditingEvent(e)}
              />
            ))}
          </div>
        )}
      </section>

      <NewEventModal
        open={isNewEventModalOpen}
        onClose={() => setIsNewEventModalOpen(false)}
        onSaved={() => { void refetch() }}
      />

      <EditEventModal
        key={editingEvent?.id_event ?? 'none'}
        event={editingEvent}
        open={editingEvent !== null}
        onClose={() => setEditingEvent(null)}
        onSaved={() => { void refetch() }}
        onNotify={showToast}
      />

      {/* Detalhe abre como drawer SOBRE a lista (sem trocar de rota). */}
      {selectedEventId && (
        <WebEventDetailsDrawer
          key={selectedEventId}
          eventId={selectedEventId}
          onClose={() => { setSelectedEventId(null); void refetch() }}
          onNotify={showToast}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
