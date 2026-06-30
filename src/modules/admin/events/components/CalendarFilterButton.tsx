import { useEffect, useRef, useState } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { EventCalendar } from '../../../public/events/EventCalendar'

export interface CalendarFilterProps {
  /** Rótulo da data filtrada (ex.: "18 jun"); destaca o botão quando presente. */
  label?: string
  value: Date | null
  eventDateKeys: Set<string>
  initialMonth: Date | null
  onSelect: (day: Date) => void
  onClear: () => void
}

/**
 * Botão de filtro por data com **dropdown suspenso** ancorado (web admin).
 * Abre um popover logo abaixo do botão (sem overlay de tela cheia); fecha ao
 * clicar fora ou apertar Esc. Reaproveita a grade `EventCalendar`.
 */
export function CalendarFilterButton({
  label,
  value,
  eventDateKeys,
  initialMonth,
  onSelect,
  onClear,
}: CalendarFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleSelect = (day: Date) => {
    onSelect(day)
    setOpen(false)
  }
  const handleClear = () => {
    onClear()
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Filtrar por data"
        aria-expanded={open}
        className={[
          'flex h-[42px] shrink-0 items-center justify-center gap-1 rounded-[6px] border',
          label || open
            ? 'border-[#1e558b] bg-[#eef3fa] px-3 text-[14px] font-semibold text-[#1e558b]'
            : 'w-[42px] border-[#bdcde8] text-[#1e558b]',
        ].join(' ')}
      >
        <MaterialIcon name="calendar_month" size={20} />
        {label && <span>{label}</span>}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 flex w-[320px] flex-col gap-2 rounded-[12px] border border-[#e2e8f0] bg-white p-3 shadow-xl">
          <EventCalendar
            value={value}
            eventDateKeys={eventDateKeys}
            initialMonth={initialMonth}
            onSelect={handleSelect}
          />
          <button
            type="button"
            onClick={handleClear}
            className="h-[40px] w-full rounded-[8px] border-[1.5px] border-[#1e558b] text-[14px] font-bold text-[#1e558b]"
          >
            Todas as datas
          </button>
        </div>
      )}
    </div>
  )
}
