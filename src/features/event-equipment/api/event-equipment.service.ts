/**
 * event-equipment.service — solicitações de equipamento sobre o mock/localStorage.
 */
import type { EquipmentRequestInput, EventEquipmentRequest } from '../types/event-equipment.types'
import {
  getEquipmentRequests,
  setEquipmentRequests,
  getEquipments,
  genId,
  resolveAsync,
} from '../../events/mocks/event-storage.mock'
import { seedEventMockData } from '../../events/mocks/event.mock'

export async function requestEventEquipment(
  items: EquipmentRequestInput[],
): Promise<EventEquipmentRequest[]> {
  seedEventMockData()
  const created: EventEquipmentRequest[] = items.map((item) => ({
    id: genId('eqr'),
    id_event: item.id_event,
    id_equipment: item.id_equipment,
    quantity: item.quantity,
  }))
  setEquipmentRequests([...getEquipmentRequests(), ...created])
  return resolveAsync(created)
}

export async function listEventEquipmentRequests(idEvent: string): Promise<EventEquipmentRequest[]> {
  seedEventMockData()
  const equipmentById = new Map(getEquipments().map((e) => [e.id, e]))
  const result = getEquipmentRequests()
    .filter((r) => r.id_event === idEvent)
    .map((r) => ({ ...r, equipment: equipmentById.get(r.id_equipment) }))
  return resolveAsync(result)
}

/**
 * Substitui as solicitações de equipamento de um evento (sem afetar os demais).
 * Remove as antigas do evento e grava a nova lista; retorna o resultado já com
 * o join do catálogo.
 */
export async function updateEventEquipmentRequests(
  idEvent: string,
  items: { id_equipment: string; quantity: number }[],
): Promise<EventEquipmentRequest[]> {
  seedEventMockData()
  const others = getEquipmentRequests().filter((r) => r.id_event !== idEvent)
  const created: EventEquipmentRequest[] = items.map((item) => ({
    id: genId('eqr'),
    id_event: idEvent,
    id_equipment: item.id_equipment,
    quantity: item.quantity,
  }))
  setEquipmentRequests([...others, ...created])

  const equipmentById = new Map(getEquipments().map((e) => [e.id, e]))
  return resolveAsync(created.map((r) => ({ ...r, equipment: equipmentById.get(r.id_equipment) })))
}

export const eventEquipmentService = {
  requestEventEquipment,
  listEventEquipmentRequests,
  updateEventEquipmentRequests,
}
