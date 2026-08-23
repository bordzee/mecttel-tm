export function PressHoldName({
  children,
  onHold,
  className = '',
  title = 'Tap for details',
}: {
  children: React.ReactNode
  onHold: () => void
  className?: string
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onHold}
      className={`truncate text-left cursor-pointer select-none touch-manipulation ${className}`}
    >
      {children}
    </button>
  )
}
