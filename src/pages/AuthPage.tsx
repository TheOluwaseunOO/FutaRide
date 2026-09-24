import { useState } from 'react'
import { type View } from '../App'

interface Props {
  setView: (v: View) => void
  onAuth: (role: 'student' | 'driver') => void
  intent: 'student' | 'driver'
}

export default function AuthPage({ setView, onAuth, intent }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [role, setRole] = useState<'student' | 'driver'>(intent)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({ name: '', email: '', matric: '', password: '' })
  const [error, setError] = useState('')

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Please fill in all required fields.'); return }
    if (mode === 'signup' && role === 'student' && !form.matric) {
      setError('Matric number is required for students.'); return
    }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onAuth(role)
    }, 900)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f7f7f7' }}>

      {/* Nav */}
      <div className="flex items-center justify-between px-6 md:px-12 h-16 bg-white" style={{ borderBottom: '1px solid #e8e8e8' }}>
        <button onClick={() => setView('landing')}>
          <img src="/src/assets/logo.png" alt="FutaRide" className="h-8 w-auto" />
        </button>
        <button onClick={() => setMode(m => m === 'login' ? 'signup' : 'login')}
          className="text-sm" style={{ color: '#737373' }}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </button>
      </div>

      <div className="flex-1 flex items-start md:items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-sm">

          <div className="mb-8">
            <h1 className="text-3xl font-black mb-1" style={{ fontFamily: 'Outfit, sans-serif', color: '#1a1a1a' }}>
              {mode === 'login' ? 'Welcome back.' : 'Create account.'}
            </h1>
            <p className="text-sm" style={{ color: '#737373' }}>
              {mode === 'login'
                ? 'Log in to access your FutaRide portal.'
                : 'Join FutaRide — free for FUTA students.'}
            </p>
          </div>

          {/* Role toggle */}
          <div className="flex gap-1 p-1 rounded-xl mb-6 bg-white" style={{ border: '1px solid #e8e8e8' }}>
            {(['student', 'driver'] as const).map(r => (
              <button key={r} onClick={() => setRole(r)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                style={{ background: role === r ? '#1a1a1a' : 'transparent', color: role === r ? '#fff' : '#737373' }}>
                {r}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-7 space-y-4" style={{ border: '1px solid #e8e8e8' }}>

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#737373' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder={role === 'student' ? 'e.g. Fatimah Abubakar' : 'e.g. Adewale Kayode'}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                  style={{ background: '#f7f7f7', border: '1px solid #e8e8e8', color: '#1a1a1a' }}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#737373' }}>
                {role === 'student' ? 'FUTA Email' : 'Email Address'}
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder={role === 'student' ? 'you@futa.edu.ng' : 'driver@example.com'}
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                style={{ background: '#f7f7f7', border: '1px solid #e8e8e8', color: '#1a1a1a' }}
              />
            </div>

            {mode === 'signup' && role === 'student' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#737373' }}>
                  Matric Number
                </label>
                <input
                  type="text"
                  value={form.matric}
                  onChange={e => set('matric', e.target.value)}
                  placeholder="e.g. FUTMinna/21/1234"
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none font-mono"
                  style={{ background: '#f7f7f7', border: '1px solid #e8e8e8', color: '#1a1a1a' }}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#737373' }}>
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                style={{ background: '#f7f7f7', border: `1px solid ${error ? '#fca5a5' : '#e8e8e8'}`, color: '#1a1a1a' }}
              />
            </div>

            {error && <p className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-40 mt-2"
              style={{ background: '#E6900E', color: '#fff' }}>
              {loading
                ? (mode === 'login' ? 'Logging in…' : 'Creating account…')
                : (mode === 'login' ? 'Log In' : 'Create Account')}
            </button>
          </form>

          <p className="text-center text-xs mt-5" style={{ color: '#a3a3a3' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
            <button onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError('') }}
              className="font-semibold" style={{ color: '#E6900E' }}>
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>

          {mode === 'signup' && role === 'driver' && (
            <p className="text-center text-xs mt-3 px-4" style={{ color: '#a3a3a3', lineHeight: '1.6' }}>
              Driver accounts require admin approval before activation.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
