/**
 * Formatação de data/hora de eventos (pt-BR).
 */

/** Ex.: "qui., 16 de abr. às 22h" a partir de um ISO datetime. */
export function formatEventDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const datePart = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(date)

  const hours = date.getHours()
  const minutes = date.getMinutes()
  const timePart = minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, '0')}`

  return `${datePart} às ${timePart}`
}

/** Ex.: "14/04/2025" */
export function formatEventDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const MONTHS_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** Nomes de mês por extenso (pt-BR), para o cabeçalho do calendário. */
export const MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
/** Abreviações dos dias da semana (Dom..Sáb), para o grid do calendário. */
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Chave de dia local `YYYY-MM-DD` a partir de um Date. */
export function dateToDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Dia de HOJE (local) no formato do input date (`YYYY-MM-DD`). */
export function todayDayKey(): string {
  return dateToDayKey(new Date())
}

/**
 * true se `day` (`YYYY-MM-DD`) é ANTERIOR a hoje — usado para bloquear registro
 * de eventos com data inferior ao dia atual. Strings vazias/ inválidas → false
 * (a obrigatoriedade do campo é tratada à parte). Comparação lexicográfica de
 * `YYYY-MM-DD` equivale à cronológica.
 */
export function isPastDay(day: string | null | undefined): boolean {
  if (!day) return false
  return day < todayDayKey()
}

/**
 * true se o evento (ISO datetime) JÁ OCORREU — a data/hora do evento é anterior
 * ao momento atual. Usado para congelar ações de um evento passado (ex.: não
 * cancelar ingresso no mobile, não inativar no web). ISO inválido → false.
 */
export function isPastEvent(iso: string | null | undefined): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && t < Date.now()
}

/** Chave de dia local `YYYY-MM-DD` a partir de um ISO; null se inválido. */
export function toDayKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return dateToDayKey(d)
}

/** Ex.: "16 de Abr" (usado no cabeçalho quando há filtro de data ativo). */
export function formatDayMonthShort(d: Date): string {
  return `${d.getDate()} de ${MONTHS_ABBR[d.getMonth()]}`
}

export interface EventDateParts {
  /** Dia da semana por extenso, ex.: "Quinta". Vazio se data inválida. */
  dow: string
  /** Dia do mês, ex.: "16". */
  day: string
  /** Mês abreviado capitalizado, ex.: "Abr". */
  mon: string
  /** Hora formatada, ex.: "22h" ou "22h30". */
  hour: string
  valid: boolean
}

/**
 * Decompõe um ISO datetime nas partes usadas pelos cards/detalhes mobile,
 * no formato visual do guia: "Quinta, 16 de Abr às 22h".
 */
export function formatEventDateParts(iso: string | null | undefined): EventDateParts {
  const empty: EventDateParts = { dow: '', day: '', mon: '', hour: '', valid: false }
  if (!iso) return empty
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return empty

  const hours = date.getHours()
  const minutes = date.getMinutes()
  return {
    dow: WEEKDAYS[date.getDay()],
    day: String(date.getDate()),
    mon: MONTHS_ABBR[date.getMonth()],
    hour: minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, '0')}`,
    valid: true,
  }
}

/** Ex.: "21:00" */
export function formatEventTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
}
