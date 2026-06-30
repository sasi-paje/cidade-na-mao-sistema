import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

// ErrorBoundary só captura erros que ocorrem durante o render de componentes filhos.
// O React emite console.error mesmo quando o erro é corretamente capturado pela boundary —
// suprimimos aqui para manter a saída dos testes limpa.
const suppressConsoleError = () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  return () => spy.mockRestore()
}

describe('ErrorBoundary', () => {
  let restoreConsole: (() => void) | null = null

  afterEach(() => {
    restoreConsole?.()
    restoreConsole = null
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="success">Content loaded</div>
      </ErrorBoundary>
    )
    expect(screen.getByTestId('success')).toBeInTheDocument()
  })

  it('renders fallback when child throws during render', () => {
    restoreConsole = suppressConsoleError()

    const ThrowingComponent = () => {
      throw new Error('Test render error')
    }

    const Fallback = () => <div data-testid="fallback">Error occurred</div>

    render(
      <ErrorBoundary fallback={<Fallback />}>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByTestId('fallback')).toBeInTheDocument()
  })

  it('renders default error UI when no fallback is provided and child throws', () => {
    restoreConsole = suppressConsoleError()

    const ThrowingComponent = () => {
      throw new Error('Test render error')
    }

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    expect(screen.getByText('Test render error')).toBeInTheDocument()
  })
})