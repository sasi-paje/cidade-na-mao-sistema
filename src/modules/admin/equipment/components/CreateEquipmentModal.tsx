import { useState } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { useLockBodyScroll } from '../../../../shared/hooks/useLockBodyScroll'
import { createEquipment } from '../../../../features/equipment'
import { EquipmentForm } from './EquipmentForm'
import {
  EMPTY_EQUIPMENT_FORM,
  validateEquipmentForm,
  formToInput,
  type EquipmentFormData,
  type EquipmentFormErrors,
} from './equipmentForm.model'

interface CreateEquipmentModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function CreateEquipmentModal({ open, onClose, onSaved }: CreateEquipmentModalProps) {
  const [form, setForm] = useState<EquipmentFormData>(EMPTY_EQUIPMENT_FORM)
  const [errors, setErrors] = useState<EquipmentFormErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useLockBodyScroll(open)

  if (!open) return null

  const handleClose = () => {
    setForm(EMPTY_EQUIPMENT_FORM)
    setErrors({})
    setSaveError(null)
    onClose()
  }

  const handleChange = (patch: Partial<EquipmentFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(patch)) delete next[key as keyof EquipmentFormErrors]
      return next
    })
  }

  const handleSave = async () => {
    const found = validateEquipmentForm(form)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await createEquipment(formToInput(form))
      onSaved()
      handleClose()
    } catch (e) {
      setSaveError(
        e instanceof Error && e.message
          ? e.message
          : 'Não foi possível criar o equipamento. Tente novamente.',
      )
      setSaving(false)
    }
  }

  const hasErrors = Object.keys(errors).length > 0

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:justify-end" onClick={handleClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-6 py-4">
          <MaterialIcon name="inventory_2" size={24} className="text-[#1e558b]" />
          <h1 className="text-[20px] font-bold text-[#0f3255]">Criar Equipamento</h1>
        </div>
        <div className="border-b border-[#e2e8f0]" />

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <EquipmentForm data={form} errors={errors} onChange={handleChange} />
          {hasErrors && (
            <p className="mt-3 text-[13px] text-[#eb5757]">Preencha todos os campos obrigatórios.</p>
          )}
          {saveError && (
            <p className="mt-3 rounded-[5px] bg-[#fdecec] px-3 py-2 text-[13px] text-[#eb5757]">{saveError}</p>
          )}
        </div>

        <div className="border-t border-[#e2e8f0]" />
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="h-[45px] rounded-[5px] border border-[#0f3255] px-6 text-[14px] font-semibold text-[#0f3255]"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-[45px] rounded-[5px] bg-[#1e558b] px-8 text-[14px] font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
