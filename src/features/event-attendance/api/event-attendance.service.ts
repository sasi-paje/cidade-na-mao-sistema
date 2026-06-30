/**
 * event-attendance.service — participações REAIS no Supabase (M5-B).
 *
 * Modelo A: presença por usuário autenticado (current_user_id() via RPC),
 * reusa trx_event_attendance (id_user). Sem mock/localStorage como fonte de
 * verdade. RLS por tenant; escrita via RPCs SECURITY DEFINER.
 *  - identidade da participação = id_slot + id_user (unique no banco)
 *  - confirmar = confirm_attendance; cancelar = cancel_attendance (status)
 */
import type {
  AttendanceStatusCode,
  ConfirmAttendanceInput,
  EventAttendance,
} from '../types/event-attendance.types'
import { supabase } from '../../../lib/supabase/client'
import { logSupabaseError } from '../../../lib/supabase/supabase-error'

/** Pessoa confirmada (visão admin) — dados reais de trx_event_attendance. */
export interface ConfirmedPerson {
  /** id do registro de presença */
  id: string
  name: string
  email: string | null
  status: string
  confirmed_at: string | null
}

/**
 * Lista REAL de pessoas confirmadas de um evento/slot (sem mock).
 * Lê `trx_event_attendance` + join `master_user`/`ref_attendance_status`,
 * governado por RLS (admin vê o tenant). Lança em falha; vazio = sem confirmados.
 */
export async function listConfirmedPeopleByEvent(
  idEvent: string,
  idSlot?: string | null,
): Promise<ConfirmedPerson[]> {
  interface Row {
    id: string
    confirmed_at: string | null
    user: { name: string | null; email: string | null } | null
    status: { code: string } | null
  }
  let query = supabase
    .from('trx_event_attendance')
    .select('id, confirmed_at, user:master_user(name, email), status:ref_attendance_status(code)')
    .eq('id_event', idEvent)
  if (idSlot) query = query.eq('id_slot', idSlot)

  const { data, error } = await query.order('confirmed_at', { ascending: false })
  if (error) {
    logSupabaseError('listConfirmedPeopleByEvent', error)
    throw new Error(error.message || 'Não foi possível carregar as pessoas confirmadas.')
  }
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.status?.code === 'confirmed')
    .map((r) => ({
      id: r.id,
      name: r.user?.name ?? '—',
      email: r.user?.email ?? null,
      status: r.status?.code ?? '',
      confirmed_at: r.confirmed_at,
    }))
}

/** Linha bruta de trx_event_attendance + embed do status. */
interface AttendanceRow {
  id: string
  id_event: string
  id_slot: string
  id_user: string
  confirmed_at: string | null
  status: { code: string } | null
}

const ATTENDANCE_SELECT = 'id, id_event, id_slot, id_user, confirmed_at, status:ref_attendance_status(code)'

function mapAttendanceRow(r: AttendanceRow): EventAttendance {
  return {
    id: r.id,
    id_event: r.id_event,
    id_slot: r.id_slot,
    id_user: r.id_user,
    id_attendance_status: 0, // uuid real no banco; não usado pela UI
    status: (r.status?.code as AttendanceStatusCode) ?? 'cancelled',
    created_at: r.confirmed_at ?? '',
  }
}

/** Confirma presença (real) via RPC `confirm_attendance` — usa current_user_id(). */
export async function confirmAttendance(input: ConfirmAttendanceInput): Promise<EventAttendance> {
  const { data, error } = await supabase.rpc('confirm_attendance', {
    p_id_event: input.id_event,
    p_id_slot: input.id_slot,
  })
  if (error) {
    logSupabaseError('confirmAttendance', error)
    throw new Error(error.message || 'Não foi possível confirmar a participação.')
  }
  const r = data as { id_attendance: string; status: string; confirmed_at: string | null }
  return {
    id: r.id_attendance,
    id_event: input.id_event,
    id_slot: input.id_slot,
    id_user: input.id_user,
    id_attendance_status: 0,
    status: (r.status as AttendanceStatusCode) ?? 'confirmed',
    created_at: r.confirmed_at ?? '',
  }
}

/** Cancela a própria presença (real) via RPC `cancel_attendance`. */
export async function cancelAttendance(idEvent: string, idSlot: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_attendance', {
    p_id_event: idEvent,
    p_id_slot: idSlot,
  })
  if (error) {
    logSupabaseError('cancelAttendance', error)
    throw new Error(error.message || 'Não foi possível cancelar a participação.')
  }
}

/** Presença do usuário em um slot (real). null = sem registro. */
export async function getMyAttendance(
  idEvent: string,
  idSlot: string,
  idUser: string,
): Promise<EventAttendance | null> {
  const { data, error } = await supabase
    .from('trx_event_attendance')
    .select(ATTENDANCE_SELECT)
    .eq('id_event', idEvent)
    .eq('id_slot', idSlot)
    .eq('id_user', idUser)
    .maybeSingle()
  if (error) {
    logSupabaseError('getMyAttendance', error)
    throw new Error(error.message || 'Não foi possível carregar a participação.')
  }
  if (!data) return null
  return mapAttendanceRow(data as unknown as AttendanceRow)
}

/** "Meus Eventos": participações confirmadas do usuário (real). */
export async function listMyAttendances(idUser: string): Promise<EventAttendance[]> {
  const { data, error } = await supabase
    .from('trx_event_attendance')
    .select(ATTENDANCE_SELECT)
    .eq('id_user', idUser)
  if (error) {
    logSupabaseError('listMyAttendances', error)
    throw new Error(error.message || 'Não foi possível carregar suas participações.')
  }
  return ((data ?? []) as unknown as AttendanceRow[])
    .filter((r) => r.status?.code === 'confirmed')
    .map(mapAttendanceRow)
}

/** Pessoas confirmadas em um slot (visão admin, real). */
export async function listEventAttendances(idEvent: string, idSlot: string): Promise<EventAttendance[]> {
  const { data, error } = await supabase
    .from('trx_event_attendance')
    .select(ATTENDANCE_SELECT)
    .eq('id_event', idEvent)
    .eq('id_slot', idSlot)
  if (error) {
    logSupabaseError('listEventAttendances', error)
    throw new Error(error.message || 'Não foi possível carregar as presenças.')
  }
  return ((data ?? []) as unknown as AttendanceRow[])
    .filter((r) => r.status?.code === 'confirmed')
    .map(mapAttendanceRow)
}

export const eventAttendanceService = {
  confirmAttendance,
  cancelAttendance,
  getMyAttendance,
  listMyAttendances,
  listEventAttendances,
}
