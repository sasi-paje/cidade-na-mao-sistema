import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import type { EventFullView } from '../../../../features/events'

interface ApproveEventModalProps {
  event: EventFullView
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Modal "Aprovar Evento".
 *
 * Disponibilidade (mock): um equipamento fica indisponível quando a quantidade
 * solicitada excede a quantidade do catálogo (`equipment.quantity`). A linha é
 * marcada em vermelho e um alerta é exibido. Decisão: o botão "Aprovar"
 * permanece HABILITADO (conforme o Figma) — a indisponibilidade é apenas um
 * aviso visual nesta etapa.
 */
export function ApproveEventModal({ event, busy = false, error = null, onCancel, onConfirm }: ApproveEventModalProps) {
  const items = event.equipment_requests ?? []
  const isUnavailable = (qty: number, available?: number) =>
    typeof available === 'number' && qty > available
  const hasUnavailable = items.some((i) => isUnavailable(i.quantity, i.equipment?.quantity))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-xl rounded-[8px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="px-6 py-4 text-center text-[18px] font-bold text-[#0f3255]">Aprovar Evento</h2>
        <div className="border-b border-[#1e558b]" />

        <div className="px-6 py-4">
          <p className="text-center text-[13px] text-[#4c4c4c]">
            Deseja aprovar a solicitação de evento? Os seguintes equipamentos serão utilizados
          </p>

          {items.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-[4px] border border-[#bdcde8]">
              <div className="grid grid-cols-2 gap-2 border-b border-[#bdcde8] bg-[#f5f9ff] px-3 py-2 text-[13px] font-semibold text-[#0f3255]">
                <span>Equipamentos</span>
                <span>Quantidade</span>
              </div>
              {items.map((item) => {
                const unavailable = isUnavailable(item.quantity, item.equipment?.quantity)
                return (
                  <div
                    key={item.id}
                    className={[
                      'grid grid-cols-2 gap-2 border-b border-[#bdcde8] px-3 py-2 text-[13px] last:border-b-0',
                      unavailable ? 'bg-[#f08c8c] text-[#5b1a1a]' : 'text-[#2a2a2a]',
                    ].join(' ')}
                  >
                    <span>{item.equipment?.name ?? item.id_equipment}</span>
                    <span>{item.quantity}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mt-4 text-center text-[13px] text-[#919191]">
              Nenhum equipamento solicitado para este evento.
            </p>
          )}

          {hasUnavailable && (
            <p className="mt-3 flex items-center justify-center gap-1 text-center text-[13px] font-semibold text-[#c0392b]">
              <MaterialIcon name="warning" size={18} />
              Os equipamentos marcados não estão disponíveis na data solicitada
            </p>
          )}

          {error && (
            <p className="mt-3 flex items-center justify-center gap-1 text-center text-[13px] font-semibold text-[#eb5757]">
              <MaterialIcon name="error_outline" size={18} />
              {error}
            </p>
          )}
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
            onClick={onConfirm}
            disabled={busy}
            className="h-[45px] rounded-[5px] bg-[#1e558b] px-8 text-[14px] font-bold text-white disabled:opacity-60"
          >
            {busy ? 'Aprovando...' : 'Aprovar'}
          </button>
        </div>
      </div>
    </div>
  )
}
