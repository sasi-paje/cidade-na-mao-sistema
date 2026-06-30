/**
 * Slot de evento — data/hora/vagas de um evento.
 * Compatível com `trx_event_slot` + `ref_slot_status`.
 */

/** Códigos de status do slot (ref_slot_status.code) */
export type SlotStatusCode =
  | 'pending'
  | 'approved'
  | 'counter_proposed'
  | 'rejected'
  | 'inactive'

/** Mapa código → id de ref_slot_status (mock determinístico) */
export const SLOT_STATUS_IDS: Record<SlotStatusCode, number> = {
  pending: 1,
  approved: 2,
  counter_proposed: 3,
  rejected: 4,
  inactive: 5,
}

export interface EventSlot {
  id: string
  id_event: string
  id_slot_status: number
  slot_status: SlotStatusCode
  requested_at: string
  approved_at: string | null
  /** Data proposta pelo admin em uma contraproposta (counter_proposed) */
  counter_date?: string | null
  capacity: number
  created_at?: string
}

export interface CreateEventSlotInput {
  id_event: string
  capacity: number
  /** Quando omitido, usa a data/hora atual */
  requested_at?: string
}
