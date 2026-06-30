import { useState, useEffect, useCallback } from 'react'

type LoadingState = 'idle' | 'loading' | 'success' | 'error'

interface LoadingFeedback {
  state: LoadingState
  isLoading: boolean
  isLoadingFast: boolean
  isLoadingMedium: boolean
  isLoadingSlow: boolean
  startLoading: () => void
  stopLoading: () => void
  setError: () => void
  reset: () => void
}

const MIN_DELAY = 300 // ms
const MEDIUM_DELAY = 800 // ms
const SLOW_DELAY = 2000 // ms
const VERY_SLOW_DELAY = 10000 // ms

export const useLoadingFeedback = (): LoadingFeedback => {
  const [state, setState] = useState<LoadingState>('idle')
  const [startTime, setStartTime] = useState<number | null>(null)

  const startLoading = useCallback(() => {
    setState('loading')
    setStartTime(Date.now())
  }, [])

  const stopLoading = useCallback(() => {
    setState('success')
    setStartTime(null)
    // Reset after short delay
    setTimeout(() => setState('idle'), 1000)
  }, [])

  const setError = useCallback(() => {
    setState('error')
    setStartTime(null)
    // Reset after delay
    setTimeout(() => setState('idle'), 3000)
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setStartTime(null)
  }, [])

  // Calculate delays
  const isLoadingFast = state === 'loading' && startTime !== null && (Date.now() - startTime) < MIN_DELAY
  const isLoadingMedium = state === 'loading' && startTime !== null && (Date.now() - startTime) >= MIN_DELAY && (Date.now() - startTime) < MEDIUM_DELAY
  const isLoadingSlow = state === 'loading' && startTime !== null && (Date.now() - startTime) >= MEDIUM_DELAY

  return {
    state,
    isLoading: state === 'loading',
    isLoadingFast,
    isLoadingMedium,
    isLoadingSlow,
    startLoading,
    stopLoading,
    setError,
    reset,
  }
}

export const useLoadingState = (
  isLoading: boolean,
  mediumDelay = 800,
  slowDelay = 2000
) => {
  const [showFastFeedback, setShowFastFeedback] = useState(false)
  const [showMediumFeedback, setShowMediumFeedback] = useState(false)
  const [showSlowFeedback, setShowSlowFeedback] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setShowFastFeedback(false)
      setShowMediumFeedback(false)
      setShowSlowFeedback(false)
      return
    }

    setShowFastFeedback(true)

    const mediumTimer = setTimeout(() => setShowMediumFeedback(true), mediumDelay)
    const slowTimer = setTimeout(() => setShowSlowFeedback(true), slowDelay)

    return () => {
      clearTimeout(mediumTimer)
      clearTimeout(slowTimer)
    }
  }, [isLoading, mediumDelay, slowDelay])

  return { showFastFeedback, showMediumFeedback, showSlowFeedback }
}

export { MIN_DELAY, MEDIUM_DELAY, SLOW_DELAY, VERY_SLOW_DELAY }