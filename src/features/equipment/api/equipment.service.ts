/**
 * equipment.service — catálogo de equipamentos.
 *
 * MIGRAÇÃO (Etapa de conexão 1 — somente leitura):
 *  - As funções de LEITURA tentam o Supabase (`master_equipment`) e caem no
 *    fallback mock (localStorage) em caso de env ausente / erro / RLS / vazio.
 *  - ⚠️ Hoje a RLS de `master_equipment` bloqueia o papel anon (0 linhas), e a
 *    única view legível (`v_master_equipment_availability`) não traz
 *    is_active/description. Portanto, ATÉ auth/RLS, a leitura efetivamente
 *    permanece no mock. O caminho real já está cabeado para quando abrir.
 *  - As funções de ESCRITA usam RPCs admin reais (admin_create_equipment /
 *    admin_update_equipment / admin_set_equipment_active); fallback mock só em
 *    dev, protegido por canUseMockFallback() (fail-closed em produção).
 */
import type { Equipment } from '../types/equipment.types'
import {
  getEquipments,
  setEquipments,
  genId,
  nowIso,
  resolveAsync,
} from '../../events/mocks/event-storage.mock'
import { seedEventMockData } from '../../events/mocks/event.mock'
import { supabase, hasSupabaseEnv, canUseMockFallback } from '../../../lib/supabase/client'
import { logSupabaseError, friendlyAdminError, supabaseErrorMessage } from '../../../lib/supabase/supabase-error'

const EQUIPMENT_TABLE = 'master_equipment'

export interface EquipmentInput {
  name: string
  quantity: number
  description: string
}

/** Linha bruta de master_equipment (colunas defensivas: schema não introspectável via anon). */
interface EquipmentRow {
  id: string
  id_tenant?: string
  name?: string | null
  equipment_name?: string | null
  description?: string | null
  quantity?: number | null
  total_quantity?: number | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

/**
 * Ordena por última atividade decrescente (mais recentes primeiro), para que
 * equipamentos recém-criados OU recém-editados apareçam na primeira linha da
 * primeira página. A chave é `updated_at ?? created_at`, com `created_at` como
 * desempate. Aplicada em todos os caminhos de leitura (RPC por tenant, tabela
 * direta e mock), pois a ordenação da RPC não é garantida pelo front.
 * Itens sem qualquer data vão para o fim.
 */
function lastActivity(e: Equipment): string | undefined {
  return e.updated_at ?? e.created_at
}

function sortByLastActivityDesc(items: Equipment[]): Equipment[] {
  return [...items].sort((a, b) => {
    const actA = lastActivity(a)
    const actB = lastActivity(b)
    if (actA && actB && actA !== actB) return actB.localeCompare(actA)
    if (!actA && actB) return 1
    if (actA && !actB) return -1
    // desempate por created_at
    const createdA = a.created_at
    const createdB = b.created_at
    if (createdA && createdB) return createdB.localeCompare(createdA)
    if (!createdA && createdB) return 1
    if (createdA && !createdB) return -1
    return 0
  })
}

function mapEquipmentRow(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    id_tenant: row.id_tenant,
    name: row.name ?? row.equipment_name ?? '',
    description: row.description ?? '',
    quantity: row.quantity ?? row.total_quantity ?? 0,
    is_active: row.is_active ?? true,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  }
}

function mockEquipments(): Equipment[] {
  seedEventMockData()
  return getEquipments()
}

/** Catálogo visível ao público/líder: apenas ativos. */
export async function listEquipment(tenantSlug?: string | null): Promise<Equipment[]> {
  if (tenantSlug) {
    const { data, error } = await supabase.rpc('web_list_equipment_by_tenant', { p_tenant_slug: tenantSlug })
    if (error) {
      logSupabaseError('web_list_equipment_by_tenant', error)
      throw new Error(error.message || 'Não foi possível carregar os equipamentos.')
    }
    return sortByLastActivityDesc(((data ?? []) as Equipment[]).filter((e) => e.is_active))
  }
  if (hasSupabaseEnv()) {
    try {
      const { data, error } = await supabase
        .from(EQUIPMENT_TABLE)
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as EquipmentRow[]
      if (rows.length > 0) return sortByLastActivityDesc(rows.map(mapEquipmentRow))
      if (!canUseMockFallback()) return []
    } catch (e) {
      logSupabaseError('listEquipment', e)
      if (!canUseMockFallback()) throw e instanceof Error ? e : new Error('Não foi possível carregar os equipamentos.')
    }
  }
  return resolveAsync(sortByLastActivityDesc(mockEquipments().filter((e) => e.is_active)))
}

/** Listagem admin: todos os equipamentos (ativos e inativos), mais recentes primeiro. */
export async function listAllEquipment(tenantSlug?: string | null): Promise<Equipment[]> {
  if (tenantSlug) {
    const { data, error } = await supabase.rpc('web_list_equipment_by_tenant', { p_tenant_slug: tenantSlug })
    if (error) {
      logSupabaseError('web_list_equipment_by_tenant', error)
      throw new Error(error.message || 'Não foi possível carregar os equipamentos.')
    }
    return sortByLastActivityDesc((data ?? []) as Equipment[])
  }
  if (hasSupabaseEnv()) {
    try {
      const { data, error } = await supabase
        .from(EQUIPMENT_TABLE)
        .select('*')
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as EquipmentRow[]
      if (rows.length > 0) return sortByLastActivityDesc(rows.map(mapEquipmentRow))
      if (!canUseMockFallback()) return []
    } catch (e) {
      logSupabaseError('listAllEquipment', e)
      if (!canUseMockFallback()) throw e instanceof Error ? e : new Error('Não foi possível carregar os equipamentos.')
    }
  }
  return resolveAsync(sortByLastActivityDesc(mockEquipments()))
}

export async function getEquipmentById(
  idEquipment: string,
  tenantSlug?: string | null,
): Promise<Equipment | null> {
  if (tenantSlug) {
    const { data, error } = await supabase.rpc('web_get_equipment_by_tenant', {
      p_tenant_slug: tenantSlug,
      p_id: idEquipment,
    })
    if (error) {
      logSupabaseError('web_get_equipment_by_tenant', error)
      throw new Error(error.message || 'Não foi possível carregar o equipamento.')
    }
    return data ? mapEquipmentRow(data as EquipmentRow) : null
  }
  if (hasSupabaseEnv()) {
    try {
      const { data, error } = await supabase
        .from(EQUIPMENT_TABLE)
        .select('*')
        .eq('id', idEquipment)
        .maybeSingle()
      if (error) throw error
      if (data) return mapEquipmentRow(data as EquipmentRow)
      if (!canUseMockFallback()) return null
    } catch (e) {
      logSupabaseError('getEquipmentById', e)
      if (!canUseMockFallback()) throw e instanceof Error ? e : new Error('Não foi possível carregar o equipamento.')
    }
  }
  return resolveAsync(mockEquipments().find((e) => e.id === idEquipment) ?? null)
}

export async function createEquipment(input: EquipmentInput, tenantSlug?: string | null): Promise<Equipment> {
  if (tenantSlug) {
    const { data, error } = await supabase.rpc('web_create_equipment_by_tenant', {
      p_tenant_slug: tenantSlug,
      p_name: input.name,
      p_quantity: input.quantity,
      p_description: input.description,
    })
    if (error) {
      logSupabaseError('web_create_equipment_by_tenant', error)
      throw new Error(supabaseErrorMessage(error, 'Não foi possível criar o equipamento.'))
    }
    return mapEquipmentRow(data as EquipmentRow)
  }
  if (hasSupabaseEnv()) {
    try {
      const { data, error } = await supabase.rpc('admin_create_equipment', {
        p_name: input.name,
        p_quantity: input.quantity,
        p_description: input.description,
      })
      if (error) throw error
      return mapEquipmentRow(data as EquipmentRow)
    } catch (e) {
      logSupabaseError('createEquipment', e)
      if (!canUseMockFallback())
        throw new Error(friendlyAdminError(e, supabaseErrorMessage(e, 'Não foi possível criar o equipamento.')))
    }
  }
  // fallback mock (dev)
  seedEventMockData()
  const now = nowIso()
  const equipment: Equipment = {
    id: genId('eqp'),
    name: input.name.trim(),
    quantity: input.quantity,
    description: input.description.trim(),
    is_active: true,
    created_at: now,
    updated_at: now,
  }
  setEquipments([...getEquipments(), equipment])
  return resolveAsync(equipment)
}

export async function updateEquipment(id: string, input: EquipmentInput, tenantSlug?: string | null): Promise<Equipment> {
  if (tenantSlug) {
    const { data, error } = await supabase.rpc('web_update_equipment_by_tenant', {
      p_tenant_slug: tenantSlug,
      p_id: id,
      p_name: input.name,
      p_quantity: input.quantity,
      p_description: input.description,
    })
    if (error) {
      logSupabaseError('web_update_equipment_by_tenant', error)
      throw new Error(supabaseErrorMessage(error, 'Não foi possível atualizar o equipamento.'))
    }
    return mapEquipmentRow(data as EquipmentRow)
  }
  if (hasSupabaseEnv()) {
    try {
      const { data, error } = await supabase.rpc('admin_update_equipment', {
        p_id: id,
        p_name: input.name,
        p_quantity: input.quantity,
        p_description: input.description,
      })
      if (error) throw error
      return mapEquipmentRow(data as EquipmentRow)
    } catch (e) {
      logSupabaseError('updateEquipment', e)
      if (!canUseMockFallback())
        throw new Error(friendlyAdminError(e, supabaseErrorMessage(e, 'Não foi possível atualizar o equipamento.')))
    }
  }
  // fallback mock (dev)
  seedEventMockData()
  let updated: Equipment | null = null
  setEquipments(
    getEquipments().map((e) => {
      if (e.id !== id) return e
      updated = {
        ...e,
        name: input.name.trim(),
        quantity: input.quantity,
        description: input.description.trim(),
        updated_at: nowIso(),
      }
      return updated
    }),
  )
  if (!updated) throw new Error('Equipamento não encontrado')
  return resolveAsync(updated)
}

export async function setEquipmentActive(id: string, isActive: boolean, tenantSlug?: string | null): Promise<void> {
  if (tenantSlug) {
    const { error } = await supabase.rpc('web_set_equipment_active_by_tenant', {
      p_tenant_slug: tenantSlug,
      p_id: id,
      p_is_active: isActive,
    })
    if (error) {
      logSupabaseError('web_set_equipment_active_by_tenant', error)
      throw new Error(supabaseErrorMessage(error, 'Não foi possível atualizar o equipamento.'))
    }
    return
  }
  if (hasSupabaseEnv()) {
    try {
      const { error } = await supabase.rpc('admin_set_equipment_active', { p_id: id, p_is_active: isActive })
      if (error) throw error
      return
    } catch (e) {
      logSupabaseError('setEquipmentActive', e)
      // Erro de acesso → mensagem padronizada; demais (ex.: bloqueio por vínculo) → mensagem real do RPC.
      if (!canUseMockFallback())
        throw new Error(friendlyAdminError(e, supabaseErrorMessage(e, 'Não foi possível atualizar o equipamento.')))
    }
  }
  // fallback mock (dev)
  seedEventMockData()
  setEquipments(getEquipments().map((e) => (e.id === id ? { ...e, is_active: isActive } : e)))
  return resolveAsync(undefined)
}

export const equipmentService = {
  listEquipment,
  listAllEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  setEquipmentActive,
}
