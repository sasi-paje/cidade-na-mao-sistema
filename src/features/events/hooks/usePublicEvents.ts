import { useCallback, useEffect, useState } from 'react'
import type { EventFullView } from '../types/event.types'
import { listPublicApprovedEvents, type PublicEventsOptions } from '../api/events.service'

/**
 * Lista de eventos aprovados visíveis ao público, já ordenada por proximidade
 * da data do evento. `upcomingOnly`/`limit` são para o feed público (tela de
 * próximos); telas que precisam de todos os eventos (ex.: meus eventos) chamam
 * sem opções. Deps primitivas evitam refetch em loop.
 */
export function usePublicEvents(options?: PublicEventsOptions) {
  const upcomingOnly = options?.upcomingOnly ?? false
  const limit = options?.limit
  const [data, setData] = useState<EventFullView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listPublicApprovedEvents({ upcomingOnly, limit }))
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar eventos'))
    } finally {
      setLoading(false)
    }
  }, [upcomingOnly, limit])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
