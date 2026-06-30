import { useCallback, useEffect, useState } from 'react'
import type { EventAttendance } from '../types/event-attendance.types'
import { getMyAttendance, confirmAttendance, cancelAttendance } from '../api/event-attendance.service'

/**
 * Participação do usuário atual em um slot: carrega o estado e expõe
 * confirmar/cancelar.
 */
export function useEventAttendance(
  idEvent: string | null | undefined,
  idSlot: string | null | undefined,
  idUser: string | null | undefined,
) {
  const [data, setData] = useState<EventAttendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [mutating, setMutating] = useState(false)

  const ready = Boolean(idEvent && idSlot && idUser)

  const refetch = useCallback(async () => {
    if (!idEvent || !idSlot || !idUser) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await getMyAttendance(idEvent, idSlot, idUser))
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar participação'))
    } finally {
      setLoading(false)
    }
  }, [idEvent, idSlot, idUser])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const confirm = useCallback(async () => {
    if (!idEvent || !idSlot || !idUser) return
    setMutating(true)
    setError(null)
    try {
      await confirmAttendance({ id_event: idEvent, id_slot: idSlot, id_user: idUser })
      await refetch()
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao confirmar participação'))
      throw e
    } finally {
      setMutating(false)
    }
  }, [idEvent, idSlot, idUser, refetch])

  const cancel = useCallback(async () => {
    if (!idEvent || !idSlot || !idUser) return
    setMutating(true)
    setError(null)
    try {
      await cancelAttendance(idEvent, idSlot)
      await refetch()
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao cancelar participação'))
      throw e
    } finally {
      setMutating(false)
    }
  }, [idEvent, idSlot, idUser, refetch])

  const isConfirmed = data?.status === 'confirmed'

  return { data, loading, error, mutating, ready, isConfirmed, refetch, confirm, cancel }
}
