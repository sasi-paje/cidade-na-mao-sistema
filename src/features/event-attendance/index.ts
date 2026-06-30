export type {
  EventAttendance,
  AttendanceStatusCode,
  ConfirmAttendanceInput,
  CreateAttendanceInput,
} from './types/event-attendance.types'
export { ATTENDANCE_STATUS_IDS } from './types/event-attendance.types'

export {
  eventAttendanceService,
  confirmAttendance,
  cancelAttendance,
  getMyAttendance,
  listMyAttendances,
  listEventAttendances,
  listConfirmedPeopleByEvent,
} from './api/event-attendance.service'
export type { ConfirmedPerson } from './api/event-attendance.service'

export { useEventAttendance } from './hooks/useEventAttendance'
export { useMyAttendances } from './hooks/useMyAttendances'
export { useConfirmedPeople } from './hooks/useConfirmedPeople'
