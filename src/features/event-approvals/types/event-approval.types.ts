/**
 * Aprovação de evento (decisão do admin).
 * Compatível com `trx_event_approval` + `ref_approval_decision`.
 */

/** Códigos de decisão (ref_approval_decision.code) */
export type ApprovalDecisionCode = 'approved' | 'counter_proposed' | 'rejected'

/** Mapa código → id de ref_approval_decision (mock determinístico) */
export const APPROVAL_DECISION_IDS: Record<ApprovalDecisionCode, number> = {
  approved: 1,
  counter_proposed: 2,
  rejected: 3,
}

export interface EventApproval {
  id: string
  id_event: string
  id_slot: string
  id_reviewed_by: string
  /** mock: number (APPROVAL_DECISION_IDS); banco real: uuid (string) */
  id_decision: number | string
  decision: ApprovalDecisionCode
  reason?: string | null
  counter_date?: string | null
  created_at: string
  // Campos do banco real (trx_event_approval + ref_approval_decision)
  decision_code?: ApprovalDecisionCode
  decision_name?: string | null
  reviewed_at?: string
}

export interface CreateEventApprovalInput {
  id_event: string
  id_slot: string
  id_reviewed_by: string
  decision: ApprovalDecisionCode
  reason?: string | null
  counter_date?: string | null
}

export interface CounterProposalInput {
  id_event: string
  id_slot: string
  id_reviewed_by: string
  counter_date: string
  reason?: string | null
}
