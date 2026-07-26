import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isFirebaseConfigured } from '../lib/firebase'
import { AdminLayout } from './AdminLayout'
import { Button, WarningBanner } from './ui/primitives'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, signOut } = useAuth()
  const location = useLocation()

  if (!isFirebaseConfigured) {
    return (
      <AdminLayout>
        <div className="space-y-4 py-8">
          <WarningBanner>
            Firebase is not configured. Copy <code className="font-mono">.env.example</code> to{' '}
            <code className="font-mono">.env</code>, fill in your project keys, and restart the dev
            server.
          </WarningBanner>
          <Link
            to="/"
            className="text-sm font-semibold text-brand-500 hover:underline inline-block"
          >
            Back to home
          </Link>
        </div>
      </AdminLayout>
    )
  }

  if (loading) {
    return (
      <AdminLayout>
        <p className="text-text-steel py-8">Loading…</p>
      </AdminLayout>
    )
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 text-center gap-4">
          <p className="text-live font-semibold">Access denied</p>
          <p className="text-sm text-text-steel max-w-md">
            Signed in as {user.email}, but no admin profile was found. Ensure{' '}
            <code className="bg-card-raised px-1 rounded">profiles/{user.uid}</code> exists with{' '}
            <code className="bg-card-raised px-1 rounded">role: admin</code>.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
            <Button type="button" variant="secondary" onClick={() => signOut()} fullWidth>
              Sign out
            </Button>
            <Link
              to="/admin/login"
              className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-text-bluewhite hover:border-brand-500/50 transition-colors w-full"
            >
              Back to login
            </Link>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return <>{children}</>
}
