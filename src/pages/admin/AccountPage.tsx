import { useState } from 'react'
import { AdminLayout } from '../../components/AdminLayout'
import { BackLink, Button, Card, EventPageTitle, FormLabel, TagPill, TextInput } from '../../components/ui/primitives'
import { StatusPopups } from '../../components/ui/StatusPopups'
import { useAuth } from '../../hooks/useAuth'
import { changeOwnPassword, MIN_PASSWORD_LENGTH } from '../../lib/adminAccounts'

/** Every admin can change their own password here. */
export function AccountPage() {
  const { user, profile } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (next !== repeat) {
      setError('The two new passwords do not match')
      return
    }
    setBusy(true)
    try {
      await changeOwnPassword(current, next)
      setCurrent('')
      setNext('')
      setRepeat('')
      setMessage('Password changed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-lg">
        <div className="space-y-3">
          <BackLink to="/admin">Dashboard</BackLink>
          <EventPageTitle>Account</EventPageTitle>
          <p className="flex items-center gap-2 text-sm text-text-steel">
            <span>{user?.email}</span>
            {profile?.role === 'superadmin' && <TagPill>Superadmin</TagPill>}
          </p>
        </div>

        <StatusPopups
          success={message}
          error={error}
          onSuccessDismiss={() => setMessage('')}
          onErrorDismiss={() => setError('')}
        />

        <Card as="form" onSubmit={submit} className="p-4 space-y-3.5">
          <h2 className="font-heading text-base font-semibold text-text-primary">Change password</h2>
          <div>
            <FormLabel>Current password</FormLabel>
            <TextInput type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div>
            <FormLabel>New password</FormLabel>
            <TextInput
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            />
          </div>
          <div>
            <FormLabel>Repeat the new password</FormLabel>
            <TextInput type="password" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy || !current || !next} fullWidth>
            {busy ? 'Saving…' : 'Change password'}
          </Button>
        </Card>
      </div>
    </AdminLayout>
  )
}
