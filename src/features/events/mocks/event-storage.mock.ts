/**
 * Camada de "banco em memória" do domínio de eventos (mock/localStorage).
 *
 * Centraliza as chaves, os acessores tipados por tabela e helpers de id/data.
 * Substituível por Supabase na Etapa 10 sem alterar os services (que só usam
 * estes acessores). Os demais features importam daqui.
 */
import type { EventMaster } from '../types/event.types'
import type { EventSlot } from '../../event-slots/types/event-slot.types'
import type { Equipment } from '../../equipment/types/equipment.types'
import type { EventEquipmentRequest } from '../../event-equipment/types/event-equipment.types'
import type { EventApproval } from '../../event-approvals/types/event-approval.types'
import type { EventAttendance } from '../../event-attendance/types/event-attendance.types'

export const STORAGE_KEYS = {
  events: 'cidade-na-mao:events',
  slots: 'cidade-na-mao:event-slots',
  equipmentRequests: 'cidade-na-mao:event-equipment-requests',
  approvals: 'cidade-na-mao:event-approvals',
  attendances: 'cidade-na-mao:event-attendances',
  equipments: 'cidade-na-mao:equipments',
} as const

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/** Lê uma "tabela" do localStorage; retorna [] em qualquer erro. */
export function readTable<T>(key: string): T[] {
  if (!hasStorage()) return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

/** Grava uma "tabela" no localStorage; silencioso se indisponível. */
export function writeTable<T>(key: string, rows: T[]): void {
  if (!hasStorage()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(rows))
  } catch {
    // localStorage indisponível (modo privado etc.)
  }
}

export function tableExists(key: string): boolean {
  if (!hasStorage()) return false
  try {
    return window.localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

// Acessores tipados por tabela ------------------------------------------------
export const getEvents = (): EventMaster[] => readTable<EventMaster>(STORAGE_KEYS.events)
export const setEvents = (rows: EventMaster[]): void => writeTable(STORAGE_KEYS.events, rows)

export const getSlots = (): EventSlot[] => readTable<EventSlot>(STORAGE_KEYS.slots)
export const setSlots = (rows: EventSlot[]): void => writeTable(STORAGE_KEYS.slots, rows)

export const getEquipments = (): Equipment[] => readTable<Equipment>(STORAGE_KEYS.equipments)
export const setEquipments = (rows: Equipment[]): void => writeTable(STORAGE_KEYS.equipments, rows)

export const getEquipmentRequests = (): EventEquipmentRequest[] =>
  readTable<EventEquipmentRequest>(STORAGE_KEYS.equipmentRequests)
export const setEquipmentRequests = (rows: EventEquipmentRequest[]): void =>
  writeTable(STORAGE_KEYS.equipmentRequests, rows)

export const getApprovals = (): EventApproval[] => readTable<EventApproval>(STORAGE_KEYS.approvals)
export const setApprovals = (rows: EventApproval[]): void => writeTable(STORAGE_KEYS.approvals, rows)

export const getAttendances = (): EventAttendance[] =>
  readTable<EventAttendance>(STORAGE_KEYS.attendances)
export const setAttendances = (rows: EventAttendance[]): void =>
  writeTable(STORAGE_KEYS.attendances, rows)

// Helpers ---------------------------------------------------------------------
let idCounter = 0

/** Gera um id estável o suficiente para o mock (UUID quando disponível). */
export function genId(prefix: string): string {
  idCounter += 1
  const c = globalThis.crypto
  const unique =
    c && typeof c.randomUUID === 'function'
      ? c.randomUUID()
      : `${Date.now().toString(36)}-${idCounter}`
  return `${prefix}_${unique}`
}

/** ISO timestamp do momento atual. */
export function nowIso(): string {
  return new Date().toISOString()
}

/** Simula a latência de uma chamada async para manter a UI realista. */
export function resolveAsync<T>(value: T): Promise<T> {
  return Promise.resolve(value)
}
