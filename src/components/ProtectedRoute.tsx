import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMinLoading } from '../hooks/useMinLoading'
import { isFirebaseConfigured } from '../lib/firebase'
import { AdminLayout } from './AdminLayout'
import { AuthCheckingSkeleton } from './ui/Skeleton'
import { Button, WarningBanner } from './ui/primitives'

export function ProtectedRoute({
  children,
  requireSuperAdmin = false,
}: {
  children: React.ReactNode
  /** Only the superadmin may open this page (managing admins, master password). */
  requireSuperAdmin?: boolean
}) {
  const { user, isAdmin, isSuperAdmin, loading, signOut } = useAuth()
  const showAuthSkeleton = useMinLoading(loading)
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
            className="text-sm font-semibold text-accent-text hover:underline inline-block"
          >
            Back to home
          </Link>
        </div>
      </AdminLayout>
    )
  }

  if (showAuthSkeleton) {
    return (
      <AdminLayout>
        <AuthCheckingSkeleton />
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
          <p className="text-danger font-semibold">Access denied</p>
          <p className="text-sm text-text-steel max-w-md">
            Signed in as {user.email}, but this account is not an admin (or was removed). Ask the superadmin for access.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
            <Button type="button" variant="secondary" onClick={() => signOut()} fullWidth>
              Sign out
            </Button>
            <Link
              to="/admin/login"
              className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text-bluewhite hover:border-brand-500/50 transition-colors w-full"
            >
              Back to login
            </Link>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 text-center gap-3">
          <p className="text-danger font-semibold">Superadmin only</p>
          <p className="text-sm text-text-steel max-w-md">Only the superadmin can manage admins and the master password.</p>
          <Link to="/admin" className="text-sm font-medium text-accent-text hover:underline">
            Back to the dashboard
          </Link>
        </div>
      </AdminLayout>
    )
  }

  return <>{children}</>
}
