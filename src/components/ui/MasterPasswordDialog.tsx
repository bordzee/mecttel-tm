import { useState } from 'react'
import { Modal } from './Modal'
import { Button, FormLabel, TextInput } from './primitives'

/**
 * Guard for irreversible deletes. A wrong password is rejected by the security rules
 * before anything is deleted, and the dialog stays open.
 */
export function MasterPasswordDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel: string
  /** Throw to show an error and keep the dialog open. */
  onConfirm: (password: string) => Promise<void>
  onCancel: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete')
      setPassword('')
      setBusy(false)
    }
  }

  return (
    <Modal
      role="alertdialog"
      labelledBy="master-delete-title"
      describedBy="master-delete-description"
      onClose={busy ? undefined : onCancel}
      scrimDismiss={false}
      panelClassName="w-full max-w-sm bg-card border border-border-strong rounded-2xl p-5 space-y-4 shadow-[var(--shadow-pop)]"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <h2 id="master-delete-title" className="font-heading text-base font-semibold text-danger">
            {title}
          </h2>
          <p id="master-delete-description" className="text-[13px] text-text-steel leading-snug">
            {description}
          </p>
        </div>

        <div>
          <FormLabel>Master password</FormLabel>
          <TextInput
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            data-autofocus
            aria-invalid={error ? true : undefined}
          />
          {error && (
            <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy} fullWidth>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" disabled={busy || !password} fullWidth>
            {busy ? 'Deleting…' : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
