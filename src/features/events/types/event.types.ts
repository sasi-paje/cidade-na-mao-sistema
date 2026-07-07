/**
 * Evento principal e a view agregada de leitura.
 * Compatível com `master_event` e `v_master_event_full`.
 */
import type { SlotStatusCode } from '../../event-slots/types/event-slot.types'
import type { EventEquipmentRequest } from '../../event-equipment/types/event-equipment.types'

export interface EventMaster {
  id: string
  id_tenant: string
  id_user: string
  title: string
  description: string
  banner_url?: string | null
  location: string
  is_active: boolean
  created_at: string
  updated_at?: string
}

/**
 * Linha da view `v_master_event_full`: um registro por slot, já com o
 * join de evento + status + contagem de confirmados + equipamentos.
 */
export interface EventFullView {
  id_event: string
  id_slot: string
  title: string
  description: string
  banner_url?: string | null
  location: string
  is_active: boolean
  requested_at: string
  approved_at: string | null
  counter_date?: string | null
  capacity: number
  slot_status: SlotStatusCode
  /** id_user que criou o evento (id_user de master_event) */
  created_by: string
  /** Data de cadastro do evento (master_event.created_at) — usada na ordenação do feed. */
  created_at?: string
  confirmed_count: number
  equipment_requests?: EventEquipmentRequest[]
}

export interface CreateEventInput {
  id_tenant: string
  id_user: string
  title: string
  description: string
  location: string
  banner_url?: string | null
}

/** Filtros opcionais para a listagem web/admin */
export interface WebEventFilters {
  slot_status?: SlotStatusCode
  is_active?: boolean
  search?: string
}
