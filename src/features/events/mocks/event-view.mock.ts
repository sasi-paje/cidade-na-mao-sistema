/**
 * buildEventFullView() — simula a view `v_master_event_full`.
 *
 * Faz o join em memória entre events, event-slots, event-equipment-requests,
 * equipments e event-attendances, retornando uma linha por slot.
 */
import type { EventFullView } from '../types/event.types'
import type { EventEquipmentRequest } from '../../event-equipment/types/event-equipment.types'
import {
  getEvents,
  getSlots,
  getEquipments,
  getEquipmentRequests,
  getAttendances,
} from './event-storage.mock'

export function buildEventFullView(): EventFullView[] {
  const events = getEvents()
  const slots = getSlots()
  const equipments = getEquipments()
  const equipmentRequests = getEquipmentRequests()
  const attendances = getAttendances()

  const eventById = new Map(events.map((e) => [e.id, e]))
  const equipmentById = new Map(equipments.map((eq) => [eq.id, eq]))

  return slots.flatMap((slot) => {
    const event = eventById.get(slot.id_event)
    if (!event) return []

    const confirmed_count = attendances.filter(
      (a) => a.id_event === slot.id_event && a.id_slot === slot.id && a.status === 'confirmed',
    ).length

    const equipment_requests: EventEquipmentRequest[] = equipmentRequests
      .filter((r) => r.id_event === slot.id_event)
      .map((r) => ({ ...r, equipment: equipmentById.get(r.id_equipment) }))

    const view: EventFullView = {
      id_event: event.id,
      id_slot: slot.id,
      title: event.title,
      description: event.description,
      banner_url: event.banner_url ?? null,
      location: event.location,
      is_active: event.is_active,
      requested_at: slot.requested_at,
      approved_at: slot.approved_at,
      counter_date: slot.counter_date ?? null,
      capacity: slot.capacity,
      slot_status: slot.slot_status,
      created_by: event.id_user,
      confirmed_count,
      equipment_requests,
    }
    return [view]
  })
}
