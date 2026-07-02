/**
 * event-notifications.service — notificação REAL aos inscritos confirmados
 * de um evento (edge function `notify-event-attendees`).
 *
 * O envio de e-mail acontece no BACKEND (edge function via SMTP), nunca no
 * front: o front só dispara a ação e recebe o resumo (total/enviados/falhas).
 * Sem mock/localStorage. Não notifica presenças canceladas nem e-mail inválido.
 */
import { supabase } from '../../../lib/supabase/client'
import { logSupabaseError } from '../../../lib/supabase/supabase-error'

export type EventChangeType = 'inactivated' | 'updated'

export interface NotifyAttendeesInput {
  id_event: string
  id_slot?: string | null
  change_type: EventChangeType
  /** Dados de exibição para compor a mensagem (já formatados em pt-BR). */
  event: { title: string; date: string; time: string; location: string }
  /** Linhas legíveis do que mudou (apenas para `updated`). */
  changes?: string[]
}

export interface NotifyAttendeesResult {
  /** Inscritos confirmados encontrados (alvo da notificação). */
  total: number
  /** E-mails enviados com sucesso. */
  sent: number
  /** E-mails que falharam no envio. */
  failed: number
  /** Confirmados sem e-mail válido (não notificados). */
  skipped_no_email: number
}

/** Dispara a notificação real aos inscritos confirmados. Lança em falha da chamada. */
export async function notifyEventAttendees(input: NotifyAttendeesInput): Promise<NotifyAttendeesResult> {
  const { data, error } = await supabase.functions.invoke('notify-event-attendees', { body: input })
  if (error) {
    logSupabaseError('notifyEventAttendees', error)
    throw new Error(error.message || 'Não foi possível notificar os inscritos.')
  }
  const r = (data ?? {}) as Partial<NotifyAttendeesResult>
  return {
    total: r.total ?? 0,
    sent: r.sent ?? 0,
    failed: r.failed ?? 0,
    skipped_no_email: r.skipped_no_email ?? 0,
  }
}

/**
 * Mensagem amigável (toast) a partir do resultado da notificação.
 * `action` é o particípio da ação já concluída ("inativado" | "atualizado").
 */
export function buildNotifyMessage(
  action: 'inativado' | 'atualizado',
  r: NotifyAttendeesResult,
): { text: string; type: 'success' | 'warning' } {
  const base = `Evento ${action}`
  // Sem inscritos confirmados: sucesso simples, ninguém a notificar.
  if (r.total === 0) return { text: `${base} com sucesso.`, type: 'success' }
  // Todos notificados.
  if (r.sent === r.total) return { text: `${base} e inscritos notificados com sucesso.`, type: 'success' }
  // Parte notificada.
  if (r.sent > 0) return { text: 'Evento salvo, mas não foi possível notificar alguns inscritos.', type: 'warning' }
  // Nenhum notificado (falha de envio e/ou sem e-mail válido).
  return { text: 'Evento salvo, mas houve falha ao notificar os inscritos.', type: 'warning' }
}
