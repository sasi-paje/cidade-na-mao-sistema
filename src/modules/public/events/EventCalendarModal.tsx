import { EventCalendar } from './EventCalendar'

interface EventCalendarModalProps {
  /** Dia atualmente filtrado (destacado), ou null. */
  value: Date | null
  /** Chaves `YYYY-MM-DD` dos dias que possuem eventos (marcados com ponto). */
  eventDateKeys: Set<string>
  /** Mês inicial exibido quando não há `value` (ex.: mês do 1º evento). */
  initialMonth?: Date | null
  onSelect: (day: Date) => void
  onClear: () => void
  onClose: () => void
}

/**
 * Modal de calendário para filtrar a lista de eventos por data
 * (guia "SASI Eventos Mobile"). Usa o `EventCalendar` por dentro.
 */
export function EventCalendarModal({
  value,
  eventDateKeys,
  initialMonth,
  onSelect,
  onClear,
  onClose,
}: EventCalendarModalProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-[18px]"
      style={{ background: 'rgba(20,30,45,0.45)' }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[420px] flex-col gap-[14px] rounded-[14px] bg-white p-[18px]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[17px] font-bold text-[#0f3255]">Selecione uma data</span>

        <EventCalendar
          value={value}
          eventDateKeys={eventDateKeys}
          initialMonth={initialMonth}
          onSelect={onSelect}
        />

        <div className="flex flex-row gap-2">
          <button
            type="button"
            onClick={onClear}
            className="h-[46px] flex-1 rounded-[8px] border-[1.5px] border-[#1e558b] text-[14px] font-bold text-[#1e558b]"
          >
            Todas as datas
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-[46px] flex-1 rounded-[8px] bg-[#1e558b] text-[14px] font-bold text-white"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
