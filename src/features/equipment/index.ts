export type { Equipment } from './types/equipment.types'
export type { EquipmentInput } from './api/equipment.service'

export {
  equipmentService,
  listEquipment,
  listAllEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  setEquipmentActive,
} from './api/equipment.service'

export { useEquipment } from './hooks/useEquipment'
export { useAllEquipment } from './hooks/useAllEquipment'
