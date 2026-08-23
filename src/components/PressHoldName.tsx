import { useCallback, useRef } from 'react'
import { usePressHold } from '../hooks/usePressHold'

export function PressHoldName({
  children,
  onHold,
  className = '',
  title = 'Press and hold for details',
}: {
  children: React.ReactNode
  onHold: () => void
  className?: string
  title?: string
}) {
  const onHoldRef = useRef(onHold)
  onHoldRef.current = onHold

  const handleHold = useCallback(() => {
    onHoldRef.current()
  }, [])

  const { pressHoldProps } = usePressHold(handleHold)

  return (
    <button
      type="button"
      title={title}
      className={`truncate text-left cursor-pointer touch-manipulation ${className}`}
      {...pressHoldProps}
    >
      {children}
    </button>
  )
}
