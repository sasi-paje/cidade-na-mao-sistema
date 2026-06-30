import { useState } from 'react'
import { MaterialIcon } from '../../../shared/components/MaterialIcon'
import { MONTHS_FULL, WEEKDAYS_SHORT, dateToDayKey } from '../../../utils/eventDate'

interface EventCalendarProps {
  /** Dia atualmente filtrado (destacado), ou null. */
  value: Date | null
  /** Chaves `YYYY-MM-DD` dos dias que possuem eventos (marcados com ponto). */
  eventDateKeys: Set<string>
  /** Mês inicial exibido quando não há `value` (ex.: mês do 1º evento). */
  initialMonth?: Date | null
  onSelect: (day: Date) => void
}

interface Cell {
  date: Date
  key: string
  label: number
  inMonth: boolean
}

function buildCells(view: Date): Cell[] {
  const year = view.getFullYear()
  const month = view.getMonth()
  const startOffset = new Date(year, month, 1).getDay() // 0=Dom
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  const cells: Cell[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1
    const date = new Date(year, month, dayNum) // normaliza p/ meses vizinhos
    cells.push({
      date,
      key: dateToDayKey(date),
      label: date.getDate(),
      inMonth: dayNum >= 1 && dayNum <= daysInMonth,
    })
  }
  return cells
}

/**
 * Grade de calendário (mês + dias) para filtrar listas de eventos por data.
 * Apresentacional/reutilizável: usado pelo `EventCalendarModal` (mobile) e pelo
 * `CalendarFilterButton` (dropdown do web admin). Dias com evento recebem ponto;
 * o dia selecionado fica destacado.
 */
export function EventCalendar({ value, eventDateKeys, initialMonth, onSelect }: EventCalendarProps) {
  const base = value ?? initialMonth ?? new Date()
  const [view, setView] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1))

  const cells = buildCells(view)
  const selectedKey = value ? dateToDayKey(value) : null
  const goMonth = (delta: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1))

  return (
    <>
      <div className="flex flex-col gap-2 rounded-[10px] border border-[#e8edf2] p-3">
        <div className="flex flex-row items-center justify-between">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => goMonth(-1)}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-[#e8edf2] text-[#0f3255]"
          >
            <MaterialIcon name="chevron_left" size={20} />
          </button>
          <div className="text-center">
            <div className="text-[16px] font-bold text-[#0f3255]">{MONTHS_FULL[view.getMonth()]}</div>
            <div className="text-[12px] text-[#919191]">{view.getFullYear()}</div>
          </div>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => goMonth(1)}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-[#e8edf2] text-[#0f3255]"
          >
            <MaterialIcon name="chevron_right" size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7">
          {WEEKDAYS_SHORT.map((wd) => (
            <div key={wd} className="py-1 text-center text-[12px] font-semibold text-[#919191]">
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((c, i) => {
            if (!c.inMonth) {
              return (
                <div key={i} className="flex h-10 items-center justify-center text-[14px] text-[#c7cdd6]">
                  {c.label}
                </div>
              )
            }
            const isSelected = c.key === selectedKey
            const hasEvent = eventDateKeys.has(c.key)
            return (
              <button
                key={i}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(c.date)}
                className="relative flex h-10 items-center justify-center"
              >
                <span
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] text-[14px]"
                  style={{
                    fontWeight: isSelected ? 700 : 400,
                    color: isSelected ? '#0f3255' : '#2a2a2a',
                    background: isSelected ? '#d7e6f6' : 'transparent',
                  }}
                >
                  {c.label}
                </span>
                {hasEvent && (
                  <span
                    data-testid="event-dot"
                    className="absolute bottom-[5px] left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-[#1e558b]"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-row items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-[#1e558b]" />
        <span className="text-[13px] text-[#2a2a2a]">Data com Eventos</span>
      </div>
    </>
  )
}
