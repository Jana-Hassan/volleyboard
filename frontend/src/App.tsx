import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './store/AuthContext'
import { useAuth } from './hooks/useAuth'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import TeamPage from './pages/TeamPage'
import LineupPage from './pages/LineupPage'
import MatchPage from './pages/MatchPage'
import NewMatchPage from './pages/NewMatchPage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import NewTeamPage from './pages/NewTeamPage'

const MatchReportPage = lazy(() => import('./pages/MatchReportPage'))

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-dvh bg-surface flex items-center justify-center">
        <div className="text-us text-sm tracking-widest uppercase">
          Loading...
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

const AppRoutes = () => {
  const { user } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams/new"
        element={
          <ProtectedRoute>
            <NewTeamPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams/:teamId/matches/new"
        element={
          <ProtectedRoute>
            <NewMatchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams/:teamId/lineups/new"
        element={
          <ProtectedRoute>
            <LineupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams/:teamId/lineups/:lineupId"
        element={
          <ProtectedRoute>
            <LineupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams/:teamId/players/:playerId"
        element={
          <ProtectedRoute>
            <PlayerProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams/:teamId"
        element={
          <ProtectedRoute>
            <TeamPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/matches/:matchId/report"
        element={
          <ProtectedRoute>
            <Suspense fallback={<div className="h-dvh bg-surface" />}>
              <MatchReportPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/matches/:matchId"
        element={
          <ProtectedRoute>
            <MatchPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App