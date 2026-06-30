import { useCallback, useEffect, useState } from 'react'
import type { EventSlot } from '../types/event-slot.types'
import { getEventSlot, acceptCounterDate, rejectCounterDate } from '../api/event-slots.service'

/**
 * Carrega um slot e expõe as ações do líder sobre uma contraproposta de data.
 */
export function useEventSlot(idSlot: string | null | undefined) {
  const [data, setData] = useState<EventSlot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [mutating, setMutating] = useState(false)

  const refetch = useCallback(async () => {
    if (!idSlot) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await getEventSlot(idSlot))
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar slot'))
    } finally {
      setLoading(false)
    }
  }, [idSlot])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const acceptCounter = useCallback(async () => {
    if (!idSlot) return
    setMutating(true)
    setError(null)
    try {
      await acceptCounterDate(idSlot)
      await refetch()
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao aceitar contraproposta'))
      throw e
    } finally {
      setMutating(false)
    }
  }, [idSlot, refetch])

  const rejectCounter = useCallback(async (idEvent: string) => {
    if (!idSlot) return
    setMutating(true)
    setError(null)
    try {
      await rejectCounterDate(idSlot, idEvent)
      await refetch()
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao recusar contraproposta'))
      throw e
    } finally {
      setMutating(false)
    }
  }, [idSlot, refetch])

  return { data, loading, error, mutating, refetch, acceptCounter, rejectCounter }
}
