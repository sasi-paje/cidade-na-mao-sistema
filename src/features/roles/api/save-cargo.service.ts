import { supabase } from '../../../lib/supabase'
import { getFriendlyCargoSaveError } from './cargo.service'

export interface SavedCargo {
  id: number
  name: string
  code: string
  is_active: boolean
  is_test: boolean
}

/**
 * Cria ou atualiza um cargo junto com suas permissões em uma única transação.
 * roleId = null/undefined → criar novo; roleId preenchido → atualizar existente.
 * VIEW é sempre incluído pela RPC — não é necessário passá-lo em permissionIds.
 */
export async function saveCargoWithPermissions(params: {
  roleId?: string | number | null
  name: string
  code?: string | null
  isTest: boolean
  permissionIds: number[]
}): Promise<SavedCargo> {
  const { roleId, name, code, isTest, permissionIds } = params

  const { data, error } = await supabase.rpc('save_user_role_with_permissions', {
    p_role_id: roleId != null ? Number(roleId) : null,
    p_name: name,
    p_code: code ?? null,
    p_is_test: isTest,
    p_permission_ids: permissionIds,
  })

  if (error) {
    throw new Error(getFriendlyCargoSaveError(error))
  }

  const row = Array.isArray(data) ? data[0] : data
  return row as SavedCargo
}
