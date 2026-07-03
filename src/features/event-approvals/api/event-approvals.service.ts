/**
 * event-approvals.service — decisões do admin sobre o mock/localStorage.
 *
 * Cada decisão registra uma linha em `event-approvals` e atualiza o
 * slot_status correspondente.
 */
import type { CounterProposalInput, EventApproval } from '../types/event-approval.types'
import { APPROVAL_DECISION_IDS } from '../types/event-approval.types'
import { SLOT_STATUS_IDS } from '../../event-slots/types/event-slot.types'
import type { SlotStatusCode } from '../../event-slots/types/event-slot.types'
import {
  getApprovals,
  setApprovals,
  getSlots,
  setSlots,
  genId,
  nowIso,
  resolveAsync,
} from '../../events/mocks/event-storage.mock'
import { seedEventMockData } from '../../events/mocks/event.mock'
import { supabase, hasSupabaseEnv, canUseMockFallback } from '../../../lib/supabase/client'
import { logSupabaseError, friendlyAdminError } from '../../../lib/supabase/supabase-error'

// Sem auth ainda: revisor padrão até a integração com perfis (Etapa 7).
const DEFAULT_REVIEWER = 'user-admin-1'

function patchSlot(idSlot: string, status: SlotStatusCode, extra: { approved_at?: string | null; counter_date?: string | null } = {}): void {
  setSlots(
    getSlots().map((s) =>
      s.id === idSlot
        ? { ...s, slot_status: status, id_slot_status: SLOT_STATUS_IDS[status], ...extra }
        : s,
    ),
  )
}

function recordApproval(row: Omit<EventApproval, 'id' | 'created_at'>): void {
  const approval: EventApproval = { ...row, id: genId('apr'), created_at: nowIso() }
  setApprovals([...getApprovals(), approval])
}

// ---------------------------------------------------------------------------
// ESCRITA — via RPC transacional (Fase M5, bloco admin).
// As RPCs validam role admin + tenant pelo contexto de auth (não enviamos
// id_reviewed_by/tenant). Fallback mock/localStorage só em dev se a RPC falhar
// ou se não houver env Supabase — REMOVER quando o fluxo real estiver firme.
// ---------------------------------------------------------------------------
export async function approveEvent(idEvent: string, idSlot: string, tenantSlug?: string | null): Promise<void> {
  if (tenantSlug) {
    const { error } = await supabase.rpc('web_approve_event_by_tenant', {
      p_tenant_slug: tenantSlug,
      p_id_event: idEvent,
      p_id_slot: idSlot,
    })
    if (error) {
      logSupabaseError('web_approve_event_by_tenant', error)
      throw new Error(error.message || 'Não foi possível aprovar o evento.')
    }
    return
  }
  if (hasSupabaseEnv()) {
    try {
      const { error } = await supabase.rpc('approve_event', { p_id_event: idEvent, p_id_slot: idSlot })
      if (error) throw error
      return
    } catch (e) {
      logSupabaseError('approveEvent', e)
      if (!canUseMockFallback()) throw new Error(friendlyAdminError(e, 'Não foi possível aprovar o evento.'))
    }
  }
  // fallback mock (dev)
  seedEventMockData()
  patchSlot(idSlot, 'approved', { approved_at: nowIso() })
  recordApproval({
    id_event: idEvent,
    id_slot: idSlot,
    id_reviewed_by: DEFAULT_REVIEWER,
    id_decision: APPROVAL_DECISION_IDS.approved,
    decision: 'approved',
    reason: null,
    counter_date: null,
  })
  return resolveAsync(undefined)
}

export async function proposeCounterDate(input: CounterProposalInput, tenantSlug?: string | null): Promise<void> {
  if (tenantSlug) {
    const { error } = await supabase.rpc('web_propose_counter_date_by_tenant', {
      p_tenant_slug: tenantSlug,
      p_id_event: input.id_event,
      p_id_slot: input.id_slot,
      p_counter_date: input.counter_date,
      p_reason: input.reason ?? '',
    })
    if (error) {
      logSupabaseError('web_propose_counter_date_by_tenant', error)
      throw new Error(error.message || 'Não foi possível propor nova data.')
    }
    return
  }
  if (hasSupabaseEnv()) {
    try {
      const { error } = await supabase.rpc('propose_counter_date', {
        p_id_event: input.id_event,
        p_id_slot: input.id_slot,
        p_counter_date: input.counter_date,
        p_reason: input.reason ?? '',
      })
      if (error) throw error
      return
    } catch (e) {
      logSupabaseError('proposeCounterDate', e)
      if (!canUseMockFallback()) throw new Error(friendlyAdminError(e, 'Não foi possível propor nova data.'))
    }
  }
  // fallback mock (dev)
  seedEventMockData()
  patchSlot(input.id_slot, 'counter_proposed', { counter_date: input.counter_date, approved_at: null })
  recordApproval({
    id_event: input.id_event,
    id_slot: input.id_slot,
    id_reviewed_by: input.id_reviewed_by || DEFAULT_REVIEWER,
    id_decision: APPROVAL_DECISION_IDS.counter_proposed,
    decision: 'counter_proposed',
    reason: input.reason ?? null,
    counter_date: input.counter_date,
  })
  return resolveAsync(undefined)
}

export async function rejectEvent(idEvent: string, idSlot: string, reason: string): Promise<void> {
  if (hasSupabaseEnv()) {
    try {
      const { error } = await supabase.rpc('reject_event', {
        p_id_event: idEvent,
        p_id_slot: idSlot,
        p_reason: reason,
      })
      if (error) throw error
      return
    } catch (e) {
      logSupabaseError('rejectEvent', e)
      if (!canUseMockFallback()) throw new Error(friendlyAdminError(e, 'Não foi possível reprovar o evento.'))
    }
  }
  // fallback mock (dev)
  seedEventMockData()
  patchSlot(idSlot, 'rejected')
  recordApproval({
    id_event: idEvent,
    id_slot: idSlot,
    id_reviewed_by: DEFAULT_REVIEWER,
    id_decision: APPROVAL_DECISION_IDS.rejected,
    decision: 'rejected',
    reason,
    counter_date: null,
  })
  return resolveAsync(undefined)
}

/** Linha bruta de trx_event_approval + embed de ref_approval_decision. */
interface ApprovalRow {
  id: string
  id_event: string
  id_slot: string | null
  id_reviewed_by: string
  id_decision: string
  reason: string | null
  counter_date: string | null
  reviewed_at: string
  ref_approval_decision: { code: string; name: string | null } | null
}

function mapApprovalRow(row: ApprovalRow): EventApproval {
  const code = (row.ref_approval_decision?.code ?? 'approved') as ApprovalDecisionCode
  return {
    id: row.id,
    id_event: row.id_event,
    id_slot: row.id_slot ?? '',
    id_reviewed_by: row.id_reviewed_by,
    id_decision: row.id_decision,
    decision: code,
    decision_code: code,
    decision_name: row.ref_approval_decision?.name ?? null,
    reason: row.reason ?? null,
    counter_date: row.counter_date ?? null,
    reviewed_at: row.reviewed_at,
    created_at: row.reviewed_at,
  }
}

/**
 * Última decisão registrada para um evento/slot (motivo/contraproposta).
 * LEITURA real em `trx_event_approval` (+ `ref_approval_decision`), com RLS:
 * admin vê o tenant; líder vê os próprios eventos; anon não lê.
 * Fallback mock só em dev (env ausente / erro / vazio).
 */
export async function getLatestApproval(
  idEvent: string,
  idSlot?: string,
): Promise<EventApproval | null> {
  if (hasSupabaseEnv()) {
    try {
      let query = supabase
        .from('trx_event_approval')
        .select(
          'id, id_event, id_slot, id_reviewed_by, id_decision, reason, counter_date, reviewed_at, ref_approval_decision(code,name)',
        )
        .eq('id_event', idEvent)
      if (idSlot) query = query.eq('id_slot', idSlot)
      query = query.order('reviewed_at', { ascending: false }).limit(1)
      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as unknown as ApprovalRow[]
      if (rows.length > 0) return mapApprovalRow(rows[0])
      // Produção: sem decisão registrada → null (sem mock).
      if (!canUseMockFallback()) return null
    } catch (e) {
      logSupabaseError('getLatestApproval', e)
      if (!canUseMockFallback()) throw e instanceof Error ? e : new Error('Não foi possível carregar a decisão.')
    }
  }
  // fallback mock (dev)
  seedEventMockData()
  const matches = getApprovals().filter(
    (a) => a.id_event === idEvent && (idSlot ? a.id_slot === idSlot : true),
  )
  const latest = matches.reduce<EventApproval | null>((acc, cur) => {
    if (!acc) return cur
    return cur.created_at >= acc.created_at ? cur : acc
  }, null)
  return resolveAsync(latest)
}

export const eventApprovalsService = {
  approveEvent,
  proposeCounterDate,
  rejectEvent,
  getLatestApproval,
}
