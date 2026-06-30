/** Modelo do formulário "Novo Evento" (web/admin). */
export interface NewEventFormData {
  banner: string | null
  name: string
  day: string
  time: string
  location: string
  capacity: string
  description: string
}

export type NewEventFormErrors = Partial<Record<keyof NewEventFormData, boolean>>

export const EMPTY_NEW_EVENT_FORM: NewEventFormData = {
  banner: null,
  name: '',
  day: '',
  time: '',
  location: '',
  capacity: '',
  description: '',
}
