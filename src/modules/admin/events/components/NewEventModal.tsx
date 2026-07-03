import { useState } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { useLockBodyScroll } from '../../../../shared/hooks/useLockBodyScroll'
import { useEquipment } from '../../../../features/equipment'
import { adminCreateEvent } from '../../../../features/events'
import { useWebTenant } from '../../../../features/web-tenant'
import { NewEventInfoStep } from './NewEventInfoStep'
import { EditEventEquipmentTab, type EquipItem } from './EditEventEquipmentTab'
import {
  EMPTY_NEW_EVENT_FORM,
  type NewEventFormData,
  type NewEventFormErrors,
} from './newEvent.model'

interface NewEventModalProps {
  open: boolean
  onClose: () => void
  /** Chamado após criar o evento com sucesso (para recarregar a lista). */
  onSaved: () => void
}

type Step = 'info' | 'equipment'

function validate(form: NewEventFormData): NewEventFormErrors {
  const errors: NewEventFormErrors = {}
  if (!form.banner) errors.banner = true
  if (!form.name.trim()) errors.name = true
  if (!form.day) errors.day = true
  if (!form.time) errors.time = true
  if (!form.location.trim()) errors.location = true
  if (!form.capacity || Number(form.capacity) < 1) errors.capacity = true
  if (!form.description.trim()) errors.description = true
  return errors
}

/**
 * Modal "Novo Evento" (web/admin) — fluxo em 2 etapas:
 *   Etapa 1: informações do evento  →  Etapa 2: equipamentos necessários.
 * Persistência real ainda pendente (RPC M5-B `create_event_request`); o
 * "Finalizar" conclui o fluxo visual sem gravar. Catálogo de equipamentos vem
 * de `useEquipment` (hoje mock/localStorage até auth/RLS abrir a leitura real).
 */
export function NewEventModal({ open, onClose, onSaved }: NewEventModalProps) {
  const { tenant } = useWebTenant()
  const { data: catalog } = useEquipment(tenant)
  const [step, setStep] = useState<Step>('info')
  const [form, setForm] = useState<NewEventFormData>(EMPTY_NEW_EVENT_FORM)
  const [errors, setErrors] = useState<NewEventFormErrors>({})
  const [equipment, setEquipment] = useState<EquipItem[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useLockBodyScroll(open)

  if (!open) return null

  const handleClose = () => {
    setStep('info')
    setForm(EMPTY_NEW_EVENT_FORM)
    setErrors({})
    setEquipment([])
    setSaving(false)
    setSaveError(null)
    onClose()
  }

  const handleChange = (patch: Partial<NewEventFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(patch)) delete next[key as keyof NewEventFormErrors]
      return next
    })
  }

  const handleContinue = () => {
    const found = validate(form)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    setErrors({})
    setStep('equipment')
  }

  const handleFinish = async () => {
    setSaveError(null)
    const dt = new Date(`${form.day}T${form.time}`)
    if (Number.isNaN(dt.getTime())) {
      setSaveError('Data/hora inválida.')
      return
    }
    setSaving(true)
    try {
      await adminCreateEvent({
        title: form.name.trim(),
        description: form.description.trim(),
        banner_url: form.banner,
        location: form.location.trim(),
        requested_at: dt.toISOString(),
        capacity: Number(form.capacity),
        equipment,
      }, tenant)
      onSaved()
      handleClose()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Não foi possível criar o evento.')
    } finally {
      setSaving(false)
    }
  }

  const hasErrors = Object.keys(errors).length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:justify-end"
      onClick={handleClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-6 py-4">
          <MaterialIcon name="calendar_month" size={24} className="text-[#1e558b]" />
          <h1 className="text-[20px] font-bold text-[#0f3255]">Novo Evento</h1>
          <span className="ml-auto text-[13px] font-semibold text-[#919191]">
            {step === 'info' ? 'Etapa 1 de 2 · Informações' : 'Etapa 2 de 2 · Equipamentos'}
          </span>
        </div>
        <div className="border-b border-[#e2e8f0]" />

        {/* Conteúdo (scroll interno) */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 'info' ? (
            <>
              <NewEventInfoStep data={form} errors={errors} onChange={handleChange} />
              {hasErrors && (
                <p className="mt-3 text-[13px] text-[#eb5757]">Preencha todos os campos obrigatórios.</p>
              )}
            </>
          ) : (
            <>
              <h2 className="mb-3 text-[16px] font-bold text-[#0f3255]">Equipamentos necessários</h2>
              <EditEventEquipmentTab items={equipment} catalog={catalog} onChange={setEquipment} />
            </>
          )}

          {saveError && <p className="mt-3 text-[13px] text-[#eb5757]">{saveError}</p>}
        </div>

        {/* Footer fixo */}
        <div className="border-t border-[#e2e8f0]" />
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          {step === 'info' ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="h-[45px] rounded-[5px] border border-[#0f3255] px-6 text-[14px] font-semibold text-[#0f3255]"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="h-[45px] rounded-[5px] bg-[#1e558b] px-8 text-[14px] font-bold text-white"
              >
                Continuar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('info')}
                disabled={saving}
                className="h-[45px] rounded-[5px] border border-[#0f3255] px-6 text-[14px] font-semibold text-[#0f3255] disabled:opacity-60"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="h-[45px] rounded-[5px] bg-[#1e558b] px-8 text-[14px] font-bold text-white disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Finalizar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
