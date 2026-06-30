import { useState } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { formatEventDay } from '../../../../utils/eventDate'
import type { EventFullView } from '../../../../features/events'

interface SuggestNewDateModalProps {
  event: EventFullView
  busy?: boolean
  onCancel: () => void
  /** Recebe a nova data em ISO (combinada com a hora original do evento). */
  onConfirm: (counterDateIso: string) => void
}

export function SuggestNewDateModal({ event, busy = false, onCancel, onConfirm }: SuggestNewDateModalProps) {
  const [suggested, setSuggested] = useState('')
  const [error, setError] = useState(false)

  const handleConfirm = () => {
    if (!suggested) {
      setError(true)
      return
    }
    // Mantém a hora original do evento na nova data sugerida.
    const original = new Date(event.requested_at)
    const [year, month, day] = suggested.split('-').map(Number)
    const next = new Date(original)
    next.setFullYear(year, month - 1, day)
    onConfirm(next.toISOString())
  }

  const inputClass =
    'h-[45px] w-full rounded-[5px] border px-3 text-[14px] text-[#0f3255] outline-none focus:border-[#1e558b]'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-xl rounded-[8px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="px-6 py-4 text-center text-[18px] font-bold text-[#0f3255]">Sugerir Nova Data</h2>
        <div className="border-b border-[#1e558b]" />

        <div className="px-6 py-4">
          <p className="text-center text-[13px] text-[#4c4c4c]">
            Deseja sugerir uma <strong>nova data</strong> para o evento?
          </p>

          <div className="mt-4">
            <span className="mb-1 block text-[13px] font-semibold text-[#0f3255]">Data Inicial</span>
            <p className="flex items-center gap-1.5 text-[14px] text-[#4c4c4c]">
              <MaterialIcon name="calendar_month" size={18} className="text-[#1e558b]" />
              {formatEventDay(event.requested_at)}
            </p>
          </div>

          <div className="my-4 border-b border-[#e2e8f0]" />

          <div>
            <label className="mb-1 block text-[13px] font-semibold text-[#0f3255]">Data sugerida</label>
            <input
              type="date"
              value={suggested}
              onChange={(e) => {
                setSuggested(e.target.value)
                setError(false)
              }}
              className={`${inputClass} ${error ? 'border-[#eb5757]' : 'border-[#0f3255]'}`}
            />
            {error && <p className="mt-1 text-[12px] text-[#eb5757]">Informe a nova data.</p>}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="h-[45px] rounded-[5px] border border-[#1e558b] px-6 text-[14px] font-semibold text-[#1e558b]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="h-[45px] rounded-[5px] bg-[#1e558b] px-8 text-[14px] font-bold text-white disabled:opacity-60"
          >
            {busy ? 'Enviando...' : 'Sugerir'}
          </button>
        </div>
      </div>
    </div>
  )
}
