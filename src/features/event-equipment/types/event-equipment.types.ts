/**
 * Solicitação de equipamento para um evento.
 * Compatível com `trx_event_equipment_request`.
 */
import type { Equipment } from '../../equipment/types/equipment.types'

export interface EventEquipmentRequest {
  id: string
  id_event: string
  id_equipment: string
  quantity: number
  /** Join opcional com o catálogo de equipamentos */
  equipment?: Equipment
}

export interface EquipmentRequestInput {
  id_event: string
  id_equipment: string
  quantity: number
}
