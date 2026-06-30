import { supabase } from '../../../lib/supabase'

export interface SystemPermission {
  id: number
  code: string
  name: string
  description: string | null
}

/**
 * Garante que VIEW sempre esteja presente, sem hardcode de ID.
 * Localiza VIEW pelo campo code, não pelo id.
 * Lança erro amigável se VIEW não existir na lista.
 */
export function normalizeRolePermissions(
  selectedPermissionIds: number[],
  availablePermissions: SystemPermission[]
): number[] {
  const viewPermission = availablePermissions.find(p => p.code === 'VIEW')

  if (!viewPermission) {
    throw new Error('Permissão padrão Visualizar não encontrada.')
  }

  const withView = [viewPermission.id, ...selectedPermissionIds]
  return [...new Set(withView)]
}

/**
 * Busca permissões ativas e não-teste.
 * Nunca retorna fallback hardcoded — lança erro se a query falhar.
 */
export async function fetchActivePermissions(): Promise<SystemPermission[]> {
  const { data, error } = await supabase
    .from('master_system_permission')
    .select('id, code, name, description')
    .eq('is_active', true)
    .eq('is_test', false)
    .order('name')

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Salva permissões de um cargo via RPC transacional.
 * O RPC adiciona VIEW automaticamente se não estiver na lista.
 */
export async function saveRolePermissions(
  roleId: number,
  permissionIds: number[]
): Promise<void> {
  const { error } = await supabase.rpc('save_user_role_permissions', {
    p_role_id: roleId,
    p_permission_ids: permissionIds,
  })

  if (error) {
    throw new Error(error.message || 'Erro ao salvar permissões do cargo.')
  }
}
