/**
 * Seed inicial do domínio de eventos (mock/localStorage).
 *
 * Cobre todos os estados de slot para permitir testar os fluxos futuros:
 * approved (público), pending (admin/líder), counter_proposed, rejected, inactive.
 *
 * `seedEventMockData()` só popula se as chaves ainda não existirem.
 */
import type { EventMaster } from '../types/event.types'
import type { EventSlot } from '../../event-slots/types/event-slot.types'
import { SLOT_STATUS_IDS } from '../../event-slots/types/event-slot.types'
import type { Equipment } from '../../equipment/types/equipment.types'
import type { EventEquipmentRequest } from '../../event-equipment/types/event-equipment.types'
import type { EventApproval } from '../../event-approvals/types/event-approval.types'
import { APPROVAL_DECISION_IDS } from '../../event-approvals/types/event-approval.types'
import type { EventAttendance } from '../../event-attendance/types/event-attendance.types'
import { ATTENDANCE_STATUS_IDS } from '../../event-attendance/types/event-attendance.types'
import {
  STORAGE_KEYS,
  tableExists,
  setEvents,
  setSlots,
  setEquipments,
  setEquipmentRequests,
  setApprovals,
  setAttendances,
} from './event-storage.mock'

const TENANT = 'tenant-itabira'
// Alinhado ao MOCK_LEADER_USER_ID (app/constants/currentUser.ts) para que o
// líder mockado enxergue as solicitações do seed na Etapa 5.
const LEADER = 'user-leader-mock-001'
const ADMIN = 'user-admin-1'

const EVENTS: EventMaster[] = [
  {
    id: 'evt-1', id_tenant: TENANT, id_user: LEADER,
    title: 'Arraiá Cultural de Rubelita',
    description: 'Festa cultural com quadrilha, comidas típicas e shows locais.',
    banner_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=60',
    location: 'Studio 5 centro de convenções', is_active: true,
    created_at: '2026-04-01T12:00:00.000Z',
  },
  {
    id: 'evt-2', id_tenant: TENANT, id_user: LEADER,
    title: 'Giro de Quinta',
    description: 'Caminhada e corrida comunitária pelas ruas do centro.',
    banner_url: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=800&q=60',
    location: 'Praça Central', is_active: true,
    created_at: '2026-04-10T09:00:00.000Z',
  },
  {
    id: 'evt-3', id_tenant: TENANT, id_user: LEADER,
    title: 'Oficina de Funilaria',
    description: 'Oficina prática de funilaria e pintura automotiva.',
    banner_url: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=60',
    location: 'Galpão Industrial 2', is_active: true,
    created_at: '2026-04-05T14:00:00.000Z',
  },
  {
    id: 'evt-4', id_tenant: TENANT, id_user: LEADER,
    title: 'Feira de Trocas',
    description: 'Feira de troca de livros, roupas e objetos.',
    banner_url: null,
    location: 'Mercado Municipal', is_active: true,
    created_at: '2026-03-20T10:00:00.000Z',
  },
  {
    id: 'evt-5', id_tenant: TENANT, id_user: LEADER,
    title: 'Sarau Antigo',
    description: 'Sarau de poesia (edição encerrada).',
    banner_url: null,
    location: 'Biblioteca Pública', is_active: false,
    created_at: '2026-02-10T19:00:00.000Z',
  },
]

const SLOTS: EventSlot[] = [
  {
    id: 'slot-1', id_event: 'evt-1', id_slot_status: SLOT_STATUS_IDS.approved, slot_status: 'approved',
    requested_at: '2026-04-01T12:00:00.000Z', approved_at: '2026-04-03T12:00:00.000Z', counter_date: null,
    capacity: 200, created_at: '2026-04-01T12:00:00.000Z',
  },
  {
    id: 'slot-2', id_event: 'evt-2', id_slot_status: SLOT_STATUS_IDS.pending, slot_status: 'pending',
    requested_at: '2026-04-10T09:00:00.000Z', approved_at: null, counter_date: null,
    capacity: 100, created_at: '2026-04-10T09:00:00.000Z',
  },
  {
    id: 'slot-3', id_event: 'evt-3', id_slot_status: SLOT_STATUS_IDS.counter_proposed, slot_status: 'counter_proposed',
    requested_at: '2026-04-05T14:00:00.000Z', approved_at: null, counter_date: '2026-05-01T14:00:00.000Z',
    capacity: 50, created_at: '2026-04-05T14:00:00.000Z',
  },
  {
    id: 'slot-4', id_event: 'evt-4', id_slot_status: SLOT_STATUS_IDS.rejected, slot_status: 'rejected',
    requested_at: '2026-03-20T10:00:00.000Z', approved_at: null, counter_date: null,
    capacity: 80, created_at: '2026-03-20T10:00:00.000Z',
  },
  {
    id: 'slot-5', id_event: 'evt-5', id_slot_status: SLOT_STATUS_IDS.inactive, slot_status: 'inactive',
    requested_at: '2026-02-10T19:00:00.000Z', approved_at: null, counter_date: null,
    capacity: 60, created_at: '2026-02-10T19:00:00.000Z',
  },
]

const EQUIPMENTS: Equipment[] = [
  { id: 'eqp-1', id_tenant: TENANT, name: 'Microfone', description: 'Microfone sem fio', quantity: 10, is_active: true },
  { id: 'eqp-2', id_tenant: TENANT, name: 'Palco', description: 'Palco modular', quantity: 3, is_active: true },
  { id: 'eqp-3', id_tenant: TENANT, name: 'Caixa de Som', description: 'Caixa amplificada', quantity: 8, is_active: true },
  { id: 'eqp-4', id_tenant: TENANT, name: 'Iluminação', description: 'Kit de iluminação cênica', quantity: 5, is_active: true },
  { id: 'eqp-5', id_tenant: TENANT, name: 'Tenda', description: 'Tenda 3x3m', quantity: 12, is_active: true },
  { id: 'eqp-6', id_tenant: TENANT, name: 'Mesa', description: 'Mesa dobrável', quantity: 40, is_active: true },
  { id: 'eqp-7', id_tenant: TENANT, name: 'Cadeira', description: 'Cadeira plástica', quantity: 200, is_active: true },
]

const EQUIPMENT_REQUESTS: EventEquipmentRequest[] = [
  { id: 'eqr-1', id_event: 'evt-1', id_equipment: 'eqp-2', quantity: 1 },
  { id: 'eqr-2', id_event: 'evt-1', id_equipment: 'eqp-3', quantity: 2 },
  { id: 'eqr-3', id_event: 'evt-2', id_equipment: 'eqp-5', quantity: 2 },
]

const APPROVALS: EventApproval[] = [
  {
    id: 'apr-1', id_event: 'evt-1', id_slot: 'slot-1', id_reviewed_by: ADMIN,
    id_decision: APPROVAL_DECISION_IDS.approved, decision: 'approved', reason: null, counter_date: null,
    created_at: '2026-04-03T12:00:00.000Z',
  },
  {
    id: 'apr-3', id_event: 'evt-3', id_slot: 'slot-3', id_reviewed_by: ADMIN,
    id_decision: APPROVAL_DECISION_IDS.counter_proposed, decision: 'counter_proposed',
    reason: 'Data sugerida indisponível, propomos nova data.', counter_date: '2026-05-01T14:00:00.000Z',
    created_at: '2026-04-06T12:00:00.000Z',
  },
  {
    id: 'apr-4', id_event: 'evt-4', id_slot: 'slot-4', id_reviewed_by: ADMIN,
    id_decision: APPROVAL_DECISION_IDS.rejected, decision: 'rejected',
    reason: 'Local indisponível na data solicitada.', counter_date: null,
    created_at: '2026-03-22T12:00:00.000Z',
  },
]

const ATTENDANCES: EventAttendance[] = [
  { id: 'att-1', id_event: 'evt-1', id_slot: 'slot-1', id_user: 'user-pub-1', id_attendance_status: ATTENDANCE_STATUS_IDS.confirmed, status: 'confirmed', created_at: '2026-04-04T10:00:00.000Z' },
  { id: 'att-2', id_event: 'evt-1', id_slot: 'slot-1', id_user: 'user-pub-2', id_attendance_status: ATTENDANCE_STATUS_IDS.confirmed, status: 'confirmed', created_at: '2026-04-04T11:00:00.000Z' },
  { id: 'att-3', id_event: 'evt-1', id_slot: 'slot-1', id_user: 'user-pub-3', id_attendance_status: ATTENDANCE_STATUS_IDS.confirmed, status: 'confirmed', created_at: '2026-04-04T12:00:00.000Z' },
  { id: 'att-4', id_event: 'evt-1', id_slot: 'slot-1', id_user: 'user-pub-4', id_attendance_status: ATTENDANCE_STATUS_IDS.cancelled, status: 'cancelled', created_at: '2026-04-04T13:00:00.000Z', updated_at: '2026-04-05T09:00:00.000Z' },
]

/** Popula o localStorage com o seed apenas se ainda não houver dados. */
export function seedEventMockData(): void {
  if (tableExists(STORAGE_KEYS.events)) return
  setEvents(EVENTS)
  setSlots(SLOTS)
  setEquipments(EQUIPMENTS)
  setEquipmentRequests(EQUIPMENT_REQUESTS)
  setApprovals(APPROVALS)
  setAttendances(ATTENDANCES)
}
