import { useCallback, useState } from 'react'
import type { CreateEventInput } from '../types/event.types'
import { requestEvent, type AdminCreateEventResult } from '../api/events.service'

export interface EventRequestFlowInput {
  event: CreateEventInput
  slot: { capacity: number; requested_at?: string }
  equipment: { id_equipment: string; quantity: number }[]
}

/** Resultado real da RPC `request_event` (id_event/id_slot são uuids reais). */
export type EventRequestFlowResult = AdminCreateEventResult

/**
 * Solicitação de evento pelo líder via RPC real `request_event`:
 * cria master_event + slot 'pending' + equipamentos numa única transação.
 * O tenant/usuário vêm da sessão Supabase (a RPC ignora id_tenant/id_user do
 * front por segurança); retorna o id_event real (uuid) para navegação.
 */
export function useEventRequestFlow() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<EventRequestFlowResult | null>(null)

  const submit = useCallback(async (input: EventRequestFlowInput): Promise<EventRequestFlowResult> => {
    setLoading(true)
    setError(null)
    try {
      const requestedAt = input.slot.requested_at
      if (!requestedAt) throw new Error('Data/hora é obrigatória.')
      const res = await requestEvent({
        title: input.event.title,
        description: input.event.description,
        banner_url: input.event.banner_url ?? null,
        location: input.event.location,
        requested_at: requestedAt,
        capacity: input.slot.capacity,
        equipment: input.equipment,
      })
      setResult(res)
      return res
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Falha ao solicitar evento')
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { submit, loading, error, result }
}
