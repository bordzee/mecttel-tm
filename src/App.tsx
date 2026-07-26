import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { TournamentDetailPage } from './pages/TournamentDetailPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { LivePage } from './pages/LivePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { TournamentWizardPage } from './pages/admin/TournamentWizardPage'
import { AdminTournamentHubPage } from './pages/admin/AdminTournamentHubPage'
import { AdminEventPage } from './pages/admin/AdminEventPage'
import { AddEventPage } from './pages/admin/AddEventPage'
import { CreateAdminPage } from './pages/admin/CreateAdminPage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentDetailPage />} />
          <Route path="/tournaments/:tournamentId/events/:eventId" element={<EventDetailPage />} />
          <Route path="/live/:tournamentId/:eventId" element={<LivePage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tournaments/new"
            element={
              <ProtectedRoute>
                <TournamentWizardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tournaments/:tournamentId"
            element={
              <ProtectedRoute>
                <AdminTournamentHubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tournaments/:tournamentId/events/new"
            element={
              <ProtectedRoute>
                <AddEventPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tournaments/:tournamentId/events/:eventId"
            element={
              <ProtectedRoute>
                <AdminEventPage />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/admins/new" element={
            <ProtectedRoute>
              <CreateAdminPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/tournaments" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
