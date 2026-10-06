import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type View } from '../App'
import { supabase } from '../lib/supabase'

interface Props {
  onAuth: () => void
  setView?: (v: View) => void
}

export default function AdminLogin({ onAuth, setView }: Props) {
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(false)
  const [loading, setLoading]   = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    setErrorMsg('')

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (authErr || !authData.user) {
        throw new Error('Invalid email or password.')
      }

      // 2. Check if the authenticated user has the 'admin' role
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle()

      const userRole = (profileData?.role || authData.user.user_metadata?.role || '').toLowerCase()

      if (userRole !== 'admin') {
        await supabase.auth.signOut()
        throw new Error('Access denied. This account does not have admin permissions.')
      }

      onAuth()
      navigate('/admin')
    } catch (err: any) {
      setError(true)
      setErrorMsg(err.message || 'Invalid credentials. Access denied.')
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  function handleGoHome() {
    if (setView) setView('landing')
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#f7f7f7' }}>
      <div className="w-full max-w-sm">

        <button onClick={handleGoHome} className="block mb-10 text-center w-full">
          <img src="/logo.png" alt="FutaRide" className="h-8 w-auto" />
        </button>

        <div className="bg-white rounded-2xl p-8" style={{ border: '1px solid #e8e8e8' }}>
          <div className="mb-7">
            <h1 className="text-xl font-black mb-1" style={{ fontFamily: 'Outfit, sans-serif', color: '#1a1a1a' }}>
              Admin Console
            </h1>
            <p className="text-sm" style={{ color: '#737373' }}>
              Restricted access. Authorised personnel only.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: '#737373' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(false) }}
                placeholder="Admin email address"
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                style={{
                  background: '#f7f7f7',
                  border: `1px solid ${error ? '#fca5a5' : '#e8e8e8'}`,
                  color: '#1a1a1a',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: '#737373' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(false) }}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                style={{
                  background: '#f7f7f7',
                  border: `1px solid ${error ? '#fca5a5' : '#e8e8e8'}`,
                  color: '#1a1a1a',
                }}
              />
              {error && (
                <p className="text-xs mt-1.5" style={{ color: '#dc2626' }}>
                  {errorMsg || 'Invalid credentials. Access denied.'}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={!email || !password || loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 hover:opacity-90"
              style={{ background: '#1a1a1a', color: '#fff' }}>
              {loading ? 'Verifying…' : 'Access Console'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#a3a3a3' }}>
          Not an admin?{' '}
          <button onClick={handleGoHome} className="font-semibold" style={{ color: '#E6900E' }}>
            Go back
          </button>
        </p>
      </div>
    </div>
  )
}