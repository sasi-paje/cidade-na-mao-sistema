/**
 * events.service — leitura/escrita de eventos.
 *
 * MIGRAÇÃO (leitura conectada; M4 — views seguras por tenant):
 *  - Público/anon: `listPublicApprovedEvents` e o fallback de `getEventById`
 *    usam `v_public_approved_events` (approved+is_active, dados mínimos).
 *  - Admin/líder autenticado: `listWebEvents`/`listPendingEventRequests`/
 *    `listLeaderEventRequests`/`getEventById` usam `v_master_event_full`
 *    (security_invoker → RLS filtra por tenant/role; anon recebe 0 linhas).
 *  - Em env ausente / erro / RLS / vazio → fallback mock (localStorage).
 *  - ESCRITA (createEvent/deactivate/reactivate) permanece em mock (Fase M5).
 *
 * Mapeamento v_master_event_full → EventFullView:
 *   id → id_event · id_user → created_by · confirmed_count vem da view de
 *   contagem · counter_date/equipment_requests não estão na view (ficam
 *   null/undefined até a leitura das tabelas-base com auth/RLS).
 */
import type { CreateEventInput, EventFullView, EventMaster, WebEventFilters } from '../types/event.types'
import type { SlotStatusCode } from '../../event-slots/types/event-slot.types'
import type { EventEquipmentRequest } from '../../event-equipment/types/event-equipment.types'
import type { Equipment } from '../../equipment/types/equipment.types'
import { getEvents, setEvents, genId, nowIso, resolveAsync } from '../mocks/event-storage.mock'
import { seedEventMockData } from '../mocks/event.mock'
import { buildEventFullView } from '../mocks/event-view.mock'
import { supabase, hasSupabaseEnv, canUseMockFallback } from '../../../lib/supabase/client'
import { logSupabaseError, friendlyAdminError } from '../../../lib/supabase/supabase-error'

// View admin (security_invoker): RLS filtra por tenant/role; anon → 0 linhas.
const EVENT_VIEW = 'v_master_event_full'
const ATTENDANCE_COUNT_VIEW = 'v_trx_slot_attendance_count'
// View pública (M4): approved + is_active, dados mínimos, legível por anon.
const PUBLIC_EVENT_VIEW = 'v_public_approved_events'
// Tabela-base dos equipamentos solicitados (não está na view; lida com RLS).
const EQUIPMENT_REQUEST_TABLE = 'trx_event_equipment_request'

/**
 * Lê (real) as solicitações de equipamento de um evento, com o nome do
 * equipamento embutido (join FK → master_equipment). RLS filtra por tenant.
 */
async function fetchEventEquipmentRequests(idEvent: string): Promise<EventEquipmentRequest[]> {
  interface Row {
    id: string
    id_event: string
    id_equipment: string
    quantity: number
    equipment: Equipment | null
  }
  const { data, error } = await supabase
    .from(EQUIPMENT_REQUEST_TABLE)
    .select(
      'id, id_event, id_equipment, quantity, equipment:master_equipment(id, id_tenant, name, description, quantity, is_active, created_at)',
    )
    .eq('id_event', idEvent)
  if (error) throw error
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    id_event: r.id_event,
    id_equipment: r.id_equipment,
    quantity: r.quantity,
    equipment: r.equipment ?? undefined,
  }))
}

/** Payload do admin para criar um evento já aprovado (RPC admin_create_event). */
export interface AdminCreateEventInput {
  title: string
  description: string
  banner_url: string | null
  location: string
  /** ISO 8601 (ex.: 2026-07-05T17:00:00.000Z). */
  requested_at: string
  capacity: number
  equipment: { id_equipment: string; quantity: number }[]
}

export interface AdminCreateEventResult {
  id_event: string
  id_slot: string
  slot_status: string
  equipment_requests: { id_equipment: string; quantity: number }[]
}

/**
 * Cria um evento REAL (já aprovado) via RPC transacional `admin_create_event`.
 * Sem fallback mock: a autorização/tenant/usuário vêm da sessão Supabase (RLS +
 * current_*). Lança em qualquer falha — o chamador trata o erro na UI.
 */
export async function adminCreateEvent(
  input: AdminCreateEventInput,
  tenantSlug?: string | null,
): Promise<AdminCreateEventResult> {
  if (tenantSlug) {
    const { data, error } = await supabase.rpc('web_create_event_by_tenant', {
      p_tenant_slug: tenantSlug,
      p_title: input.title,
      p_description: input.description,
      p_banner_url: input.banner_url,
      p_location: input.location,
      p_requested_at: input.requested_at,
      p_capacity: input.capacity,
      p_equipment_requests: input.equipment,
    })
    if (error) {
      logSupabaseError('web_create_event_by_tenant', error)
      throw new Error(error.message || 'Não foi possível criar o evento.')
    }
    return data as AdminCreateEventResult
  }
  const { data, error } = await supabase.rpc('admin_create_event', {
    p_title: input.title,
    p_description: input.description,
    p_banner_url: input.banner_url,
    p_location: input.location,
    p_requested_at: input.requested_at,
    p_capacity: input.capacity,
    p_equipment_requests: input.equipment,
  })
  if (error) {
    logSupabaseError('adminCreateEvent', error)
    throw new Error(friendlyAdminError(error, 'Não foi possível criar o evento.'))
  }
  return data as AdminCreateEventResult
}

/**
 * Solicita um evento (LÍDER comunitário) via RPC transacional `request_event`.
 * Cria o evento com slot 'pending' (entra na fila do admin). Identidade/tenant
 * vêm da sessão (current_user_id/current_tenant_id + RLS); sem mock. Lança em
 * falha — o chamador trata o erro na UI.
 */
export async function requestEvent(input: AdminCreateEventInput): Promise<AdminCreateEventResult> {
  const { data, error } = await supabase.rpc('request_event', {
    p_title: input.title,
    p_description: input.description,
    p_banner_url: input.banner_url,
    p_location: input.location,
    p_requested_at: input.requested_at,
    p_capacity: input.capacity,
    p_equipment_requests: input.equipment,
  })
  if (error) {
    logSupabaseError('requestEvent', error)
    throw new Error(error.message || 'Não foi possível solicitar o evento.')
  }
  return data as AdminCreateEventResult
}

/** Payload do admin para editar um evento (RPC admin_update_event). */
export interface AdminUpdateEventInput {
  id_event: string
  id_slot: string
  title: string
  description: string
  banner_url: string | null
  location: string
  /** ISO 8601. */
  requested_at: string
  capacity: number
  equipment: { id_equipment: string; quantity: number }[]
}

/**
 * Edita um evento REAL via RPC transacional `admin_update_event`.
 * Faz REPLACE completo dos equipamentos; admin-only; sem mock. Lança em falha.
 */
export async function adminUpdateEvent(
  input: AdminUpdateEventInput,
  tenantSlug?: string | null,
): Promise<AdminCreateEventResult> {
  if (tenantSlug) {
    const { data, error } = await supabase.rpc('web_update_event_by_tenant', {
      p_tenant_slug: tenantSlug,
      p_id_event: input.id_event,
      p_id_slot: input.id_slot,
      p_title: input.title,
      p_description: input.description,
      p_banner_url: input.banner_url,
      p_location: input.location,
      p_requested_at: input.requested_at,
      p_capacity: input.capacity,
      p_equipment_requests: input.equipment,
    })
    if (error) {
      logSupabaseError('web_update_event_by_tenant', error)
      throw new Error(error.message || 'Não foi possível atualizar o evento.')
    }
    return data as AdminCreateEventResult
  }
  const { data, error } = await supabase.rpc('admin_update_event', {
    p_id_event: input.id_event,
    p_id_slot: input.id_slot,
    p_title: input.title,
    p_description: input.description,
    p_banner_url: input.banner_url,
    p_location: input.location,
    p_requested_at: input.requested_at,
    p_capacity: input.capacity,
    p_equipment_requests: input.equipment,
  })
  if (error) {
    logSupabaseError('adminUpdateEvent', error)
    throw new Error(friendlyAdminError(error, 'Não foi possível atualizar o evento.'))
  }
  return data as AdminCreateEventResult
}

/**
 * Ativa/inativa um evento (soft-toggle real) via RPC `admin_set_event_active`.
 * Admin-only; tenant/usuário vêm da sessão. Lança em falha.
 */
export async function adminSetEventActive(
  idEvent: string,
  isActive: boolean,
  tenantSlug?: string | null,
): Promise<void> {
  if (tenantSlug) {
    const { error } = await supabase.rpc('web_set_event_active_by_tenant', {
      p_tenant_slug: tenantSlug,
      p_id_event: idEvent,
      p_is_active: isActive,
    })
    if (error) {
      logSupabaseError('web_set_event_active_by_tenant', error)
      throw new Error(error.message || 'Não foi possível atualizar o evento.')
    }
    return
  }
  const { error } = await supabase.rpc('admin_set_event_active', {
    p_id_event: idEvent,
    p_is_active: isActive,
  })
  if (error) {
    logSupabaseError('adminSetEventActive', error)
    throw new Error(friendlyAdminError(error, 'Não foi possível atualizar o evento.'))
  }
}

/** Linha bruta da view `v_master_event_full` (1 por slot). */
interface EventViewRow {
  id: string
  id_tenant: string
  title: string
  description: string | null
  banner_url: string | null
  location: string | null
  is_active: boolean
  id_user: string
  creator_name: string | null
  creator_role: string | null
  id_slot: string
  requested_at: string
  approved_at: string | null
  capacity: number | null
  slot_status: SlotStatusCode
  created_at: string
  updated_at: string | null
}

interface AttendanceCountRow {
  id_slot: string
  confirmed_count: number | null
}

/** Linha da view pública `v_public_approved_events` (sem dados do criador). */
interface PublicEventRow {
  id: string
  id_tenant: string
  title: string
  description: string | null
  banner_url: string | null
  location: string | null
  is_active: boolean
  id_slot: string
  requested_at: string
  approved_at: string | null
  capacity: number | null
  slot_status: SlotStatusCode
  created_at: string
  updated_at: string | null
  confirmed_count: number | null
}

/** Mapeia a view pública → EventFullView (sem created_by/equipment_requests). */
function mapPublicRow(row: PublicEventRow): EventFullView {
  return {
    id_event: row.id,
    id_slot: row.id_slot,
    title: row.title,
    description: row.description ?? '',
    banner_url: row.banner_url ?? null,
    location: row.location ?? '',
    is_active: row.is_active,
    requested_at: row.requested_at,
    approved_at: row.approved_at ?? null,
    counter_date: null,
    capacity: row.capacity ?? 0,
    slot_status: row.slot_status,
    created_by: '', // não exposto na view pública
    confirmed_count: row.confirmed_count ?? 0,
    equipment_requests: undefined,
  }
}

function mapEventRow(row: EventViewRow, confirmedCount: number): EventFullView {
  return {
    id_event: row.id,
    id_slot: row.id_slot,
    title: row.title,
    description: row.description ?? '',
    banner_url: row.banner_url ?? null,
    location: row.location ?? '',
    is_active: row.is_active,
    requested_at: row.requested_at,
    approved_at: row.approved_at ?? null,
    counter_date: null, // não está na view; enriquecido após auth/RLS
    capacity: row.capacity ?? 0,
    slot_status: row.slot_status,
    created_by: row.id_user,
    confirmed_count: confirmedCount,
    equipment_requests: undefined, // não está na view; idem
  }
}

/** Busca confirmed_count por slot (em lotes, para não estourar a URL). */
async function fetchConfirmedCounts(slotIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const unique = Array.from(new Set(slotIds))
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200)
    const { data, error } = await supabase
      .from(ATTENDANCE_COUNT_VIEW)
      .select('id_slot,confirmed_count')
      .in('id_slot', chunk)
    if (error) throw error
    for (const r of (data ?? []) as AttendanceCountRow[]) {
      map.set(r.id_slot, r.confirmed_count ?? 0)
    }
  }
  return map
}

/** Aplica o mapeamento + merge de contagem a uma lista de linhas da view. */
async function toFullViews(rows: EventViewRow[]): Promise<EventFullView[]> {
  if (rows.length === 0) return []
  const counts = await fetchConfirmedCounts(rows.map((r) => r.id_slot))
  return rows.map((r) => mapEventRow(r, counts.get(r.id_slot) ?? 0))
}

// Fallback mock --------------------------------------------------------------
function mockViews(): EventFullView[] {
  seedEventMockData()
  return buildEventFullView()
}

// ---------------------------------------------------------------------------
// ESCRITA — ainda em mock (Etapa de conexão 2)
// ---------------------------------------------------------------------------
export async function createEvent(input: CreateEventInput): Promise<EventMaster> {
  seedEventMockData()
  const event: EventMaster = {
    id: genId('evt'),
    id_tenant: input.id_tenant,
    id_user: input.id_user,
    title: input.title,
    description: input.description,
    location: input.location,
    banner_url: input.banner_url ?? null,
    is_active: true,
    created_at: nowIso(),
  }
  setEvents([...getEvents(), event])
  return resolveAsync(event)
}

// ---------------------------------------------------------------------------
// LEITURA — Supabase com fallback mock
// ---------------------------------------------------------------------------
export async function getEventById(
  idEvent: string,
  tenantSlug?: string | null,
): Promise<EventFullView | null> {
  if (tenantSlug) {
    const { data, error } = await supabase.rpc('web_get_event_by_tenant', {
      p_tenant_slug: tenantSlug,
      p_id_event: idEvent,
    })
    if (error) {
      logSupabaseError('web_get_event_by_tenant', error)
      throw new Error(error.message || 'Não foi possível carregar o evento.')
    }
    return (data as EventFullView) ?? null
  }
  if (hasSupabaseEnv()) {
    try {
      // 1) Contexto admin/líder autenticado: view admin (tenant via RLS),
      //    cobre qualquer status (pending/approved/...). Anon recebe 0 linhas.
      const adminRes = await supabase
        .from(EVENT_VIEW)
        .select('*')
        .eq('id', idEvent)
        .order('requested_at', { ascending: false })
      if (adminRes.error) throw adminRes.error
      const adminRows = (adminRes.data ?? []) as EventViewRow[]
      if (adminRows.length > 0) {
        const views = await toFullViews(adminRows)
        const ev = views[0]
        // Enriquece com equipamentos solicitados reais (não estão na view).
        try {
          ev.equipment_requests = await fetchEventEquipmentRequests(idEvent)
        } catch (e) {
          logSupabaseError('fetchEventEquipmentRequests', e)
        }
        return ev
      }

      // 2) Contexto público/anon: view pública (approved + is_active).
      const pubRes = await supabase
        .from(PUBLIC_EVENT_VIEW)
        .select('*')
        .eq('id', idEvent)
        .order('requested_at', { ascending: false })
      if (pubRes.error) throw pubRes.error
      const pubRows = (pubRes.data ?? []) as PublicEventRow[]
      if (pubRows.length > 0) return mapPublicRow(pubRows[0])
      // Produção: sem linhas reais = evento inexistente/sem acesso → null (sem mock).
      if (!canUseMockFallback()) return null
    } catch (e) {
      logSupabaseError('getEventById', e)
      if (!canUseMockFallback()) throw e instanceof Error ? e : new Error('Não foi possível carregar o evento.')
    }
  }
  const found = mockViews().find((v) => v.id_event === idEvent) ?? null
  return resolveAsync(found)
}

/** Público: eventos aprovados e ativos via view pública (anon-safe). */
/**
 * Ordena o feed público "próximos de acontecer primeiro":
 *  - eventos FUTUROS em ordem ascendente por `requested_at` (o mais próximo de
 *    acontecer fica no topo);
 *  - eventos JÁ OCORRIDOS vão para o fim, entre si os mais recentes primeiro;
 *  - itens sem data válida ficam por último.
 * O corte usa a data/hora de início do evento (`requested_at`) vs. agora.
 */
function sortUpcomingFirst(events: EventFullView[]): EventFullView[] {
  const now = Date.now()
  const timeOf = (e: EventFullView): number | null => {
    const t = new Date(e.requested_at).getTime()
    return Number.isNaN(t) ? null : t
  }
  return [...events].sort((a, b) => {
    const ta = timeOf(a)
    const tb = timeOf(b)
    if (ta === null && tb === null) return 0
    if (ta === null) return 1
    if (tb === null) return -1
    const aUpcoming = ta >= now
    const bUpcoming = tb >= now
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1 // futuro antes de passado
    if (aUpcoming) return ta - tb // futuros: ascendente (mais próximo primeiro)
    return tb - ta // passados: descendente (mais recente primeiro)
  })
}

export async function listPublicApprovedEvents(): Promise<EventFullView[]> {
  if (hasSupabaseEnv()) {
    try {
      const { data, error } = await supabase
        .from(PUBLIC_EVENT_VIEW)
        .select('*')
        .order('requested_at', { ascending: true })
      if (error) throw error
      const rows = (data ?? []) as PublicEventRow[]
      if (rows.length > 0) return sortUpcomingFirst(rows.map(mapPublicRow))
      // Produção: lista real (mesmo vazia) — sem mock.
      if (!canUseMockFallback()) return []
    } catch (e) {
      logSupabaseError('listPublicApprovedEvents', e)
      if (!canUseMockFallback()) throw e instanceof Error ? e : new Error('Não foi possível carregar os eventos.')
    }
  }
  return resolveAsync(sortUpcomingFirst(mockViews().filter((v) => v.slot_status === 'approved' && v.is_active)))
}

/** Líder: solicitações criadas pelo próprio usuário. */
export async function listLeaderEventRequests(userId: string): Promise<EventFullView[]> {
  if (hasSupabaseEnv()) {
    try {
      const { data, error } = await supabase
        .from(EVENT_VIEW)
        .select('*')
        .eq('id_user', userId)
        .order('requested_at', { ascending: false })
      if (error) throw error
      return await toFullViews((data ?? []) as EventViewRow[])
    } catch (e) {
      logSupabaseError('listLeaderEventRequests', e)
      if (!canUseMockFallback()) throw e instanceof Error ? e : new Error('Não foi possível carregar as solicitações.')
    }
  }
  return resolveAsync(mockViews().filter((v) => v.created_by === userId))
}

/** Admin: fila de solicitações pendentes. */
export async function listPendingEventRequests(): Promise<EventFullView[]> {
  if (hasSupabaseEnv()) {
    try {
      const { data, error } = await supabase
        .from(EVENT_VIEW)
        .select('*')
        .eq('slot_status', 'pending')
        .order('requested_at', { ascending: true })
      if (error) throw error
      return await toFullViews((data ?? []) as EventViewRow[])
    } catch (e) {
      logSupabaseError('listPendingEventRequests', e)
      if (!canUseMockFallback()) throw e instanceof Error ? e : new Error('Não foi possível carregar as solicitações pendentes.')
    }
  }
  return resolveAsync(mockViews().filter((v) => v.slot_status === 'pending'))
}

/** Admin/web: todos os eventos, com filtros opcionais. */
function applyWebEventFilters(list: EventFullView[], filters?: WebEventFilters): EventFullView[] {
  let result = list
  if (filters?.slot_status) result = result.filter((v) => v.slot_status === filters.slot_status)
  if (filters?.is_active !== undefined) result = result.filter((v) => v.is_active === filters.is_active)
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (v) => v.title.toLowerCase().includes(q) || v.location.toLowerCase().includes(q),
    )
  }
  return result
}

export async function listWebEvents(
  filters?: WebEventFilters,
  tenantSlug?: string | null,
): Promise<EventFullView[]> {
  if (tenantSlug) {
    const { data, error } = await supabase.rpc('web_list_events_by_tenant', { p_tenant_slug: tenantSlug })
    if (error) {
      logSupabaseError('web_list_events_by_tenant', error)
      throw new Error(error.message || 'Não foi possível carregar os eventos.')
    }
    return applyWebEventFilters((data ?? []) as EventFullView[], filters)
  }
  if (hasSupabaseEnv()) {
    try {
      let query = supabase.from(EVENT_VIEW).select('*')
      if (filters?.slot_status) query = query.eq('slot_status', filters.slot_status)
      if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active)
      // Lista admin: recém-criados primeiro (evento novo aparece no topo, não
      // soterrado pela data do evento entre milhares de registros).
      query = query.order('created_at', { ascending: false })
      const { data, error } = await query
      if (error) throw error
      let result = await toFullViews((data ?? []) as EventViewRow[])
      // Busca textual: aplicada no cliente (mantém paridade com o mock).
      if (filters?.search) {
        const q = filters.search.toLowerCase()
        result = result.filter(
          (v) => v.title.toLowerCase().includes(q) || v.location.toLowerCase().includes(q),
        )
      }
      return result
    } catch (e) {
      logSupabaseError('listWebEvents', e)
      if (!canUseMockFallback()) throw e instanceof Error ? e : new Error('Não foi possível carregar os eventos.')
    }
  }
  let result = mockViews()
  if (filters?.slot_status) result = result.filter((v) => v.slot_status === filters.slot_status)
  if (filters?.is_active !== undefined) result = result.filter((v) => v.is_active === filters.is_active)
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (v) => v.title.toLowerCase().includes(q) || v.location.toLowerCase().includes(q),
    )
  }
  return resolveAsync(result)
}

export async function deactivateEvent(idEvent: string): Promise<void> {
  setEvents(getEvents().map((e) => (e.id === idEvent ? { ...e, is_active: false, updated_at: nowIso() } : e)))
  return resolveAsync(undefined)
}

export async function reactivateEvent(idEvent: string): Promise<void> {
  setEvents(getEvents().map((e) => (e.id === idEvent ? { ...e, is_active: true, updated_at: nowIso() } : e)))
  return resolveAsync(undefined)
}

export const eventsService = {
  createEvent,
  getEventById,
  listPublicApprovedEvents,
  listLeaderEventRequests,
  listPendingEventRequests,
  listWebEvents,
  deactivateEvent,
  reactivateEvent,
}
