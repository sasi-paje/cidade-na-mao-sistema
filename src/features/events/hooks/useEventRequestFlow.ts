import { useCallback, useState } from 'react'
import type { CreateEventInput, EventMaster } from '../types/event.types'
import type { EventSlot } from '../../event-slots/types/event-slot.types'
import type { EventEquipmentRequest } from '../../event-equipment/types/event-equipment.types'
import { createEvent } from '../api/events.service'
import { createEventSlot } from '../../event-slots/api/event-slots.service'
import { requestEventEquipment } from '../../event-equipment/api/event-equipment.service'

export interface EventRequestFlowInput {
  event: CreateEventInput
  slot: { capacity: number; requested_at?: string }
  equipment: { id_equipment: string; quantity: number }[]
}

export interface EventRequestFlowResult {
  event: EventMaster
  slot: EventSlot
  equipment: EventEquipmentRequest[]
}

/**
 * Orquestra a solicitação de um evento pelo líder:
 *   1. createEvent → 2. createEventSlot → 3. requestEventEquipment
 */
export function useEventRequestFlow() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<EventRequestFlowResult | null>(null)

  const submit = useCallback(async (input: EventRequestFlowInput): Promise<EventRequestFlowResult> => {
    setLoading(true)
    setError(null)
    try {
      const event = await createEvent(input.event)
      const slot = await createEventSlot({ id_event: event.id, ...input.slot })
      const equipment = input.equipment.length
        ? await requestEventEquipment(input.equipment.map((e) => ({ id_event: event.id, ...e })))
        : []
      const flowResult: EventRequestFlowResult = { event, slot, equipment }
      setResult(flowResult)
      return flowResult
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
