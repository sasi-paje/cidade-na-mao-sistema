import { Filter } from 'lucide-react'
import { AppIcon } from '../AppIcon'
import { ToolbarTokens } from './ToolbarTokens'

/**
 * FilterButton - Botão de filtro padronizado
 * Referência: Figma node 825-37214
 *
 * Estilo exato:
 * - 40x40px
 * - fundo branco (ou laranja claro quando ativo)
 * - borda Secondary/Default (#E67C26)
 * - radius 5px
 * - ícone Secondary/Default (#E67C26) centralizado
 */
interface FilterButtonProps {
  isActive?: boolean
  onClick?: () => void
  disabled?: boolean
}

export const FilterButton = ({
  isActive = false,
  onClick,
  disabled = false,
}: FilterButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center transition-colors"
      style={{
        height: ToolbarTokens.HEIGHT_FILTER,
        width: ToolbarTokens.WIDTH_FILTER,
        backgroundColor: isActive ? '#FFF3E0' : ToolbarTokens.COLOR_WHITE,
        borderWidth: '1px',
        borderColor: ToolbarTokens.COLOR_ORANGE,
        borderStyle: 'solid',
        borderRadius: ToolbarTokens.BORDER_RADIUS_LG,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Filter size={ToolbarTokens.ICON_SIZE_FILTER} color={ToolbarTokens.COLOR_ORANGE} />
    </button>
  )
}

/**
 * ToolbarButton - Botão de ação da toolbar
 *
 * Referência Figma nodes 825-37216 (Importar) e 825-37217 (Adicionar Novo)
 *
 * Estilo:
 * - Importar: white bg, border laranja (#E67C26), texto laranja, ícone laranja
 * - Adicionar Novo: bg laranja (#E67C26), texto white, ícone white
 * - altura: 45px
 * - padding: 2px top/bottom, 8px left/right
 * - radius: 4px
 * - gap interno: 10px entre ícone e texto
 */
interface ToolbarButtonProps {
  label: string
  icon?: 'download' | 'add_circle' | 'add_box' | 'search' | 'upload' | 'arrow_back'
  variant?: 'primary' | 'secondary' | 'default'
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
}

export const ToolbarButton = ({
  label,
  icon,
  variant = 'primary',
  onClick,
  disabled = false,
  loading = false,
}: ToolbarButtonProps) => {
  const isPrimary = variant === 'primary'
  const isDefault = variant === 'default'
  // Both use orange color
  const systemColor = ToolbarTokens.COLOR_ORANGE
  const isDisabled = disabled || loading

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className="flex items-center justify-center whitespace-nowrap"
      style={{
        display: 'flex',
        minWidth: '150px',
        width: 'auto',
        height: '45px',
        padding: '2px 8px',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px',
        backgroundColor: isDisabled ? '#cccccc' : (isPrimary ? '#E67C26' : isDefault ? 'white' : 'transparent'),
        borderWidth: isPrimary ? '1px' : isDefault ? '1px' : '0px',
        borderColor: isDisabled ? '#999999' : systemColor,
        borderStyle: 'solid',
        borderRadius: '4px',
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: isDisabled ? '#666666' : (isPrimary ? ToolbarTokens.COLOR_WHITE : systemColor), borderTopColor: 'transparent' }} />
      ) : (
        icon && (
          <AppIcon
            name={icon}
            size={24}
            color={isDisabled ? '#666666' : (isPrimary ? ToolbarTokens.COLOR_WHITE : systemColor)}
          />
        )
      )}
      <span
        className="font-bold whitespace-nowrap"
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          fontWeight: 700,
          color: isDisabled ? '#666666' : (isPrimary ? ToolbarTokens.COLOR_WHITE : systemColor),
          lineHeight: '20px',
        }}
      >
        {loading ? 'Processando...' : label}
      </span>
    </button>
  )
}

export default { FilterButton, ToolbarButton }