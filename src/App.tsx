import { useState } from 'react'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import StudentDashboard from './pages/StudentDashboard'
import DriverDashboard from './pages/DriverDashboard'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin from './pages/AdminLogin'

export type View = 'landing' | 'auth-student' | 'auth-driver' | 'student' | 'driver' | 'admin-login' | 'admin'

export default function App() {
  const [view, setView] = useState<View>('landing')
  const [adminAuthed, setAdminAuthed] = useState(false)
  const [userAuthed, setUserAuthed] = useState(false)

  function goPortal(role: 'student' | 'driver') {
    if (userAuthed) setView(role)
    else setView(role === 'student' ? 'auth-student' : 'auth-driver')
  }

  function goAdmin() {
    if (adminAuthed) setView('admin')
    else setView('admin-login')
  }

  function onUserAuth(role: 'student' | 'driver') {
    setUserAuthed(true)
    setView(role)
  }

  function onAdminAuth() {
    setAdminAuthed(true)
    setView('admin')
  }

  return (
    <div className="min-h-screen" style={{ background: '#fff', fontFamily: 'Inter, sans-serif' }}>
      {view === 'landing'      && <Landing setView={(v) => {
        if (v === 'student') goPortal('student')
        else if (v === 'driver') goPortal('driver')
        else setView(v as View)
      }} goAdmin={goAdmin} />}
      {view === 'auth-student' && <AuthPage setView={setView as any} onAuth={onUserAuth} intent="student" />}
      {view === 'auth-driver'  && <AuthPage setView={setView as any} onAuth={onUserAuth} intent="driver" />}
      {view === 'student'      && userAuthed && <StudentDashboard setView={setView as any} />}
      {view === 'driver'       && userAuthed && <DriverDashboard setView={setView as any} />}
      {view === 'admin-login'  && <AdminLogin onAuth={onAdminAuth} setView={setView as any} />}
      {view === 'admin'        && adminAuthed && <AdminDashboard setView={setView as any} />}
    </div>
  )
}
