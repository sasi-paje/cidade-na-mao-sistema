import { ReactNode, useState } from 'react'

export interface TableColumn<T> {
  key: keyof T | string
  label: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (row: T, index: number) => ReactNode
}

export interface SharedTableProps<T extends { id: string | number }> {
  columns: TableColumn<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyMessage?: string
  // Selection props
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectRow?: (id: string, selected: boolean) => void
  onSelectAll?: (selected: boolean) => void
}

// Figma Design Tokens - following Figma exactly
const TEXT_COLOR = '#2A2A2A'
const TEXT_COLOR_LIGHT = '#9E9E9E'
const BG_HEADER = '#F0F4F9'
const BG_ZEBRA_1 = '#FFFFFF'
const BG_ZEBRA_2 = '#F0F4F9'
const BORDER_COLOR = '#E0E0E0'
const HOVER_COLOR = '#E8F4FD'
const ORANGE_ACCENT = '#e67c26'

export function SharedTable<T extends { id: string | number }>({
  columns,
  data,
  onRowClick,
  loading = false,
  emptyMessage = 'Nenhum registro encontrado',
  selectable = false,
  selectedIds = new Set(),
  onSelectRow,
  onSelectAll,
}: SharedTableProps<T>) {
  const [hoveredRow, setHoveredRow] = useState<string | number | null>(null)

  // Check if all rows are selected
  const allSelected = data.length > 0 && data.every(row => selectedIds.has(String(row.id)))
  const someSelected = data.some(row => selectedIds.has(String(row.id)))

  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll(true)
    } else if (onSelectRow) {
      data.forEach(row => onSelectRow(String(row.id), true))
    }
  }

  const handleDeselectAll = () => {
    if (onSelectAll) {
      onSelectAll(false)
    } else if (onSelectRow) {
      data.forEach(row => onSelectRow(String(row.id), false))
    }
  }

  const handleSelectRow = (id: string, selected: boolean) => {
    if (onSelectRow) {
      onSelectRow(id, selected)
    }
  }

  const getAlignment = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'text-center'
      case 'right':
        return 'text-right'
      default:
        return 'text-left'
    }
  }

  const getCellAlignment = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'justify-center'
      case 'right':
        return 'justify-end'
      default:
        return 'justify-start'
    }
  }

  const colSpan = columns.length + (selectable ? 1 : 0)
  return (
    <div className="w-full overflow-hidden">
      <table className="w-full border-collapse table-fixed">
        <colgroup>
          {selectable && <col key="select" style={{ width: '50px' }} />}
          {columns.map((column) => (
            <col key={String(column.key)} style={{ width: column.width }} />
          ))}
        </colgroup>

        {/* Header - Figma: 40px height, gray background */}
        <thead className="sticky top-0 z-10">
          <tr>
            {selectable && (
              <th
                className="px-4 text-center"
                style={{
                  width: '50px',
                  height: '40px',
                  backgroundColor: BG_HEADER,
                  color: TEXT_COLOR,
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected
                  }}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleSelectAll()
                    } else {
                      handleDeselectAll()
                    }
                  }}
                  className="w-4 h-4 accent-[#0f3255] cursor-pointer"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={`h-10 px-4 ${getAlignment(column.align)}`}
                style={{
                  backgroundColor: BG_HEADER,
                  color: TEXT_COLOR,
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={colSpan}
                className="h-[100px] text-center"
                style={{ color: TEXT_COLOR, fontSize: '14px' }}
              >
                Carregando...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={colSpan}
                className="h-[100px] text-center"
                style={{ color: TEXT_COLOR_LIGHT, fontSize: '14px' }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const rowId = String(row.id)
              const isSelected = selectedIds.has(rowId)
              return (
                <tr
                  key={rowId}
                  onClick={() => onRowClick?.(row)}
                  onMouseEnter={() => setHoveredRow(rowId)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className="cursor-pointer"
                  style={{
                    backgroundColor:
                      hoveredRow === rowId
                        ? HOVER_COLOR
                        : index % 2 === 0
                          ? BG_ZEBRA_1
                          : BG_ZEBRA_2,
                    height: '44px',
                  }}
                >
                  {selectable && (
                    <td
                      className="px-4 text-center"
                      style={{
                        width: '50px',
                        color: TEXT_COLOR,
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif',
                        borderBottom: `1px solid ${BORDER_COLOR}`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(rowId, !isSelected)}
                        className="w-4 h-4 accent-[#0f3255] cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((column) => {
                    const content = column.render
                      ? column.render(row, index)
                      : String(row[column.key as keyof T] ?? '-')

                    return (
                      <td
                        key={String(column.key)}
                        className={`px-4 ${getCellAlignment(column.align)}`}
                        style={{
                          color: TEXT_COLOR,
                          fontSize: '14px',
                          fontWeight: 500,
                          fontFamily: 'Inter, sans-serif',
                          borderBottom: `1px solid ${BORDER_COLOR}`,
                        }}
                      >
                        {content}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
