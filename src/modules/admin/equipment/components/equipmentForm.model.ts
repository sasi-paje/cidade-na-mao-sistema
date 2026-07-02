import type { Equipment, EquipmentInput } from '../../../../features/equipment'

export interface EquipmentFormData {
  name: string
  quantity: string
  description: string
}

export type EquipmentFormErrors = Partial<Record<keyof EquipmentFormData, boolean>>

export const EMPTY_EQUIPMENT_FORM: EquipmentFormData = {
  name: '',
  quantity: '',
  description: '',
}

export function equipmentToForm(equipment: Equipment): EquipmentFormData {
  return {
    name: equipment.name,
    quantity: String(equipment.quantity),
    description: equipment.description,
  }
}

export function validateEquipmentForm(form: EquipmentFormData): EquipmentFormErrors {
  const errors: EquipmentFormErrors = {}
  if (!form.name.trim()) errors.name = true
  if (form.quantity === '' || Number.isNaN(Number(form.quantity)) || Number(form.quantity) <= 0) {
    errors.quantity = true
  }
  if (!form.description.trim()) errors.description = true
  return errors
}

export function formToInput(form: EquipmentFormData): EquipmentInput {
  return {
    name: form.name.trim(),
    quantity: Number(form.quantity),
    description: form.description.trim(),
  }
}
