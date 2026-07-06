import { useState } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { useLockBodyScroll } from '../../../../shared/hooks/useLockBodyScroll'
import { updateEquipment, setEquipmentActive } from '../../../../features/equipment'
import type { Equipment } from '../../../../features/equipment'
import { useWebTenant } from '../../../../features/web-tenant'
import { EquipmentForm } from './EquipmentForm'
import {
  equipmentToForm,
  validateEquipmentForm,
  formToInput,
  type EquipmentFormData,
  type EquipmentFormErrors,
} from './equipmentForm.model'

type NotifyToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => void

interface EquipmentDetailsModalProps {
  equipment: Equipment | null
  open: boolean
  onClose: () => void
  onSaved: () => void
  onNotify?: NotifyToast
}

const label = 'mb-1 block text-[13px] font-semibold text-[#0f3255]'
const value = 'text-[14px] text-[#4c4c4c]'

export function EquipmentDetailsModal({ equipment, open, onClose, onSaved, onNotify }: EquipmentDetailsModalProps) {
  const { tenant } = useWebTenant()
  const [current, setCurrent] = useState<Equipment | null>(equipment)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [form, setForm] = useState<EquipmentFormData>(() =>
    equipment ? equipmentToForm(equipment) : { name: '', quantity: '', description: '' },
  )
  const [errors, setErrors] = useState<EquipmentFormErrors>({})
  const [busy, setBusy] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  useLockBodyScroll(open)

  if (!open || !current) return null

  const handleChange = (patch: Partial<EquipmentFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(patch)) delete next[key as keyof EquipmentFormErrors]
      return next
    })
  }

  const startEdit = () => {
    setForm(equipmentToForm(current))
    setErrors({})
    setMode('edit')
  }

  const handleSaveEdit = async () => {
    const found = validateEquipmentForm(form)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    setBusy(true)
    try {
      const updated = await updateEquipment(current.id, formToInput(form), tenant)
      setCurrent(updated)
      onSaved()
      setMode('view')
      onNotify?.('Equipamento atualizado com sucesso.', 'success')
    } catch {
      /* mantém edição */
    } finally {
      setBusy(false)
    }
  }

  const handleToggleActive = async () => {
    if (!current) return
    setToggleError(null)
    setToggling(true)
    const wasActive = current.is_active
    try {
      await setEquipmentActive(current.id, !current.is_active, tenant)
      setCurrent({ ...current, is_active: !current.is_active })
      onSaved()
      setConfirmToggle(false)
      onNotify?.(
        wasActive ? 'Equipamento inativado com sucesso.' : 'Equipamento ativado com sucesso.',
        'success',
      )
    } catch (e) {
      // RPC é a fonte de verdade: mostra a mensagem (ex.: bloqueio por vínculo).
      setToggleError(e instanceof Error ? e.message : 'Não foi possível atualizar o equipamento.')
    } finally {
      setToggling(false)
    }
  }

  const hasErrors = Object.keys(errors).length > 0

  return (
    <>
    <div className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:justify-end" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <MaterialIcon name="inventory_2" size={24} className="text-[#1e558b]" />
            <h1 className="text-[20px] font-bold text-[#0f3255]">{current.name}</h1>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-[#0f3255]">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        <div className="shrink-0 border-b border-[#e2e8f0]" />

        {/* Conteúdo */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {mode === 'view' ? (
            <div className="space-y-4">
              <h2 className="text-[16px] font-bold text-[#2a2a2a]">Informações do equipamento</h2>
              <div>
                <span className={label}>Status</span>
                <p className={current.is_active ? 'text-[14px] text-[#1e8449]' : 'text-[14px] text-[#919191]'}>
                  {current.is_active ? 'Ativo' : 'Inativo'}
                </p>
              </div>
              <div>
                <span className={label}>Nome do Equipamento</span>
                <p className={value}>{current.name}</p>
              </div>
              <div>
                <span className={label}>Quantidade</span>
                <p className={value}>{current.quantity}</p>
              </div>
              <div>
                <span className={label}>Descrição</span>
                <p className={value}>{current.description}</p>
              </div>
            </div>
          ) : (
            <>
              <EquipmentForm data={form} errors={errors} onChange={handleChange} />
              {hasErrors && (
                <p className="mt-3 text-[13px] text-[#eb5757]">Preencha todos os campos obrigatórios.</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#e2e8f0]" />
        <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-4">
          {mode === 'view' ? (
            <>
              <button
                type="button"
                onClick={() => { setToggleError(null); setConfirmToggle(true) }}
                className={[
                  'flex h-[45px] items-center gap-1 rounded-[5px] px-6 text-[14px] font-bold text-white',
                  current.is_active ? 'bg-[#eb5757]' : 'bg-[#1e8449]',
                ].join(' ')}
              >
                <MaterialIcon name={current.is_active ? 'block' : 'check_circle'} size={18} />
                {current.is_active ? 'Inativar' : 'Ativar'}
              </button>
              <button
                type="button"
                onClick={startEdit}
                className="flex h-[45px] items-center gap-1 rounded-[5px] bg-[#1e558b] px-8 text-[14px] font-bold text-white"
              >
                <MaterialIcon name="edit" size={18} />
                Editar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode('view')}
                className="h-[45px] rounded-[5px] border border-[#0f3255] px-6 text-[14px] font-semibold text-[#0f3255]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={busy}
                className="h-[45px] rounded-[5px] bg-[#1e558b] px-8 text-[14px] font-bold text-white disabled:opacity-60"
              >
                {busy ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>

      {confirmToggle && current && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
          onClick={() => { if (!toggling) setConfirmToggle(false) }}
        >
          <div className="w-full max-w-md rounded-[8px] bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold text-[#0f3255]">
              {current.is_active ? 'Inativar equipamento' : 'Ativar equipamento'}
            </p>
            <p className="mt-2 text-[14px] text-[#4c4c4c]">
              {current.is_active
                ? 'Tem certeza que deseja inativar este equipamento?'
                : 'Tem certeza que deseja ativar este equipamento?'}
            </p>
            {current.is_active && (
              <p className="mt-2 rounded-[6px] bg-[#fdf3d8] px-3 py-2 text-[13px] text-[#8a6d1b]">
                Equipamentos inativos não poderão ser usados em novas solicitações de eventos.
              </p>
            )}
            {toggleError && <p className="mt-2 text-[13px] text-[#eb5757]">{toggleError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmToggle(false)}
                disabled={toggling}
                className="h-[40px] rounded-[6px] border border-[#0f3255] px-5 text-[14px] font-semibold text-[#0f3255] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={toggling}
                className={[
                  'h-[40px] rounded-[6px] px-5 text-[14px] font-bold text-white disabled:opacity-60',
                  current.is_active ? 'bg-[#eb5757]' : 'bg-[#1e8449]',
                ].join(' ')}
              >
                {toggling ? 'Salvando...' : current.is_active ? 'Inativar' : 'Ativar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
