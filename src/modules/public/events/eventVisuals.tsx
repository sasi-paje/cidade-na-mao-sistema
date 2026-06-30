import { useState } from 'react'
import { MaterialIcon } from '../../../shared/components/MaterialIcon'
import { formatEventDateParts } from '../../../utils/eventDate'

/**
 * Peças visuais compartilhadas entre os cards e telas de detalhe de eventos
 * (`/m/*`), seguindo o guia "SASI Eventos Mobile".
 */

interface EventBannerProps {
  src?: string | null
  alt: string
  /** Altura em px da área do banner. */
  height: number
  /** Raio dos cantos (px). Padrão 0 (card cuida do overflow). */
  radius?: number
  children?: React.ReactNode
}

/** Banner do evento com placeholder de imagem quando não há foto. */
export function EventBanner({ src, alt, height, radius = 0, children }: EventBannerProps) {
  const [errored, setErrored] = useState(false)
  const showImg = src && !errored

  return (
    <div
      className="relative flex w-full items-center justify-center overflow-hidden bg-[#eaeef3]"
      style={{ height, borderRadius: radius }}
    >
      {showImg ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setErrored(true)} />
      ) : (
        <MaterialIcon name="image" size={height >= 200 ? 48 : 40} className="text-[#c7d0db]" />
      )}
      {children}
    </div>
  )
}

interface EventDateLineProps {
  iso?: string | null
  /** Texto bruto exibido quando não há data válida (ex.: solicitação sem data). */
  raw?: string
  /** Tamanho da fonte do texto. Padrão 13. */
  size?: number
  iconSize?: number
}

/** Linha "Quinta, 16 de Abr às 22h" com ícone de calendário. */
export function EventDateLine({ iso, raw, size = 13, iconSize = 17 }: EventDateLineProps) {
  const parts = formatEventDateParts(iso)

  return (
    <div className="flex flex-row items-center gap-2">
      <MaterialIcon name="calendar_today" size={iconSize} className="shrink-0 text-[#bdbdbd]" />
      {parts.valid ? (
        <span className="text-[#2a2a2a]" style={{ fontSize: size }}>
          {parts.dow}, <b>{parts.day}</b> de <b>{parts.mon}</b> às <b>{parts.hour}</b>
        </span>
      ) : (
        <span className="text-[#2a2a2a]" style={{ fontSize: size }}>
          {raw || 'Data a definir'}
        </span>
      )}
    </div>
  )
}

interface EventPlaceLineProps {
  place: string
  size?: number
  iconSize?: number
}

/** Linha de local com ícone de pin. */
export function EventPlaceLine({ place, size = 12, iconSize = 17 }: EventPlaceLineProps) {
  return (
    <div className="flex flex-row items-center gap-2">
      <MaterialIcon name="location_on" size={iconSize} className="shrink-0 text-[#bdbdbd]" />
      <span className="truncate text-[#2a2a2a]" style={{ fontSize: size }}>
        {place}
      </span>
    </div>
  )
}
