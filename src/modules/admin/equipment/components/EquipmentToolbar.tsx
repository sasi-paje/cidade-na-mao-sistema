import type { ReactNode } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'

interface EquipmentToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  onCalendar: () => void
  onlyInactive: boolean
  onToggleInactive: (value: boolean) => void
  onAddNew: () => void
  pagination: ReactNode
}

export function EquipmentToolbar({
  search,
  onSearchChange,
  onSearchSubmit,
  onCalendar,
  onlyInactive,
  onToggleInactive,
  onAddNew,
  pagination,
}: EquipmentToolbarProps) {
  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <form
        className="flex min-w-[220px] flex-1 items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          onSearchSubmit()
        }}
      >
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Procure por Nome"
          className="h-[42px] flex-1 rounded-[6px] border border-[#bdcde8] px-3 text-[14px] text-[#0f3255] outline-none focus:border-[#1e558b]"
        />
        <button
          type="submit"
          aria-label="Buscar"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[6px] bg-[#1e558b] text-white"
        >
          <MaterialIcon name="search" size={20} />
        </button>
        <button
          type="button"
          onClick={onCalendar}
          aria-label="Filtrar por data"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[6px] border border-[#bdcde8] text-[#1e558b]"
        >
          <MaterialIcon name="calendar_month" size={20} />
        </button>
      </form>

      <button
        type="button"
        role="switch"
        aria-checked={onlyInactive}
        onClick={() => onToggleInactive(!onlyInactive)}
        className="flex shrink-0 items-center gap-2 text-[13px] font-medium text-[#4c4c4c]"
      >
        <span
          className={[
            'relative h-5 w-9 rounded-full transition-colors',
            onlyInactive ? 'bg-[#1e558b]' : 'bg-[#bdcde8]',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
              onlyInactive ? 'left-[18px]' : 'left-0.5',
            ].join(' ')}
          />
        </span>
        Mostrar apenas Inativados
      </button>

      <div className="shrink-0">{pagination}</div>

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
