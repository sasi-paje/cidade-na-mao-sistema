/**
 * Toolbar Design System
 *
 * Componentes padronizados para toolbar superior
 *
 * @example
 *
 * import { Toolbar } from './shared/components/Toolbar'
 *
 * <Toolbar
 *   searchPlaceholder="Busque uma rota..."
 *   onSearch={(term) => doSomething(term)}
 *   showFilter
 *   filterActive={false}
 *   onFilterToggle={() => {}}
 *   rightActions={[
 *     { label: 'Importar', variant: 'secondary', icon: 'download', onClick: handleImport },
 *     { label: 'Adicionar Novo', variant: 'primary', icon: 'add_circle', onClick: handleAdd },
 *   ]}
 * />
 */

// Tokens
export { ToolbarTokens } from './ToolbarTokens'
export type { ToolbarTokens as ToolbarTokensType } from './ToolbarTokens'

// ComponentesAtoms
export { SearchInput, default as SearchInputDefault } from './SearchInput'
export { FilterButton, ToolbarButton } from './ToolbarComponents'

// Componente Molecular
export { Toolbar, default as ToolbarDefault } from './Toolbar'