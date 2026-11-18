import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'

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

  return (
    <Modal
      role="alertdialog"
      labelledBy="delete-confirm-title"
      describedBy="delete-confirm-description"
      onClose={requestClose}
      backdropClassName={`confirm-backdrop confirm-backdrop--${phase}`}
      panelClassName={`confirm-dialog confirm-dialog--${phase} w-full max-w-sm bg-card border border-border-strong rounded-2xl p-5 space-y-4 shadow-[var(--shadow-pop)]`}
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
          className="text-danger shrink-0 mt-0.5"
          aria-hidden
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        <div className="min-w-0 space-y-1.5">
          <p id="delete-confirm-title" className="text-sm font-semibold text-danger leading-snug">
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
          data-autofocus
          className="press h-12 rounded-[10px] bg-card-raised text-text-primary font-medium text-[15px] hover:shadow-[inset_0_0_0_1px_var(--line-strong)] disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className="press h-12 rounded-[10px] bg-danger text-on-danger font-semibold text-[15px] hover:opacity-90 disabled:opacity-50"
        >
          {confirming ? confirmingLabel : confirmLabel}
        </button>
      </div>

    </Modal>
  )
}
