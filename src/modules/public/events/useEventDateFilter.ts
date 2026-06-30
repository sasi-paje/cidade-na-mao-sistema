import { useMemo, useState } from 'react'
import type { EventFullView } from '../../../features/events'
import { toDayKey, dateToDayKey } from '../../../utils/eventDate'

/**
 * Estado e derivações do filtro de data (calendário) para listas de eventos.
 * Filtra por dia local; expõe os dias com eventos (para os pontos no grid) e
 * um mês inicial útil (o do evento mais próximo) para abrir o calendário.
 */
export function useEventDateFilter(events: EventFullView[]) {
  const [filterDay, setFilterDay] = useState<Date | null>(null)
  const [open, setOpen] = useState(false)

  const eventDateKeys = useMemo(() => {
    const set = new Set<string>()
    for (const e of events) {
      const key = toDayKey(e.requested_at)
      if (key) set.add(key)
    }
    return set
  }, [events])

  const filtered = useMemo(() => {
    if (!filterDay) return events
    const key = dateToDayKey(filterDay)
    return events.filter((e) => toDayKey(e.requested_at) === key)
  }, [events, filterDay])

  const initialMonth = useMemo(() => {
    let earliest: Date | null = null
    for (const e of events) {
      const d = new Date(e.requested_at)
      if (!Number.isNaN(d.getTime()) && (!earliest || d < earliest)) earliest = d
    }
    return earliest
  }, [events])

  return {
    filterDay,
    setFilterDay,
    open,
    setOpen,
    eventDateKeys,
    filtered,
    initialMonth,
    select: (day: Date) => {
      setFilterDay(day)
      setOpen(false)
    },
    clear: () => {
      setFilterDay(null)
      setOpen(false)
    },
  }
}
