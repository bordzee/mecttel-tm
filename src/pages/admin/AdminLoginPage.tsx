import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useMinLoading } from '../../hooks/useMinLoading'
import { isFirebaseConfigured } from '../../lib/firebase'
import { AuthCheckingSkeleton } from '../../components/ui/Skeleton'
import {
  BackLink,
  Button,
  ErrorMessage,
  FormLabelLight,
  TextInputLight,
} from '../../components/ui/primitives'

export function AdminLoginPage() {
  const { signIn, signOut, user, isAdmin, loading: authLoading } = useAuth()
  const showAuthSkeleton = useMinLoading(authLoading)
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
      const profile = await signIn(email, password)
      if (profile?.role !== 'admin') {
        await signOut()
        setError('This account does not have admin access.')
        return
      }
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

  if (showAuthSkeleton || (user && isAdmin)) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <AuthCheckingSkeleton message="Signing in" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col">
      <header className="px-4 h-[52px] flex items-center">
        <BackLink to="/">Public site</BackLink>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10">
        <div className="w-11 h-11 rounded-full bg-brand-500 flex items-center justify-center mb-3">
          <span className="font-heading font-extrabold text-lg text-white">TT</span>
        </div>
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.35)] p-6 space-y-4"
        >
          <h1 className="font-heading text-[22px] font-extrabold text-text-on-light">Admin Login</h1>

          {!isFirebaseConfigured && (
            <div className="text-xs font-medium text-[#8A5A00] bg-[#FFF4E0] border border-[#F0C066] p-2.5 rounded-[10px]">
              Firebase is not configured. Sign-in may be unavailable.
            </div>
          )}

          {error && <ErrorMessage className="text-center">{error}</ErrorMessage>}

          {!authLoading && user && !isAdmin && (
            <div className="text-xs font-medium text-[#8A5A00] bg-[#FFF4E0] border border-[#F0C066] p-2.5 rounded-[10px]">
              Signed in as {user.email} without admin access. Sign out and use an admin account.
            </div>
          )}

          <div>
            <FormLabelLight>Email</FormLabelLight>
            <TextInputLight type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <FormLabelLight>Password</FormLabelLight>
            <TextInputLight
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading || !isFirebaseConfigured} fullWidth>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
