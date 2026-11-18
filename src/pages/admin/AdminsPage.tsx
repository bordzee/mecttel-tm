import { useCallback, useEffect, useState } from 'react'
import { AdminLayout } from '../../components/AdminLayout'
import {
  BackLink,
  Button,
  Card,
  EmptyMessage,
  EventPageTitle,
  FormLabel,
  InfoNoteCard,
  SectionHeaderRow,
  TagPill,
  TextInput,
} from '../../components/ui/primitives'
import { DeleteConfirmDialog } from '../../components/ui/DeleteConfirmDialog'
import { StatusPopups } from '../../components/ui/StatusPopups'
import { useAuth } from '../../hooks/useAuth'
import {
  createAdminAccount,
  listAdmins,
  removeAdminAccess,
  sendAdminPasswordReset,
} from '../../lib/adminAccounts'
import { setMasterPassword } from '../../lib/guardedDelete'
import { formatDisplayDate } from '../../lib/formatDate'
import type { Profile } from '../../types'

/** Superadmin only: who can sign in to the admin area, and the master password. */
export function AdminsPage() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [removing, setRemoving] = useState<Profile | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  const [newMaster, setNewMaster] = useState('')
  const [confirmMaster, setConfirmMaster] = useState('')
  const [savingMaster, setSavingMaster] = useState(false)

  const load = useCallback(async () => {
    try {
      setAdmins(await listAdmins())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load admins')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || creating) return
    setCreating(true)
    setError('')
    setCreated(null)
    setCopied(false)
    try {
      const result = await createAdminAccount(email, user.uid)
      setCreated({ email: email.trim().toLowerCase(), password: result.password })
      setEmail('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the admin')
    } finally {
      setCreating(false)
    }
  }

  const copyPassword = async () => {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.password)
      setCopied(true)
    } catch {
      setError('Could not copy. Select the password and copy it by hand.')
    }
  }

  const handleRemove = async () => {
    if (!removing || removeBusy) return
    setRemoveBusy(true)
    try {
      await removeAdminAccess(removing.id)
      setMessage(`${removing.email ?? 'The admin'} can no longer use the admin area.`)
      setRemoving(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the admin')
      setRemoving(null)
    } finally {
      setRemoveBusy(false)
    }
  }

  const handleReset = async (admin: Profile) => {
    if (!admin.email) return
    try {
      await sendAdminPasswordReset(admin.email)
      setMessage(`A password reset email was sent to ${admin.email}.`)
    } catch {
      setError('Could not send the reset email. Use the admin tool to set a new password instead.')
    }
  }

  const handleSaveMaster = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingMaster) return
    setError('')
    if (newMaster !== confirmMaster) {
      setError('The two master passwords do not match')
      return
    }
    setSavingMaster(true)
    try {
      await setMasterPassword(newMaster)
      setNewMaster('')
      setConfirmMaster('')
      setMessage('Master password saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the master password')
    } finally {
      setSavingMaster(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="space-y-3">
          <BackLink to="/admin">Dashboard</BackLink>
          <EventPageTitle>Admins</EventPageTitle>
        </div>

        <StatusPopups
          success={message}
          error={error}
          onSuccessDismiss={() => setMessage('')}
          onErrorDismiss={() => setError('')}
        />

        <section className="space-y-3">
          <SectionHeaderRow title="Add an admin" />
          <Card as="form" onSubmit={handleCreate} className="p-4 space-y-3.5">
            <div>
              <FormLabel>Email</FormLabel>
              <TextInput
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="newadmin@mecttel.com"
              />
            </div>
            <p className="text-[13px] text-text-steel">
              A password is generated for you to hand over. The admin can change it under Account.
            </p>
            <Button type="submit" disabled={creating || !email.trim()} fullWidth>
              {creating ? 'Creating…' : 'Create admin'}
            </Button>
          </Card>

          {created && (
            <div role="status" className="rounded-[14px] bg-green-soft p-4 space-y-3">
              <p className="text-sm font-medium text-text-primary">
                Admin created. Give these to {created.email} now: the password is shown only once.
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-text-steel">Email</dt>
                <dd className="font-mono break-all">{created.email}</dd>
                <dt className="text-text-steel">Password</dt>
                <dd className="font-mono break-all select-all">{created.password}</dd>
              </dl>
              <Button type="button" variant="secondary" onClick={copyPassword}>
                {copied ? 'Copied' : 'Copy password'}
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeaderRow title="Who has access" />
          {loading ? (
            <EmptyMessage>Loading…</EmptyMessage>
          ) : admins.length === 0 ? (
            <EmptyMessage>No admins yet.</EmptyMessage>
          ) : (
            <ul className="rounded-[14px] bg-card ring-1 ring-border divide-y divide-border">
              {admins.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary truncate">{a.email ?? 'No email on file'}</p>
                    <p className="text-[13px] text-text-steel">
                      {a.created_at ? `Added ${formatDisplayDate(a.created_at.slice(0, 10))}` : a.id}
                    </p>
                  </div>
                  {a.role === 'superadmin' ? (
                    <TagPill>Superadmin</TagPill>
                  ) : (
                    <div className="flex items-center gap-1">
                      {a.email && (
                        <Button type="button" variant="secondary" className="!h-10 px-3 text-[13px]" onClick={() => handleReset(a)}>
                          Send reset email
                        </Button>
                      )}
                      <Button type="button" variant="secondary" className="!h-10 px-3 text-[13px] !text-danger" onClick={() => setRemoving(a)}>
                        Remove
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <InfoNoteCard>
            Removing an admin ends their access straight away. Their login stays until you delete it with
            the admin tool (<code className="font-mono">npm run admin-tool</code>) or in the Firebase console.
            To give someone a new password yourself, use the admin tool.
          </InfoNoteCard>
        </section>

        <section className="space-y-3">
          <SectionHeaderRow title="Master password" />
          <Card as="form" onSubmit={handleSaveMaster} className="p-4 space-y-3.5">
            <p className="text-[13px] text-text-steel">
              Needed to delete a division or a tournament. Nobody can read it back, so keep it somewhere safe.
              Saving a new one replaces the old one.
            </p>
            <div>
              <FormLabel>New master password</FormLabel>
              <TextInput type="password" autoComplete="new-password" value={newMaster} onChange={(e) => setNewMaster(e.target.value)} />
            </div>
            <div>
              <FormLabel>Repeat it</FormLabel>
              <TextInput type="password" autoComplete="new-password" value={confirmMaster} onChange={(e) => setConfirmMaster(e.target.value)} />
            </div>
            <Button type="submit" disabled={savingMaster || !newMaster} fullWidth>
              {savingMaster ? 'Saving…' : 'Save master password'}
            </Button>
          </Card>
        </section>
      </div>

      <DeleteConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.email ?? 'this admin'}?`}
        description="They will no longer be able to use the admin area. You can add them again later."
        confirmLabel="Remove admin"
        confirmingLabel="Removing…"
        onCancel={() => setRemoving(null)}
        onConfirm={handleRemove}
        confirming={removeBusy}
      />
    </AdminLayout>
  )
}
