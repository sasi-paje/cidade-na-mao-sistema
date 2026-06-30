import { supabase } from '../../../lib/supabase'

export async function saveUserPageAccessFromRole(params: {
  userId: string
  roleId: string | number
  pageIds: (string | number)[]
  isTest: boolean
}): Promise<void> {
  const { userId, roleId, pageIds, isTest } = params

  const { error } = await supabase.rpc('save_user_page_access_from_role', {
    p_user_id: userId,
    p_role_id: Number(roleId),
    p_page_ids: pageIds.map(Number),
    p_is_test: isTest,
  })

  if (error) {
    throw new Error(getFriendlyUserPageAccessError(error))
  }
}

export function getFriendlyUserPageAccessError(error: {
  code?: string
  message?: string
}): string {
  const msg = error.message || ''
  const code = error.code || ''

  if (code === 'PGRST202' || msg.toLowerCase().includes('could not find')) {
    return 'Função de sincronização de páginas não encontrada. Verifique se a migration foi aplicada.'
  }
  if (msg.includes('Usuário não encontrado')) return 'Usuário não encontrado.'
  if (msg.includes('Cargo não encontrado') || msg.includes('inativo')) {
    return 'Cargo não encontrado ou inativo.'
  }
  if (msg.includes('páginas inválidas') || msg.includes('inativas foram enviadas')) {
    return 'Uma ou mais páginas selecionadas são inválidas ou inativas.'
  }
  return msg || 'Não foi possível salvar as permissões do usuário.'
}
