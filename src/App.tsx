import { useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import StudentDashboard from './pages/StudentDashboard'
import DriverDashboard from './pages/DriverDashboard'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin from './pages/AdminLogin'
import RoleGuard, { PublicOnlyRoute } from './components/RoleGuard'

export type View =
  | 'landing'
  | 'auth-rider'
  | 'auth-student'
  | 'auth-driver'
  | 'rider'
  | 'student'
  | 'driver'
  | 'admin-login'
  | 'admin'

export default function App() {
  const navigate = useNavigate()
  const [adminAuthed, setAdminAuthed] = useState(false)

  function handleSetView(v: View) {
    if (v === 'landing') navigate('/')
    else if (v === 'auth-rider' || v === 'auth-student') navigate('/auth?role=rider')
    else if (v === 'auth-driver') navigate('/auth?role=driver')
    else if (v === 'rider' || v === 'student') navigate('/rider')
    else if (v === 'driver') navigate('/driver')
    else if (v === 'admin-login') navigate('/admin-login')
    else if (v === 'admin') navigate('/admin')
  }

  function handleAdminAuth() {
    setAdminAuthed(true)
    navigate('/admin')
  }

  function handleAdminSignOut() {
    setAdminAuthed(false)
    navigate('/')
  }

  return (
    <div className="min-h-screen" style={{ background: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <Routes>
        {/* Public Landing */}
        <Route
          path="/"
          element={
            <Landing
              setView={handleSetView}
              goAdmin={() => navigate(adminAuthed ? '/admin' : '/admin-login')}
            />
          }
        />

        {/* Public-only Auth Pages (redirects to appropriate portal if already authenticated) */}
        <Route
          path="/auth"
          element={
            <PublicOnlyRoute>
              <AuthPage setView={handleSetView} />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/auth-rider"
          element={
            <PublicOnlyRoute>
              <AuthPage setView={handleSetView} intent="rider" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/auth-student"
          element={<Navigate to="/auth-rider" replace />}
        />
        <Route
          path="/auth-driver"
          element={
            <PublicOnlyRoute>
              <AuthPage setView={handleSetView} intent="driver" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <AuthPage setView={handleSetView} defaultMode="login" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <AuthPage setView={handleSetView} defaultMode="signup" />
            </PublicOnlyRoute>
          }
        />

        {/* Protected Rider Portal - permits both 'rider' and legacy 'student' */}
        <Route
          path="/rider"
          element={
            <RoleGuard allowedRoles={['rider', 'student']}>
              <StudentDashboard setView={handleSetView} />
            </RoleGuard>
          }
        />
        <Route
          path="/student"
          element={<Navigate to="/rider" replace />}
        />

        {/* Protected Driver Portal - strictly role guarded */}
        <Route
          path="/driver"
          element={
            <RoleGuard allowedRoles={['driver']}>
              <DriverDashboard setView={handleSetView} />
            </RoleGuard>
          }
        />

        {/* Admin Console */}
        <Route
          path="/admin-login"
          element={<AdminLogin onAuth={handleAdminAuth} setView={handleSetView} />}
        />
        <Route
          path="/admin"
          element={
            adminAuthed ? (
              <AdminDashboard setView={handleSetView} onSignOut={handleAdminSignOut} />
            ) : (
              <Navigate to="/admin-login" replace />
            )
          }
        />

        {/* Catch-all redirect to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}