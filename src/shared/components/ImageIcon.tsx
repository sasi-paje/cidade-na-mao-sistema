import type { ReactNode } from 'react'

export interface ImageIconProps {
  src: string
  alt?: string
  className?: string
}

export const ImageIcon = ({ src, alt, className = "w-6 h-6" }: ImageIconProps) => (
  <img src={src} alt={alt || ''} className={className} />
)