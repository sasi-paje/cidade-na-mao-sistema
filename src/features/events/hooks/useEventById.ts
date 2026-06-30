import { useCallback, useEffect, useState } from 'react'
import type { EventFullView } from '../types/event.types'
import { getEventById } from '../api/events.service'

/** Detalhe (view agregada) de um evento por id. */
export function useEventById(idEvent: string | null | undefined) {
  const [data, setData] = useState<EventFullView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!idEvent) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await getEventById(idEvent))
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar evento'))
    } finally {
      setLoading(false)
    }
  }, [idEvent])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
