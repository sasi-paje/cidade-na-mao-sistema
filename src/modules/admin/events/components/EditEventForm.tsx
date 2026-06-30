import { useState } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { adminUpdateEvent } from '../../../../features/events'
import type { EventFullView } from '../../../../features/events'
import type { Equipment } from '../../../../features/equipment'
import { NewEventInfoStep } from './NewEventInfoStep'
import { EditEventEquipmentTab, type EquipItem } from './EditEventEquipmentTab'
import {
  type NewEventFormData,
  type NewEventFormErrors,
} from './newEvent.model'

interface EditEventFormProps {
  event: EventFullView
  catalog: Equipment[]
  onClose: () => void
  onSaved: () => void
}

type EditTab = 'info' | 'equipment'

const pad = (n: number) => String(n).padStart(2, '0')

/** Converte o evento (ISO em UTC) para o formato do formulário (Dia/Hora locais). */
function eventToForm(event: EventFullView): NewEventFormData {
  const dt = event.requested_at ? new Date(event.requested_at) : null
  const ok = dt && !Number.isNaN(dt.getTime())
  return {
    banner: event.banner_url ?? null,
    name: event.title ?? '',
    day: ok ? `${dt!.getFullYear()}-${pad(dt!.getMonth() + 1)}-${pad(dt!.getDate())}` : '',
    time: ok ? `${pad(dt!.getHours())}:${pad(dt!.getMinutes())}` : '',
    location: event.location ?? '',
    capacity: event.capacity != null ? String(event.capacity) : '',
    description: event.description ?? '',
  }
}

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
 * Formulário de edição de evento (web/admin) — salva REAL via `admin_update_event`.
 * Inicializa a partir do evento completo (já com equipamentos). Sem mock.
 * Montado com `key={event.id_event}` para reinicializar a cada abertura.
 */
export function EditEventForm({ event, catalog, onClose, onSaved }: EditEventFormProps) {
  const [tab, setTab] = useState<EditTab>('info')
  const [form, setForm] = useState<NewEventFormData>(() => eventToForm(event))
  const [errors, setErrors] = useState<NewEventFormErrors>({})
  const [equipment, setEquipment] = useState<EquipItem[]>(() =>
    (event.equipment_requests ?? []).map((r) => ({ id_equipment: r.id_equipment, quantity: r.quantity })),
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleChange = (patch: Partial<NewEventFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(patch)) delete next[key as keyof NewEventFormErrors]
      return next
    })
  }

  const handleSave = async () => {
    const found = validate(form)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      setTab('info')
      return
    }
    const dt = new Date(`${form.day}T${form.time}`)
    if (Number.isNaN(dt.getTime())) {
      setSaveError('Data/hora inválida.')
      return
    }
    setSaveError(null)
    setSaving(true)
    try {
      await adminUpdateEvent({
        id_event: event.id_event,
        id_slot: event.id_slot,
        title: form.name.trim(),
        description: form.description.trim(),
        banner_url: form.banner,
        location: form.location.trim(),
        requested_at: dt.toISOString(),
        capacity: Number(form.capacity),
        equipment,
      })
      onSaved()
      onClose()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar o evento.')
    } finally {
      setSaving(false)
    }
  }

  const tabBtn = (key: EditTab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={[
        'relative pb-2 text-[14px] transition-colors',
        tab === key ? 'font-semibold text-[#0f3255]' : 'font-medium text-[#919191] hover:text-[#1e558b]',
      ].join(' ')}
    >
      {label}
      {tab === key && <span className="absolute -bottom-px left-0 h-[2px] w-full rounded-full bg-[#1e558b]" />}
    </button>
  )

  const hasErrors = Object.keys(errors).length > 0

  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <MaterialIcon name="calendar_month" size={24} className="text-[#1e558b]" />
          <h1 className="text-[20px] font-bold text-[#0f3255]">Editar Evento</h1>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="text-[#0f3255]">
          <MaterialIcon name="close" size={22} />
        </button>
      </div>
      <div className="shrink-0 border-b border-[#e2e8f0]" />

      {/* Abas */}
      <div className="flex shrink-0 items-center gap-6 px-6 pt-4">
        {tabBtn('info', 'Informações')}
        {tabBtn('equipment', 'Equipamentos')}
      </div>
      <div className="shrink-0 border-b border-[#e2e8f0]" />

      {/* Conteúdo (scroll interno) */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === 'info' ? (
          <NewEventInfoStep data={form} errors={errors} onChange={handleChange} />
        ) : (
          <>
            <h2 className="mb-3 text-[16px] font-bold text-[#0f3255]">Equipamentos necessários</h2>
            <EditEventEquipmentTab items={equipment} catalog={catalog} onChange={setEquipment} />
          </>
        )}
        {hasErrors && (
          <p className="mt-3 text-[13px] text-[#eb5757]">Preencha todos os campos obrigatórios.</p>
        )}
        {saveError && <p className="mt-3 text-[13px] text-[#eb5757]">{saveError}</p>}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#e2e8f0]" />
      <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="h-[45px] rounded-[5px] border border-[#0f3255] px-6 text-[14px] font-semibold text-[#0f3255] disabled:opacity-60"
        >
          Cancelar
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
    </>
  )
}
