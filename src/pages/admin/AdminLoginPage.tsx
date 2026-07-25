import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { isFirebaseConfigured } from '../../lib/firebase'
import { BackLink, Button, ErrorMessage, FormLabel, TextInput } from '../../components/ui/primitives'

export function AdminLoginPage() {
  const { signIn, user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      navigate(from, { replace: true })
    }
  }, [authLoading, user, isAdmin, navigate, from])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Invalid email or password')
      } else {
        setError(err instanceof Error ? err.message : 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || (user && isAdmin)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="px-4 h-[52px] flex items-center">
        <BackLink to="/">← Public site</BackLink>
      </header>
      <div className="flex-1 flex items-center justify-center px-6 pb-8">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"
        >
          <h1 className="font-heading text-[22px] font-bold text-center text-slate-900">Admin Login</h1>

          {!isFirebaseConfigured && (
            <div className="text-sm text-warning-text bg-warning-bg border border-warning-border p-3 rounded-lg">
              Firebase is not configured. Add your credentials to <code>.env</code>.
            </div>
          )}

          {error && <ErrorMessage className="text-center">{error}</ErrorMessage>}

          <div>
            <FormLabel>Email</FormLabel>
            <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <FormLabel>Password</FormLabel>
            <TextInput
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} fullWidth>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
