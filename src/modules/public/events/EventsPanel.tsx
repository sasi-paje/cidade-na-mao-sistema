import { MaterialIcon } from '../../../shared/components/MaterialIcon'

interface EventsPanelProps {
  title: string
  /** Exibe o botão de calendário no canto direito do cabeçalho. */
  showCalendar?: boolean
  onCalendarClick?: () => void
  /** Rótulo da data filtrada, exibido ao lado do botão de calendário. */
  calendarLabel?: string
  /** Conteúdo extra renderizado entre o cabeçalho e os filhos (ex.: toggle). */
  headerExtra?: React.ReactNode
  children: React.ReactNode
}

/**
 * Painel branco das listas mobile (guia "SASI Eventos Mobile"):
 * cabeçalho com título e, opcionalmente, botão de calendário.
 */
export function EventsPanel({
  title,
  showCalendar,
  onCalendarClick,
  calendarLabel,
  headerExtra,
  children,
}: EventsPanelProps) {
  return (
    <section className="flex flex-col gap-[14px] rounded-[12px] bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <header className="flex flex-row items-center justify-between gap-2">
        <h1 className="text-[24px] font-extrabold text-[#0f3255]">{title}</h1>
        {showCalendar && (
          <div className="flex flex-row items-center gap-[10px]">
            {calendarLabel && <span className="text-[14px] text-[#919191]">{calendarLabel}</span>}
            <button
              type="button"
              aria-label="Abrir calendário"
              onClick={onCalendarClick}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px] border-[1.5px] border-[#1e558b] bg-white text-[#1e558b]"
            >
              <MaterialIcon name="calendar_today" size={19} />
            </button>
          </div>
        )}
      </header>

      {headerExtra}
      {children}
    </section>
  )
}
