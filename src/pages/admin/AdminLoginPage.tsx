import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useMinLoading } from '../../hooks/useMinLoading'
import { isFirebaseConfigured } from '../../lib/firebase'
import { AuthCheckingSkeleton } from '../../components/ui/Skeleton'
import { StatusPopups } from '../../components/ui/StatusPopups'
import {
  BackLink,
  Button,
  BrandDot,
  FormLabelLight,
  TextInputLight,
  WarningBanner,
} from '../../components/ui/primitives'
import { ThemeToggle } from '../../components/ThemeToggle'

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
      if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
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
      <StatusPopups error={error} onErrorDismiss={() => setError('')} />
      <header className="px-4 h-14 flex items-center justify-between">
        <BackLink to="/">Public site</BackLink>
        <ThemeToggle />
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-16 gap-5">
        <BrandDot className="!w-11 !h-11" />
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-card rounded-[14px] border border-border p-6 space-y-4"
        >
          <div className="space-y-1">
            <h1 className="font-heading text-[22px] font-semibold tracking-tight text-text-primary">Admin sign in</h1>
            <p className="text-sm text-text-steel">For tournament organizers.</p>
          </div>

          {!isFirebaseConfigured && (
            <WarningBanner>Firebase is not configured. Sign-in may be unavailable.</WarningBanner>
          )}

          {!authLoading && user && !isAdmin && (
            <WarningBanner>
              Signed in as {user.email} without admin access. Sign out and use an admin account.
            </WarningBanner>
          )}

          <div>
            <FormLabelLight>Email</FormLabelLight>
            <TextInputLight
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <FormLabelLight>Password</FormLabelLight>
            <TextInputLight
              type="password"
              required
              autoComplete="current-password"
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
