import { useCallback, useEffect, useState } from 'react'
import type { EventAttendance } from '../types/event-attendance.types'
import { listMyAttendances } from '../api/event-attendance.service'

/** "Meus Eventos": participações confirmadas do usuário. */
export function useMyAttendances(idUser: string | null | undefined) {
  const [data, setData] = useState<EventAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!idUser) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await listMyAttendances(idUser))
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar participações'))
    } finally {
      setLoading(false)
    }
  }, [idUser])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
