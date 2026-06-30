export type {
  EventSlot,
  SlotStatusCode,
  CreateEventSlotInput,
} from './types/event-slot.types'
export { SLOT_STATUS_IDS } from './types/event-slot.types'

export {
  eventSlotsService,
  createEventSlot,
  getEventSlot,
  acceptCounterDate,
  rejectCounterDate,
} from './api/event-slots.service'

export { useEventSlot } from './hooks/useEventSlot'
