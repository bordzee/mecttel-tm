import { Outlet } from 'react-router-dom'
import { AuthProvider } from '../../hooks/useAuth'

/** Signed-in state exists only under /admin, so public visitors never load Firebase Auth. */
export function AdminShell() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
