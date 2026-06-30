// Types
export type {
  EventMaster,
  EventFullView,
  CreateEventInput,
  WebEventFilters,
} from './types/event.types'

// Service
export {
  eventsService,
  createEvent,
  adminCreateEvent,
  adminUpdateEvent,
  adminSetEventActive,
  getEventById,
  listPublicApprovedEvents,
  listLeaderEventRequests,
  listPendingEventRequests,
  listWebEvents,
  deactivateEvent,
  reactivateEvent,
} from './api/events.service'
export type { AdminCreateEventInput, AdminCreateEventResult, AdminUpdateEventInput } from './api/events.service'

// Hooks
export { usePublicEvents } from './hooks/usePublicEvents'
export { useEventById } from './hooks/useEventById'
export { useEventRequests } from './hooks/useEventRequests'
export { useWebEvents } from './hooks/useWebEvents'
export { useEventRequestFlow } from './hooks/useEventRequestFlow'
export type { EventRequestFlowInput, EventRequestFlowResult } from './hooks/useEventRequestFlow'

// Mocks / banco em memória (temporário)
export { seedEventMockData } from './mocks/event.mock'
export { buildEventFullView } from './mocks/event-view.mock'
export { STORAGE_KEYS } from './mocks/event-storage.mock'
