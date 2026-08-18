import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const EXIT_MS = 280

export function DeleteConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Keep',
  confirmingLabel = 'Deleting…',
  confirming = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  confirmingLabel?: string
  confirming?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const [mounted, setMounted] = useState(open)
  const [phase, setPhase] = useState<'enter' | 'idle' | 'exit'>('enter')
  const wasOpen = useRef(open)

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      setMounted(true)
      setPhase('enter')
      const raf = requestAnimationFrame(() => setPhase('idle'))
      return () => cancelAnimationFrame(raf)
    }

    if (!wasOpen.current) return

    wasOpen.current = false
    setPhase('exit')
    const timer = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  if (!mounted) return null

  const requestClose = () => {
    if (confirming) return
    onCancel()
  }

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-4">
      <div
        className={`confirm-backdrop confirm-backdrop--${phase} absolute inset-0 bg-black/60`}
        aria-hidden
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-description"
        className={`confirm-dialog confirm-dialog--${phase} relative w-full max-w-sm bg-card border border-live rounded-2xl p-4 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)]`}
      >
        <div className="flex items-start gap-2.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-live shrink-0 mt-0.5"
            aria-hidden
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <div className="min-w-0 space-y-1.5">
            <p id="delete-confirm-title" className="text-sm font-bold text-live leading-snug">
              {title}
            </p>
            <p id="delete-confirm-description" className="text-[13px] text-text-bluewhite leading-snug">
              {description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={requestClose}
            disabled={confirming}
            className="h-[46px] rounded-xl bg-winner text-white font-semibold text-[15px] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="h-[46px] rounded-xl bg-live text-white font-bold text-[15px] hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {confirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
