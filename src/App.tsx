import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { TournamentDetailPage } from './pages/TournamentDetailPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { LivePage } from './pages/LivePage'
import { NotFoundPage } from './pages/NotFoundPage'

// Admin screens are only needed by organizers, so they load on demand and keep the public bundle small.
const AdminShell = lazy(() => import('./pages/admin/AdminShell').then((m) => ({ default: m.AdminShell })))
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute').then((m) => ({ default: m.ProtectedRoute })))
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })))
const TournamentWizardPage = lazy(() => import('./pages/admin/TournamentWizardPage').then((m) => ({ default: m.TournamentWizardPage })))
const AdminTournamentHubPage = lazy(() => import('./pages/admin/AdminTournamentHubPage').then((m) => ({ default: m.AdminTournamentHubPage })))
const AdminEventPage = lazy(() => import('./pages/admin/AdminEventPage').then((m) => ({ default: m.AdminEventPage })))
const AddEventPage = lazy(() => import('./pages/admin/AddEventPage').then((m) => ({ default: m.AddEventPage })))
const AdminsPage = lazy(() => import('./pages/admin/AdminsPage').then((m) => ({ default: m.AdminsPage })))
const AccountPage = lazy(() => import('./pages/admin/AccountPage').then((m) => ({ default: m.AccountPage })))

function RouteFallback() {
  return <div className="min-h-screen bg-navy" role="status" aria-busy="true" aria-label="Loading" />
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

export default function App() {
  return (
    <BrowserRouter basename={basename}>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentDetailPage />} />
          <Route path="/tournaments/:tournamentId/events/:eventId" element={<EventDetailPage />} />
          <Route path="/live/:tournamentId/:eventId" element={<LivePage />} />
          <Route element={<AdminShell />}>
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
            <Route
              path="/admin/admins"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <AdminsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/account"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />
            <Route path="/admin/tournaments" element={<Navigate to="/admin" replace />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
  )
}
