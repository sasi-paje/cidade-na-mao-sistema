import React from 'react'

/**
 * MaterialIcon - wrapper para Material Symbols Outlined
 *
 * A fonte "Material Symbols Outlined" já é carregada em index.html.
 * Uso: <MaterialIcon name="calendar_month" />
 */
interface MaterialIconProps {
  name: string
  size?: number
  fill?: boolean
  weight?: number
  className?: string
  style?: React.CSSProperties
}

export function MaterialIcon({
  name,
  size = 20,
  fill = false,
  weight = 400,
  className = '',
  style,
}: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      aria-hidden="true"
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
        ...style,
      }}
    >
      {name}
    </span>
  )
}
