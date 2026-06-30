import type { ReactNode } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { CalendarFilterButton, type CalendarFilterProps } from './CalendarFilterButton'

interface WebEventsToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  /** Estado/handlers do filtro por data (dropdown suspenso). */
  calendar: CalendarFilterProps
  onlyPending: boolean
  onTogglePending: (value: boolean) => void
  onAddNew: () => void
  pagination: ReactNode
}

export function WebEventsToolbar({
  search,
  onSearchChange,
  onSearchSubmit,
  calendar,
  onlyPending,
  onTogglePending,
  onAddNew,
  pagination,
}: WebEventsToolbarProps) {
  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      {/* Busca */}
      <form
        className="flex min-w-[220px] flex-1 items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          onSearchSubmit()
        }}
      >
        <div className="relative flex-1">
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Procure por Nome"
            className="h-[42px] w-full rounded-[6px] border border-[#bdcde8] pl-3 pr-3 text-[14px] text-[#0f3255] outline-none focus:border-[#1e558b]"
          />
        </div>
        <button
          type="submit"
          aria-label="Buscar"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[6px] bg-[#1e558b] text-white"
        >
          <MaterialIcon name="search" size={20} />
        </button>
        <CalendarFilterButton {...calendar} />
      </form>

      {/* Toggle apenas pendentes */}
      <button
        type="button"
        role="switch"
        aria-checked={onlyPending}
        onClick={() => onTogglePending(!onlyPending)}
        className="flex shrink-0 items-center gap-2 text-[13px] font-medium text-[#4c4c4c]"
      >
        <span
          className={[
            'relative h-5 w-9 rounded-full transition-colors',
            onlyPending ? 'bg-[#1e558b]' : 'bg-[#bdcde8]',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
              onlyPending ? 'left-[18px]' : 'left-0.5',
            ].join(' ')}
          />
        </span>
        Mostrar apenas Pendentes
      </button>

      {/* Paginação */}
      <div className="shrink-0">{pagination}</div>

      {/* Adicionar Novo */}
      <button
        type="button"
        onClick={onAddNew}
        className="flex h-[42px] shrink-0 items-center gap-1 rounded-[6px] bg-[#1e558b] px-4 text-[14px] font-semibold text-white"
      >
        <MaterialIcon name="add_circle" size={20} />
        Adicionar Novo
      </button>
    </div>
  )
}
