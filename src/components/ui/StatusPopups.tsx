import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const AUTO_DISMISS_MS = 4200

type PopupKind = 'success' | 'error'

function PopupCard({
  kind,
  message,
  onDismiss,
}: {
  kind: PopupKind
  message: string
  onDismiss: () => void
}) {
  const [phase, setPhase] = useState<'enter' | 'idle' | 'exit'>('enter')
  const [mounted, setMounted] = useState(true)
  const finishedRef = useRef(false)
  const isSuccess = kind === 'success'

  useEffect(() => {
    finishedRef.current = false
    setMounted(true)
    setPhase('enter')
  }, [message])

  const finishExit = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setMounted(false)
    onDismiss()
  }, [onDismiss])

  useEffect(() => {
    if (phase !== 'idle') return
    const timer = setTimeout(() => setPhase('exit'), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [phase, message])

  useEffect(() => {
    if (phase !== 'enter') return
    const timer = setTimeout(() => setPhase((current) => (current === 'enter' ? 'idle' : current)), 360)
    return () => clearTimeout(timer)
  }, [phase, message])

  useEffect(() => {
    if (phase !== 'exit') return
    const timer = setTimeout(finishExit, 300)
    return () => clearTimeout(timer)
  }, [phase, finishExit])

  const handleAnimationEnd = useCallback(
    (event: React.AnimationEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return
      if (phase === 'enter') {
        setPhase('idle')
        return
      }
      if (phase === 'exit') {
        finishExit()
      }
    },
    [phase, finishExit],
  )

  const dismissNow = useCallback(() => {
    if (phase !== 'exit') setPhase('exit')
  }, [phase])

  if (!mounted) return null

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      onAnimationEnd={handleAnimationEnd}
      className={`status-popup status-popup--${phase} pointer-events-auto flex items-start gap-2.5 max-w-sm w-full rounded-2xl border px-4 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${
        isSuccess
          ? 'bg-green-soft border-winner text-text-bluewhite'
          : 'bg-red-soft border-live text-text-bluewhite'
      }`}
    >
      {isSuccess ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-winner shrink-0 mt-0.5"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-live shrink-0 mt-0.5"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      )}

      <p className="flex-1 min-w-0 text-sm font-medium leading-snug">{message}</p>

      <button
        type="button"
        onClick={dismissNow}
        className="shrink-0 rounded-lg p-1 text-text-steel transition-colors hover:text-text-bluewhite"
        aria-label="Dismiss"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}

export function StatusPopups({
  success,
  error,
  onSuccessDismiss,
  onErrorDismiss,
}: {
  success?: string
  error?: string
  onSuccessDismiss?: () => void
  onErrorDismiss?: () => void
}) {
  const [activeSuccess, setActiveSuccess] = useState<string | undefined>()
  const [activeError, setActiveError] = useState<string | undefined>()

  useEffect(() => {
    if (success) setActiveSuccess(success)
  }, [success])

  useEffect(() => {
    if (error) setActiveError(error)
  }, [error])

  if (!activeSuccess && !activeError) return null

  return createPortal(
    <div className="fixed inset-x-0 bottom-6 z-[200] flex flex-col items-center gap-2.5 pointer-events-none px-4">
      {activeSuccess ? (
        <PopupCard
          key={`success:${activeSuccess}`}
          kind="success"
          message={activeSuccess}
          onDismiss={() => {
            setActiveSuccess(undefined)
            onSuccessDismiss?.()
          }}
        />
      ) : null}
      {activeError ? (
        <PopupCard
          key={`error:${activeError}`}
          kind="error"
          message={activeError}
          onDismiss={() => {
            setActiveError(undefined)
            onErrorDismiss?.()
          }}
        />
      ) : null}
    </div>,
    document.body,
  )
}
