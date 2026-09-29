import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type View } from '../App'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

interface Props {
  setView?: (v: View) => void
  onAuth?: (role: 'student' | 'driver') => void
  intent?: 'student' | 'driver'
  defaultMode?: 'login' | 'signup'
}

export default function AuthPage({ setView, onAuth, intent = 'student', defaultMode = 'login' }: Props) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()

  const urlRole = searchParams.get('role') as 'student' | 'driver' | null
  const urlMode = searchParams.get('mode') as 'login' | 'signup' | null

  const initialRole = urlRole === 'driver' || urlRole === 'student' ? urlRole : intent
  const initialMode = urlMode === 'signup' || urlMode === 'login' ? urlMode : defaultMode

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [role, setRole] = useState<'student' | 'driver'>(initialRole)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    plateNumber: '',
    password: '',
  })
  const [error, setError] = useState('')

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Please fill in all required fields.')
      return
    }
    if (mode === 'signup' && !form.name.trim()) {
      setError('Full name is required.')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (mode === 'signup') {
        const data = await signUp({
          email: form.email.trim(),
          password: form.password,
          fullName: form.name.trim(),
          phoneNumber: form.phone.trim(),
          role,
          vehiclePlateNumber: role === 'driver' ? (form.plateNumber.trim() || null) : null,
        })
        const resolvedRole = (data?.user?.user_metadata?.role || role).toLowerCase()
        if (onAuth) onAuth(resolvedRole as 'student' | 'driver')
        if (setView) setView(resolvedRole as any)
        navigate(resolvedRole === 'driver' ? '/driver' : '/student')
      } else {
        // Unified login: authenticate with credentials first
        const data = await signIn({
          email: form.email.trim(),
          password: form.password,
        })

        const userId = data?.user?.id
        let resolvedRole: 'student' | 'driver' = 'student'

        if (userId) {
          // Check if registered as a driver in driver_profiles
          const { data: driverRow } = await supabase
            .from('driver_profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle()

          if (driverRow) {
            resolvedRole = 'driver'
          } else {
            const metaRole = data?.user?.user_metadata?.role
            if (metaRole === 'driver') {
              resolvedRole = 'driver'
            }
          }
        }

        if (onAuth) onAuth(resolvedRole)
        if (setView) setView(resolvedRole as any)
        navigate(resolvedRole === 'driver' ? '/driver' : '/student')
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f7f7f7' }}>

      {/* Nav */}
      <div className="flex items-center justify-between px-6 md:px-12 h-16 bg-white" style={{ borderBottom: '1px solid #e8e8e8' }}>
        <button onClick={() => { if (setView) setView('landing'); navigate('/'); }}>
          <img src="/src/assets/logo.png" alt="FutaRide" className="h-8 w-auto" />
        </button>
        <button onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError('') }}
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
                : 'Join FutaRide — quick rides across campus.'}
            </p>
          </div>

          {/* Role toggle: shown ONLY during signup */}
          {mode === 'signup' && (
            <div className="flex gap-1 p-1 rounded-xl mb-6 bg-white" style={{ border: '1px solid #e8e8e8' }}>
              {(['student', 'driver'] as const).map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                  style={{ background: role === r ? '#1a1a1a' : 'transparent', color: role === r ? '#fff' : '#737373' }}>
                  {r}
                </button>
              ))}
            </div>
          )}

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
                Email Address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="name@example.com"
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                style={{ background: '#f7f7f7', border: '1px solid #e8e8e8', color: '#1a1a1a' }}
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#737373' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="e.g. 08012345678"
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                  style={{ background: '#f7f7f7', border: '1px solid #e8e8e8', color: '#1a1a1a' }}
                />
              </div>
            )}

            {mode === 'signup' && role === 'driver' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#737373' }}>
                  Plate Number
                </label>
                <input
                  type="text"
                  value={form.plateNumber}
                  onChange={e => set('plateNumber', e.target.value)}
                  placeholder="e.g. AKR-123-XA"
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