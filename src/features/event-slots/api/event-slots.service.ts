/**
 * event-slots.service — slots (data/hora/vagas) sobre o mock/localStorage.
 */
import type { CreateEventSlotInput, EventSlot } from '../types/event-slot.types'
import { SLOT_STATUS_IDS } from '../types/event-slot.types'
import { getSlots, setSlots, getEvents, setEvents, genId, nowIso, resolveAsync } from '../../events/mocks/event-storage.mock'
import { seedEventMockData } from '../../events/mocks/event.mock'

export async function createEventSlot(input: CreateEventSlotInput): Promise<EventSlot> {
  seedEventMockData()
  const requested = input.requested_at ?? nowIso()
  const slot: EventSlot = {
    id: genId('slot'),
    id_event: input.id_event,
    id_slot_status: SLOT_STATUS_IDS.pending,
    slot_status: 'pending',
    requested_at: requested,
    approved_at: null,
    counter_date: null,
    capacity: input.capacity,
    created_at: nowIso(),
  }
  setSlots([...getSlots(), slot])
  return resolveAsync(slot)
}

export async function getEventSlot(idSlot: string): Promise<EventSlot | null> {
  seedEventMockData()
  return resolveAsync(getSlots().find((s) => s.id === idSlot) ?? null)
}

/** Líder aceita a contraproposta de data → slot vira approved. */
export async function acceptCounterDate(idSlot: string): Promise<void> {
  seedEventMockData()
  setSlots(
    getSlots().map((s) =>
      s.id === idSlot
        ? {
            ...s,
            slot_status: 'approved',
            id_slot_status: SLOT_STATUS_IDS.approved,
            approved_at: s.counter_date ?? nowIso(),
          }
        : s,
    ),
  )
  return resolveAsync(undefined)
}

/** Líder recusa a contraproposta → slot inativo e evento inativado. */
export async function rejectCounterDate(idSlot: string, idEvent: string): Promise<void> {
  seedEventMockData()
  setSlots(
    getSlots().map((s) =>
      s.id === idSlot ? { ...s, slot_status: 'inactive', id_slot_status: SLOT_STATUS_IDS.inactive } : s,
    ),
  )
  setEvents(getEvents().map((e) => (e.id === idEvent ? { ...e, is_active: false, updated_at: nowIso() } : e)))
  return resolveAsync(undefined)
}

export const eventSlotsService = {
  createEventSlot,
  getEventSlot,
  acceptCounterDate,
  rejectCounterDate,
}
