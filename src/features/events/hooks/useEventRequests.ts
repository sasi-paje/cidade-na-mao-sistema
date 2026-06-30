import { useCallback, useEffect, useState } from 'react'
import type { EventFullView } from '../types/event.types'
import { listLeaderEventRequests } from '../api/events.service'

/** Solicitações de evento do líder (criadas pelo próprio usuário). */
export function useEventRequests(userId: string | null | undefined) {
  const [data, setData] = useState<EventFullView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!userId) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await listLeaderEventRequests(userId))
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar solicitações'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
