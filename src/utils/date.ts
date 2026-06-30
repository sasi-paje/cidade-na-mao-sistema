// =====================================================
// DATE HELPERS - TRATAMENTO SEGURO DE DATAS
// =====================================================
// Problema: DATE do banco (yyyy-mm-dd) não tem timezone.
// new Date() interpreta como UTC, causando diferença de dia.
// Solução: Tratar sempre como string quando for DATE puro.
// =====================================================

/**
 * Formata data do banco (yyyy-mm-dd) para exibição brasileira (dd/mm/yyyy)
 * NÃO usa new Date() para não causar erro de timezone
 */
export function formatDateOnlyToBR(date?: string | null): string {
  if (!date) return '-'

  // Já está em formato brasileiro
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    return date
  }

  // Formato ISO do banco (yyyy-mm-dd)
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-')
    return `${day}/${month}/${year}`
  }

  return date
}

/**
 * Converte data para formato do banco (yyyy-mm-dd)
 * Aceita string BR (dd/mm/yyyy), ISO (yyyy-mm-dd), ou Date object
 */
export function formatDateOnlyToDB(date?: string | Date | null): string {
  if (!date) return ''

  // Se já é string no formato ISO, retorna como está
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date

    // Converte de BR para ISO
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      const [day, month, year] = date.split('/')
      return `${year}-${month}-${day}`
    }
  }

  // Para Date object, extrai componentes diretamente sem timezone
  if (date instanceof Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return ''
}

/**
 * Verifica se uma string é uma data válida no formato yyyy-mm-dd
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const date = new Date(dateStr + 'T00:00:00')
  return !isNaN(date.getTime())
}