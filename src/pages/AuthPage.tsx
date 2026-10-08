import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type View } from '../App'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { subscribeDriverToPush } from '../lib/pushNotifications'

interface Props {
  setView?: (v: View) => void
  onAuth?: (role: 'rider' | 'driver') => void
  intent?: 'rider' | 'driver' | 'student'
  defaultMode?: 'login' | 'signup'
}

interface PasswordRule {
  label: string
  valid: boolean
}

function checkPasswordStrength(pw: string): { isValid: boolean; rules: PasswordRule[] } {
  const rules = [
    { label: 'At least 8 characters long', valid: pw.length >= 8 },
    { label: 'At least one uppercase letter (A-Z)', valid: /[A-Z]/.test(pw) },
    { label: 'At least one lowercase letter (a-z)', valid: /[a-z]/.test(pw) },
    { label: 'At least one number (0-9)', valid: /[0-9]/.test(pw) },
    { label: 'At least one special character (!@#$%^&*)', valid: /[^A-Za-z0-9]/.test(pw) },
  ]
  return { isValid: rules.every(r => r.valid), rules }
}

export default function AuthPage({ setView, onAuth, intent = 'rider', defaultMode = 'login' }: Props) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()

  const rawUrlRole = searchParams.get('role')?.toLowerCase()
  const urlRole = rawUrlRole === 'student' ? 'rider' : (rawUrlRole as 'rider' | 'driver' | null)
  const urlMode = searchParams.get('mode') as 'login' | 'signup' | null

  const normalizedIntent: 'rider' | 'driver' = intent === 'student' ? 'rider' : intent
  const initialRole = urlRole === 'driver' || urlRole === 'rider' ? urlRole : normalizedIntent
  const initialMode = urlMode === 'signup' || urlMode === 'login' ? urlMode : defaultMode

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [role, setRole] = useState<'rider' | 'driver'>(initialRole)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    plateNumber: '',
    password: '',
  })
  const [error, setError] = useState('')

  const { isValid: isPasswordValid, rules: passwordRules } = checkPasswordStrength(form.password)

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
    if (mode === 'signup') {
      if (!form.name.trim()) {
        setError('Full name is required.')
        return
      }
      if (!isPasswordValid) {
        setError('Please meet all password security requirements before signing up.')
        return
      }
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
        let resolvedRole = (data?.user?.user_metadata?.role || role).toLowerCase()
        if (resolvedRole === 'student') resolvedRole = 'rider'

        // If driver registered, automatically request notification prompt
        if (resolvedRole === 'driver' && data?.user?.id) {
          subscribeDriverToPush(data.user.id).catch(console.error)
        }

        if (onAuth) onAuth(resolvedRole as 'rider' | 'driver')
        if (setView) setView(resolvedRole as any)
        navigate(resolvedRole === 'driver' ? '/driver' : '/rider')
      } else {
        const data = await signIn({
          email: form.email.trim(),
          password: form.password,
        })

        const userId = data?.user?.id
        let resolvedRole: 'rider' | 'driver' = 'rider'

        if (userId) {
          const { data: driverRow } = await supabase
            .from('driver_profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle()

          if (driverRow) {
            resolvedRole = 'driver'
          } else {
            const metaRole = (data?.user?.user_metadata?.role || '').toLowerCase()
            if (metaRole === 'driver') {
              resolvedRole = 'driver'
            }
          }

          // Auto-subscribe driver on login
          if (resolvedRole === 'driver') {
            subscribeDriverToPush(userId).catch(console.error)
          }
        }

        if (onAuth) onAuth(resolvedRole)
        if (setView) setView(resolvedRole as any)
        navigate(resolvedRole === 'driver' ? '/driver' : '/rider')
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: '#f7f7f7' }}>
      {/* Nav */}
      <div className="flex items-center justify-between px-6 md:px-12 h-16 bg-white" style={{ borderBottom: '1px solid #e8e8e8' }}>
        <button onClick={() => { if (setView) setView('landing'); navigate('/') }}>
          <img src="/logo.png" alt="FutaRide" className="h-8 w-auto" />
        </button>
        <button onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError('') }}
          className="text-sm" style={{ color: '#737373' }}>
          {mode === 'login' ? 'New User? Sign up' : 'Have an account? Log in'}
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
              {(['rider', 'driver'] as const).map(r => (
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
                  placeholder={role === 'rider' ? 'e.g. Oladele Israel' : 'e.g. Adewale Kayode'}
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
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onFocus={() => {
                    if (mode === 'signup') setPasswordTouched(true)
                  }}
                  onChange={e => {
                    set('password', e.target.value)
                    if (!passwordTouched) setPasswordTouched(true)
                  }}
                  placeholder="••••••••"
                  className="w-full pl-4 pr-11 py-3 rounded-xl text-sm focus:outline-none transition-colors"
                  style={{
                    background: '#f7f7f7',
                    border: `1px solid ${
                      error
                        ? '#dc2626'
                        : mode === 'signup' && passwordTouched && !isPasswordValid
                        ? '#fca5a5'
                        : '#e8e8e8'
                    }`,
                    color: '#1a1a1a',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {mode === 'signup' && passwordTouched && (
                <div className="mt-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-1.5 transition-all">
                  <p className="font-semibold text-neutral-700 mb-1">Password Requirements:</p>
                  {passwordRules.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-2 transition-colors">
                      <span
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                          rule.valid
                            ? 'bg-emerald-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {rule.valid ? '✓' : '✕'}
                      </span>
                      <span
                        className={`transition-colors font-medium ${
                          rule.valid ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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