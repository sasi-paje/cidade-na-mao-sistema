import { supabase } from '../../../lib/supabase'

export interface SystemPage {
  id: number
  name: string
  code: string
  route_path: string
  module_name: string
  display_order: number | null
}

/**
 * Busca as páginas do sistema disponíveis para vinculação a usuários.
 * `master_system_page` é um catálogo global — sempre filtrado com is_test=false,
 * da mesma forma que `master_system_permission`.
 */
export async function fetchAvailablePages(): Promise<SystemPage[]> {
  const { data, error } = await supabase
    .from('master_system_page')
    .select('id, code, name, route_path, module_name, display_order')
    .eq('is_active', true)
    .eq('is_test', false)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw new Error('Não foi possível carregar as páginas do sistema.')
  }

  return data || []
}
