/**
 * Equipamento — catálogo de equipamentos disponíveis.
 * Compatível com `master_equipment`.
 */
export interface Equipment {
  id: string
  id_tenant?: string
  name: string
  description: string
  quantity: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}
