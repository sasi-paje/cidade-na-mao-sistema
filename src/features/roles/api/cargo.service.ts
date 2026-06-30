import { supabase } from '../../../lib/supabase'

export interface CargoDuplicateResult {
  isDuplicate: boolean
  isInactive: boolean
}

/**
 * Verifica se já existe um cargo com o mesmo nome no mesmo ambiente.
 * Aplica trim() defensivamente antes de consultar.
 * Em modo edição, passa excludeId para não comparar com o próprio cargo.
 */
export async function checkCargoDuplicate(
  name: string,
  isTest: boolean,
  excludeId?: string | number
): Promise<CargoDuplicateResult> {
  const normalizedName = name.trim()

  const { data, error } = excludeId !== undefined
    ? await supabase
        .from('master_user_role')
        .select('id, is_active')
        .eq('name', normalizedName)
        .eq('is_test', isTest)
        .neq('id', excludeId)
        .maybeSingle()
    : await supabase
        .from('master_user_role')
        .select('id, is_active')
        .eq('name', normalizedName)
        .eq('is_test', isTest)
        .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return { isDuplicate: false, isInactive: false }

  return { isDuplicate: true, isInactive: data.is_active === false }
}

/**
 * Retorna a mensagem de erro amigável para duplicidade de cargo.
 */
export function getDuplicateCargoMessage(isInactive: boolean, isEdit: boolean): string {
  if (isEdit) return 'Já existe outro cargo cadastrado com este nome.'
  if (isInactive) return 'Já existe um cargo inativo com este nome. Ative o cargo existente ou escolha outro nome.'
  return 'Já existe um cargo cadastrado com este nome.'
}

/**
 * Mapeia erros do Supabase para mensagens amigáveis.
 * Trata o código 23505 (unique constraint) para evitar mensagem técnica.
 */
export function getFriendlyCargoSaveError(error: {
  code?: string
  message?: string
}): string {
  if (error.code === '23505') return 'Já existe um cargo cadastrado com este nome.'
  return error.message || 'Erro ao salvar cargo.'
}

// ── Ativação ────────────────────────────────────────────────

/**
 * Ativa o cargo. Não altera permissões.
 */
export async function activateCargo(roleId: string | number, isTest: boolean): Promise<void> {
  const { error } = await supabase
    .from('master_user_role')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', Number(roleId))
    .eq('is_test', isTest)

  if (error) throw new Error(error.message || 'Não foi possível ativar o cargo.')
}

// ── Inativação ──────────────────────────────────────────────

/**
 * Inativa o cargo via RPC transacional.
 * Não apaga permissões — apenas seta is_active = false.
 */
export async function inactivateCargo(roleId: string | number, isTest: boolean): Promise<void> {
  const { error } = await supabase.rpc('inactivate_user_role', {
    p_role_id: Number(roleId),
    p_is_test: isTest,
  })

  if (error) throw new Error(getFriendlyCargoInactivationError(error))
}

/**
 * Converte erros técnicos de inativação em mensagens amigáveis.
 */
export function getFriendlyCargoInactivationError(error: {
  code?: string
  message?: string
}): string {
  const msg = error.message || ''
  const code = error.code || ''
  if (code === 'PGRST202' || msg.toLowerCase().includes('could not find')) {
    return 'Função de inativação não encontrada no banco. Verifique se a migration foi aplicada.'
  }
  if (msg.includes('usuários ativos vinculados')) {
    return 'Este cargo possui usuários ativos vinculados e não pode ser inativado.'
  }
  if (msg.includes('já está inativo')) return 'Este cargo já está inativo.'
  if (msg.includes('não encontrado')) return 'Cargo não encontrado.'
  return 'Não foi possível inativar o cargo.'
}
