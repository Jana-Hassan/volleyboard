import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './store/AuthContext.tsx'
import { useAuth } from './hooks/useAuth.ts'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import TeamPage from './pages/TeamPage'
import LineupPage from './pages/LineupPage'
import MatchPage from './pages/MatchPage'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050d0f] flex items-center justify-center">
        <div className="text-[#2A835F] text-sm tracking-widest uppercase">
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
        path="/teams/:teamId"
        element={
          <ProtectedRoute>
            <TeamPage />
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