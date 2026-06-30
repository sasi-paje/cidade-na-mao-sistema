import { useCallback, useEffect, useState } from 'react'
import type { EventFullView } from '../types/event.types'
import { listPublicApprovedEvents } from '../api/events.service'

/** Lista de eventos aprovados visíveis ao público. */
export function usePublicEvents() {
  const [data, setData] = useState<EventFullView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listPublicApprovedEvents())
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar eventos'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
