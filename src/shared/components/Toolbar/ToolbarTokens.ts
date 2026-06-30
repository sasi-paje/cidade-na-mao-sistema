/**
 * Toolbar Design Tokens
 * Sistema visual padronizado para todas as toolbars do Cidade na Mão
 *
 * Baseado no padrão Figma - node 825-37209 (Cargas)
 */

export const ToolbarTokens = {
  // ==========Alturas==========
  HEIGHT_SEARCH: '40px',
  HEIGHT_BUTTON: '45px',
  HEIGHT_FILTER: '40px',

  // ==========Larguras==========
  WIDTH_SEARCH_DEFAULT: '526px',
  WIDTH_SEARCH_LARGE: '526px',
  WIDTH_SEARCH_SMALL: '360px',
  WIDTH_SEARCH_MEDIUM: '400px',
  WIDTH_FILTER: '40px',

  // ==========Cores==========
  COLOR_ORANGE: '#E67C26',
  COLOR_SYSTEM: '#4077D9',  // Primary color from Figma
  COLOR_BLUE: '#4077D9',
  COLOR_WHITE: '#FFFFFF',
  COLOR_BORDER: '#BDBDBD',
  COLOR_TEXT: '#2A2A2A',           // Neutral/Black/Light75
  COLOR_PLACEHOLDER: '#BDBDBD',    // Neutrals/Grey/Lighter
  COLOR_GRAY_BG: '#F9F9F9',        // background/light

  // ==========Espaçamento==========
  PADDING_CONTAINER_X: '16px',
  PADDING_CONTAINER_Y: '12px',
  PADDING_INPUT_X: '8px',
  PADDING_BUTTON_X: '8px',
  GAP_TOOLBAR: '8px',
  GAP_BUTTONS: '8px',

  // ==========Border==========
  BORDER_RADIUS_SM: '4px',
  BORDER_RADIUS_MD: '5px',
  BORDER_RADIUS_LG: '5px',

  // ==========Tipografia==========
  FONT_FAMILY: 'Inter, sans-serif',
  FONT_SIZE_INPUT: '14px',
  FONT_SIZE_BUTTON: '14px',
  FONT_SIZE_PLACEHOLDER: '14px',
  FONT_WEIGHT_TEXT: 400,           // Regular
  FONT_WEIGHT_BUTTON: 700,        // Bold
  FONT_WEIGHT_HEADER: 600,         // Semibold
  LINE_HEIGHT_TEXT: '24px',

  // ==========Ícones==========
  ICON_SIZE_SEARCH: 24,
  ICON_SIZE_BUTTON: 24,
  ICON_SIZE_FILTER: 24,
} as const

export type ToolbarTokens = typeof ToolbarTokens