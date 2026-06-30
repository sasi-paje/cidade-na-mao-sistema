import { useCallback, useEffect, useState } from 'react'
import { listConfirmedPeopleByEvent, type ConfirmedPerson } from '../api/event-attendance.service'

/**
 * Pessoas confirmadas (reais) de um evento/slot, para a visão admin.
 * Estados: loading / error / data (vazio = sem confirmados, sem mock).
 */
export function useConfirmedPeople(idEvent: string | null | undefined, idSlot?: string | null) {
  const [data, setData] = useState<ConfirmedPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!idEvent) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await listConfirmedPeopleByEvent(idEvent, idSlot))
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar pessoas confirmadas'))
    } finally {
      setLoading(false)
    }
  }, [idEvent, idSlot])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
