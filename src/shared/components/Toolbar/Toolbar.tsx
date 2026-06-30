import { ReactNode } from 'react'
import { SearchInput } from './SearchInput'
import { FilterButton, ToolbarButton } from './ToolbarComponents'
import { ToolbarTokens } from './ToolbarTokens'

interface ToolbarAction {
  label: string
  icon?: 'download' | 'add_circle' | 'add_box'
  variant?: 'primary' | 'secondary' | 'default'
  onClick?: () => void
  disabled?: boolean
}

interface ToolbarProps {
  /** Busca */
  searchPlaceholder?: string
  searchWidth?: string
  onSearch?: (term: string) => void
  initialSearch?: string

  /** Filtro */
  showFilter?: boolean
  filterActive?: boolean
  onFilterToggle?: () => void

  /** Ações da esquerda (antes das ações principais) */
  leftActions?: ReactNode

  /** Ações da direta */
  rightActions?: ToolbarAction[]
}

/**
 * Toolbar principal - componente padronizado para todas as páginas
 *
 * Uso:
 *
 * <Toolbar
 *   searchPlaceholder="Busque uma rota..."
 *   searchWidth="360px"
 *   onSearch={(term) => console.log(term)}
 *   showFilter
 *   filterActive={false}
 *   onFilterToggle={() => {}}
 *   rightActions={[
 *     { label: 'Importar', variant: 'secondary', icon: 'download', onClick: () => {} },
 *     { label: 'Adicionar Novo', variant: 'primary', icon: 'add_circle', onClick: () => {} },
 *   ]}
 * />
 */
export const Toolbar = ({
  searchPlaceholder = 'Buscar...',
  searchWidth,
  onSearch,
  initialSearch = '',
  showFilter = false,
  filterActive = false,
  onFilterToggle,
  leftActions,
  rightActions = [],
}: ToolbarProps) => {
  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{
        padding: `${ToolbarTokens.PADDING_CONTAINER_Y} ${ToolbarTokens.PADDING_CONTAINER_X}`,
        gap: ToolbarTokens.GAP_TOOLBAR,
      }}
    >
      {/* Grupo Esquerdo: Busca + Filtro + Ações extras */}
      <div className="flex items-center gap-3">
        {/* Input de Busca */}
        <SearchInput
          placeholder={searchPlaceholder}
          width={searchWidth}
          value={initialSearch}
          onSearch={onSearch}
        />

        {/* Botão de Filtro */}
        {showFilter && onFilterToggle && (
          <FilterButton
            isActive={filterActive}
            onClick={onFilterToggle}
          />
        )}

        {/* Ações extras da esquerda */}
        {leftActions}
      </div>

      {/* Grupo Direito: Botões de Ação */}
      {rightActions.length > 0 && (
        <div className="flex items-center gap-3">
          {rightActions.map((action, index) => (
            <ToolbarButton
              key={action.label + index}
              label={action.label}
              icon={action.icon}
              variant={action.variant}
              onClick={action.onClick}
              disabled={action.disabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Toolbar