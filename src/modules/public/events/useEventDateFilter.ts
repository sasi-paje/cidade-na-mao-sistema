import { useMemo, useState } from 'react'
import type { EventFullView } from '../../../features/events'
import { toDayKey, dateToDayKey } from '../../../utils/eventDate'

interface EventDateFilterOptions {
  /**
   * Quando true, a lista SEM filtro de data mostra só eventos de hoje/futuros.
   * Os passados NÃO somem do dataset: continuam marcados no calendário (ponto) e
   * aparecem ao selecionar a data correspondente. Feed público de "próximos";
   * telas admin/líder deixam false (padrão) para ver tudo por padrão.
   */
  upcomingByDefault?: boolean
}

/**
 * Estado e derivações do filtro de data (calendário) para listas de eventos.
 * Filtra por dia local; expõe os dias com eventos (para os pontos no grid) e
 * um mês inicial útil (o do evento mais próximo) para abrir o calendário.
 */
export function useEventDateFilter(events: EventFullView[], options?: EventDateFilterOptions) {
  const upcomingByDefault = options?.upcomingByDefault ?? false
  const [filterDay, setFilterDay] = useState<Date | null>(null)
  const [open, setOpen] = useState(false)

  const startOfToday = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])

  // Dias com evento (pontos no calendário): SEMPRE de todos os eventos —
  // inclusive passados — para que datas passadas fiquem marcadas e selecionáveis.
  const eventDateKeys = useMemo(() => {
    const set = new Set<string>()
    for (const e of events) {
      const key = toDayKey(e.requested_at)
      if (key) set.add(key)
    }
    return set
  }, [events])

  const filtered = useMemo(() => {
    if (filterDay) {
      // Data selecionada: mostra os eventos daquele dia (passado OU futuro).
      const key = dateToDayKey(filterDay)
      return events.filter((e) => toDayKey(e.requested_at) === key)
    }
    if (!upcomingByDefault) return events
    // Sem filtro: só hoje/futuros (data inválida não some da tela).
    return events.filter((e) => {
      const t = new Date(e.requested_at).getTime()
      return Number.isNaN(t) || t >= startOfToday
    })
  }, [events, filterDay, upcomingByDefault, startOfToday])

  const initialMonth = useMemo(() => {
    let earliest: Date | null = null
    let earliestUpcoming: Date | null = null
    for (const e of events) {
      const d = new Date(e.requested_at)
      if (Number.isNaN(d.getTime())) continue
      if (!earliest || d < earliest) earliest = d
      if (d.getTime() >= startOfToday && (!earliestUpcoming || d < earliestUpcoming)) earliestUpcoming = d
    }
    // Feed de próximos abre no mês do próximo evento (evita abrir em datas antigas);
    // demais telas mantêm o comportamento original (mês do evento mais antigo).
    return upcomingByDefault ? earliestUpcoming ?? earliest : earliest
  }, [events, startOfToday, upcomingByDefault])

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
