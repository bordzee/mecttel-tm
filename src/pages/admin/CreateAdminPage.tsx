import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { AdminLayout } from '../../components/AdminLayout'
import {
  EventPageTitle,
  BackLink,
  Button,
  Card,
  FormLabel,
  InfoNoteCard,
  TextInput,
} from '../../components/ui/primitives'
import { StatusPopups } from '../../components/ui/StatusPopups'
import { functions } from '../../lib/firebase'

export function CreateAdminPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const createAdmin = httpsCallable(functions, 'createAdmin')
      await createAdmin({ email, password })
      setMessage('Admin account created.')
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed. Deploy the createAdmin Cloud Function or add users in Firebase Console.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <BackLink to="/admin">Dashboard</BackLink>
        <EventPageTitle>Create admin</EventPageTitle>

        <InfoNoteCard>
          Creating admins requires a configured Firebase Cloud Function. This will fail if setup is incomplete.
        </InfoNoteCard>

        <StatusPopups
          success={message}
          error={error}
          onSuccessDismiss={() => setMessage('')}
          onErrorDismiss={() => setError('')}
        />

        <Card as="form" onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <div>
            <FormLabel>Email</FormLabel>
            <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="newadmin@mecttel.org" />
          </div>
          <div>
            <FormLabel>Password</FormLabel>
            <TextInput
              type="password"
              required
              minLength={8}
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} fullWidth>
            {loading ? 'Creating…' : 'Create admin'}
          </Button>
        </Card>
      </div>
    </AdminLayout>
  )
}
