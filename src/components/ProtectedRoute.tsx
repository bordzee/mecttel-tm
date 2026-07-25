import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 text-center gap-3">
        <p className="text-red-600 font-medium">Access denied</p>
        <p className="text-sm text-slate-500">
          Signed in as {user.email}, but no admin profile was found. Ensure{' '}
          <code className="bg-slate-100 px-1 rounded">profiles/{user.uid}</code> exists with{' '}
          <code className="bg-slate-100 px-1 rounded">role: admin</code>.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
