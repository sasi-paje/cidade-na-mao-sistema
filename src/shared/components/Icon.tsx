import React from 'react'
import {
  DashboardIcon as DashboardIconSvg,
  PersonIcon as PersonIconSvg,
  SettingsIcon as SettingsIconSvg,
  SasiLogo as SasiLogoSvg,
} from '../icons'

interface IconProps {
  className?: string
}

export const DashboardIcon: React.FC<IconProps> = ({ className }) => (
  <DashboardIconSvg className={className} />
)

export const PersonIcon: React.FC<IconProps> = ({ className }) => (
  <PersonIconSvg className={className} />
)

export const SettingsIcon: React.FC<IconProps> = ({ className }) => (
  <SettingsIconSvg className={className} />
)

export const SasiLogo: React.FC<IconProps> = ({ className }) => (
  <SasiLogoSvg className={className} />
)
