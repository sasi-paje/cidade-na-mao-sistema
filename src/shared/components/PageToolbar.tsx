import { SearchInput, FilterButton, ToolbarButton, ToolbarTokens } from '../components'

export interface PageToolbarProps {
  /** Search configuration */
  search?: {
    placeholder?: string
    value?: string
    onChange?: (value: string) => void
    onSearch?: (value: string) => void
    width?: string
  }

  /** Filter buttons (multiple) */
  filters?: Array<{
    isActive?: boolean
    label?: string
    onClick: () => void
  }>

  /** Action buttons (multiple) */
  actions?: Array<{
    label: string
    icon?: string
    variant?: 'primary' | 'secondary' | 'default'
    onClick: () => void
    disabled?: boolean
  }>

  /** Back button */
  back?: {
    label: string
    onClick: () => void
  }

  /** Loading state */
  loading?: boolean
}

export const PageToolbar = ({
  search,
  filters = [],
  actions = [],
  back,
}: PageToolbarProps) => {
  const hasSearch = search?.onSearch !== undefined

  return (
    <div
      className="flex items-center justify-between shrink-0 flex-wrap gap-y-2"
      style={{
        padding: `${ToolbarTokens.PADDING_CONTAINER_Y} ${ToolbarTokens.PADDING_CONTAINER_X}`,
      }}
    >
      {/* Left: Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {hasSearch && (
          <SearchInput
            placeholder={search.placeholder || 'Buscar...'}
            width={search.width || '360px'}
            value={search.value || ''}
            onChange={search.onChange || (() => {})}
            onSearch={search.onSearch || (() => {})}
          />
        )}
        {filters.map((filter, index) => (
          <FilterButton
            key={index}
            isActive={filter.isActive}
            onClick={filter.onClick}
          />
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {back && (
          <ToolbarButton
            label={back.label}
            variant="secondary"
            onClick={back.onClick}
          />
        )}
        {actions.map((action, index) => (
          <ToolbarButton
            key={index}
            label={action.label}
            icon={action.icon}
            variant={action.variant as 'primary' | 'secondary' | 'default' || 'primary'}
            onClick={action.onClick}
            disabled={action.disabled}
          />
        ))}
      </div>
    </div>
  )
}

// Exemplo de uso:
// <PageToolbar
//   search={{
//     placeholder: 'Busque por placa...',
//     value: search,
//     onChange: setSearch,
//     onSearch: setSearch,
//     width: '400px'
//   }}
//   filters={[
//     { isActive: showActive, onClick: () => setShowActive(!showActive) }
//   ]}
//   actions={[
//     { label: 'Importar', icon: 'upload', variant: 'secondary', onClick: handleImport },
//     { label: 'Novo', icon: 'add', variant: 'primary', onClick: handleAdd }
//   ]}
//   back={{ label: 'Voltar', onClick: handleBack }}
// />

export default PageToolbar
