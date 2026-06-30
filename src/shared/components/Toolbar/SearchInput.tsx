import { useState, ChangeEvent, KeyboardEvent } from 'react'
import { AppIcon } from '../AppIcon'
import { ToolbarTokens } from './ToolbarTokens'

interface SearchInputProps {
  value?: string
  placeholder?: string
  width?: string
  onSearch?: (value: string) => void
  onChange?: (value: string) => void
  disabled?: boolean
}

/**
 * SearchInput - Campo de busca padronizado
 * Referência: Figma node 825-37209
 *
 * Estilo exato:
 * - altura: 40px
 * - radius: 5px
 * - borda: 1px #BDBDBD
 * - bg: #F9F9F9
 * - placeholder: #BDBDBD (Neutrals/Grey/Lighter)
 * - texto: #2A2A2A (Neutral/Black/Light75)
 * - font: Inter 400 14px/24px
 * - gap interno: 8px
 */
export const SearchInput = ({
  value: initialValue = '',
  placeholder = 'Buscar...',
  width = ToolbarTokens.WIDTH_SEARCH_DEFAULT,
  onSearch,
  onChange,
  disabled = false,
}: SearchInputProps) => {
  const [localValue, setLocalValue] = useState(initialValue)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    onChange?.(newValue)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch?.(localValue)
    }
  }

  const handleSearchClick = () => {
    onSearch?.(localValue)
  }

  return (
    <div
      className="flex items-center"
      style={{
        height: ToolbarTokens.HEIGHT_SEARCH,
        width,
        backgroundColor: ToolbarTokens.COLOR_GRAY_BG,
        borderWidth: '1px',
        borderColor: ToolbarTokens.COLOR_BORDER,
        borderStyle: 'solid',
        borderRadius: ToolbarTokens.BORDER_RADIUS_LG,
      }}
    >
      {/* Input field - same structure as Figma */}
      <div
        className="flex-1 h-full flex items-center"
        style={{ paddingLeft: ToolbarTokens.PADDING_INPUT_X }}
      >
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none"
          style={{
            fontFamily: ToolbarTokens.FONT_FAMILY,
            fontSize: ToolbarTokens.FONT_SIZE_INPUT,
            fontWeight: ToolbarTokens.FONT_WEIGHT_TEXT,
            lineHeight: ToolbarTokens.LINE_HEIGHT_TEXT,
            color: ToolbarTokens.COLOR_TEXT,
          }}
        />
      </div>

      {/* Search button - exactly like Figma node 825-37213 */}
      <button
        type="button"
        onClick={handleSearchClick}
        disabled={disabled}
        className="flex items-center justify-center cursor-pointer"
        style={{
          width: '40px',
          height: '100%',
          backgroundColor: ToolbarTokens.COLOR_ORANGE,
          padding: '0 8px',
          borderTopRightRadius: '4px',
          borderBottomRightRadius: '4px',
        }}
      >
        <AppIcon
          name="search"
          size={24}
          color={ToolbarTokens.COLOR_WHITE}
        />
      </button>
    </div>
  )
}

export default SearchInput