import { useCallback, useRef } from 'react'

export function usePressHold(onHold: () => void, delayMs = 500) {
  const timerRef = useRef<number | null>(null)
  const firedRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onPointerDown = useCallback(() => {
    firedRef.current = false
    clear()
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true
      onHold()
    }, delayMs)
  }, [clear, delayMs, onHold])

  const onPointerUp = useCallback(() => {
    clear()
  }, [clear])

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  return {
    pressHoldProps: {
      onPointerDown,
      onPointerUp,
      onPointerLeave: onPointerUp,
      onPointerCancel: onPointerUp,
      onContextMenu,
    },
    wasHold: () => firedRef.current,
  }
}
