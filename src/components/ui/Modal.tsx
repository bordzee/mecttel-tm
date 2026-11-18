import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const openModals: symbol[] = []

// Shared scroll lock: nested dialogs must not restore each other's saved value.
let scrollLocks = 0
let savedOverflow = ''
function lockScroll() {
  if (scrollLocks++ === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}
function unlockScroll() {
  if (--scrollLocks === 0) document.body.style.overflow = savedOverflow
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal shell: portal, scrim, labelled dialog panel.
 * - Focus moves into the dialog on open, is trapped while open, and returns on close.
 * - Escape and a scrim click call `onClose` (omit it for dialogs that must be answered).
 * - Page scroll is locked while open.
 */
export function Modal({
  children,
  labelledBy,
  describedBy,
  onClose,
  scrimDismiss = true,
  role = 'dialog',
  z = 'z-[250]',
  center = false,
  panelClassName = '',
  backdropClassName = '',
  panelProps,
}: {
  children: React.ReactNode
  labelledBy: string
  describedBy?: string
  onClose?: () => void
  /** Clicking the scrim closes the dialog (needs onClose). */
  scrimDismiss?: boolean
  role?: 'dialog' | 'alertdialog'
  z?: string
  /** Center on every breakpoint instead of rising from the bottom on phones. */
  center?: boolean
  panelClassName?: string
  backdropClassName?: string
  panelProps?: React.HTMLAttributes<HTMLDivElement>
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const id = Symbol('modal')
    openModals.push(id)
    const previouslyFocused = document.activeElement as HTMLElement | null
    lockScroll()

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
    const preferred = panel.querySelector<HTMLElement>('[data-autofocus]')
    ;(preferred ?? focusables()[0] ?? panel).focus({ preventScroll: true })

    const onKeyDown = (e: KeyboardEvent) => {
      // Only the top-most dialog reacts when several are stacked.
      if (openModals[openModals.length - 1] !== id) return
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      openModals.splice(openModals.indexOf(id), 1)
      unlockScroll()
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div
      className={`fixed inset-0 ${z} flex ${center ? 'items-center' : 'items-end sm:items-center'} justify-center p-4`}
    >
      <div
        className={`absolute inset-0 bg-[var(--scrim)] ${backdropClassName}`}
        aria-hidden
        onClick={scrimDismiss && onClose ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`relative focus:outline-none ${panelClassName}`}
        {...panelProps}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
