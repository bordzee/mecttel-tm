import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { AdminLayout } from '../../components/AdminLayout'
import {
  AdminPageTitle,
  Button,
  Card,
  ErrorMessage,
  FormLabel,
  MetaText,
  SuccessMessage,
  TextInput,
} from '../../components/ui/primitives'
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
      setMessage(`Admin account created for ${email}`)
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
      <AdminPageTitle>Create admin</AdminPageTitle>
      <MetaText className="mt-2 mb-6 block">
        Requires the createAdmin Cloud Function, or add a user in Firebase Auth with profiles/&#123;uid&#125; role: admin.
      </MetaText>

      <Card as="form" onSubmit={handleSubmit} className="p-4 space-y-4">
        {message && <SuccessMessage>{message}</SuccessMessage>}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div>
          <FormLabel>Email</FormLabel>
          <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
    </AdminLayout>
  )
}
