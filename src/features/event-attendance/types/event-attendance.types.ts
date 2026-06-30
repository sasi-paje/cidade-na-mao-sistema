/**
 * Participação (presença) em um evento.
 * Compatível com `trx_event_attendance` + `ref_attendance_status`.
 */

/** Códigos de status de presença (ref_attendance_status.code) */
export type AttendanceStatusCode = 'confirmed' | 'cancelled'

/** Mapa código → id de ref_attendance_status (mock determinístico) */
export const ATTENDANCE_STATUS_IDS: Record<AttendanceStatusCode, number> = {
  confirmed: 1,
  cancelled: 2,
}

export interface EventAttendance {
  id: string
  id_event: string
  id_slot: string
  id_user: string
  id_attendance_status: number
  status: AttendanceStatusCode
  created_at: string
  updated_at?: string
}

export interface ConfirmAttendanceInput {
  id_event: string
  id_slot: string
  id_user: string
}

/** Alias semântico — confirmar participação cria/ativa um registro */
export type CreateAttendanceInput = ConfirmAttendanceInput
