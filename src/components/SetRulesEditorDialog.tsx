import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SetRules } from '../types'
import { SetRulesPicker } from './SetRulesPicker'
import { normalizeSetRules } from '../lib/setRules'
import { Button, InfoNoteCard, PanelSectionTitle } from './ui/primitives'
import { StatusPopups } from './ui/StatusPopups'

export function SetRulesEditorDialog({
  open,
  initialRules,
  onSave,
  onClose,
  saving,
}: {
  open: boolean
  initialRules: SetRules
  onSave: (rules: SetRules) => Promise<void>
  onClose: () => void
  saving?: boolean
}) {
  const [draft, setDraft] = useState(() => normalizeSetRules(initialRules))
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setDraft(normalizeSetRules(initialRules))
      setError('')
    }
  }, [open, initialRules])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const handleSave = async () => {
    setError('')
    try {
      await onSave(normalizeSetRules(draft))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save set rules')
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-rules-editor-title"
        className="relative w-full max-w-md bg-card border border-border-strong rounded-2xl p-4 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <PanelSectionTitle>Edit set rules</PanelSectionTitle>

        <InfoNoteCard>
          Changes apply to unscored matches. Completed scores must still be valid under the new
          best-of settings.
        </InfoNoteCard>

        <SetRulesPicker value={draft} onChange={setDraft} />

        {error ? <StatusPopups error={error} onErrorDismiss={() => setError('')} /> : null}

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saving} fullWidth>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} fullWidth>
            {saving ? 'Saving…' : 'Save set rules'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
