import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { EventCalendarModal } from './EventCalendarModal'
import { useEventDateFilter } from './useEventDateFilter'
import { dateToDayKey } from '../../../utils/eventDate'
import type { EventFullView } from '../../../features/events'

const APRIL = new Date(2026, 3, 1)

function ev(id: string, iso: string): EventFullView {
  return {
    id_event: id,
    id_slot: `${id}-slot`,
    title: 'Evento',
    description: '',
    location: 'Local',
    is_active: true,
    requested_at: iso,
    approved_at: null,
    capacity: 10,
    slot_status: 'approved',
    created_by: 'u1',
    confirmed_count: 0,
  } as EventFullView
}

describe('EventCalendarModal', () => {
  const noop = () => {}

  it('exibe o mês/ano e marca os dias com evento', () => {
    render(
      <EventCalendarModal
        value={null}
        eventDateKeys={new Set(['2026-04-16'])}
        initialMonth={APRIL}
        onSelect={noop}
        onClear={noop}
        onClose={noop}
      />
    )
    expect(screen.getByText('Abril')).toBeInTheDocument()
    expect(screen.getByText('2026')).toBeInTheDocument()
    expect(screen.getAllByTestId('event-dot')).toHaveLength(1)
  })

  it('seleciona um dia e devolve a data correta', () => {
    const onSelect = vi.fn()
    render(
      <EventCalendarModal
        value={null}
        eventDateKeys={new Set()}
        initialMonth={APRIL}
        onSelect={onSelect}
        onClear={noop}
        onClose={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '16' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(dateToDayKey(onSelect.mock.calls[0][0] as Date)).toBe('2026-04-16')
  })

  it('navega entre os meses', () => {
    render(
      <EventCalendarModal
        value={null}
        eventDateKeys={new Set()}
        initialMonth={APRIL}
        onSelect={noop}
        onClear={noop}
        onClose={noop}
      />
    )
    fireEvent.click(screen.getByLabelText('Próximo mês'))
    expect(screen.getByText('Maio')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Mês anterior'))
    fireEvent.click(screen.getByLabelText('Mês anterior'))
    expect(screen.getByText('Março')).toBeInTheDocument()
  })

  it('"Todas as datas" limpa e "Voltar" fecha', () => {
    const onClear = vi.fn()
    const onClose = vi.fn()
    render(
      <EventCalendarModal
        value={null}
        eventDateKeys={new Set()}
        initialMonth={APRIL}
        onSelect={noop}
        onClear={onClear}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByText('Todas as datas'))
    expect(onClear).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Voltar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('useEventDateFilter', () => {
  const events = [ev('a', '2026-04-16T22:00:00'), ev('b', '2026-04-17T20:00:00')]

  it('sem filtro retorna todos e mapeia os dias com evento', () => {
    const { result } = renderHook(() => useEventDateFilter(events))
    expect(result.current.filtered).toHaveLength(2)
    expect(result.current.eventDateKeys.has('2026-04-16')).toBe(true)
    expect(result.current.eventDateKeys.has('2026-04-17')).toBe(true)
  })

  it('filtra por dia e depois limpa', () => {
    const { result } = renderHook(() => useEventDateFilter(events))

    act(() => result.current.select(new Date(2026, 3, 16)))
    expect(result.current.filtered).toHaveLength(1)
    expect(result.current.filtered[0].id_event).toBe('a')
    expect(result.current.open).toBe(false)

    act(() => result.current.clear())
    expect(result.current.filtered).toHaveLength(2)
    expect(result.current.filterDay).toBeNull()
  })
})
