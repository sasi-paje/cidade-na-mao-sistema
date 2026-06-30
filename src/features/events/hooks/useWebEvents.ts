import { useCallback, useEffect, useState } from 'react'
import type { EventFullView, WebEventFilters } from '../types/event.types'
import { listWebEvents } from '../api/events.service'

/** Listagem admin/web de eventos, com filtros opcionais. */
export function useWebEvents(filters?: WebEventFilters) {
  const [data, setData] = useState<EventFullView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const filterKey = JSON.stringify(filters ?? {})

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listWebEvents(filters))
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar eventos'))
    } finally {
      setLoading(false)
    }
    // filterKey serializa os filtros para a dependência do callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
