import { useState } from 'react'
import { type View } from '../App'

interface Props {
  onAuth: () => void
  setView: (v: View) => void
}

const ADMIN_EMAIL = 'transport.admin@futa.edu.ng'
const ADMIN_PASS  = 'admin2025'

export default function AdminLogin({ onAuth, setView }: Props) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(false)
  const [loading, setLoading]   = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    setTimeout(() => {
      if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASS) {
        onAuth()
      } else {
        setError(true)
        setPassword('')
      }
      setLoading(false)
    }, 800)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#f7f7f7' }}>
      <div className="w-full max-w-sm">

        <button onClick={() => setView('landing')} className="block mb-10 text-center w-full">
          <img src="/src/assets/logo.png" alt="FutaRide" className="h-8 w-auto" />
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
                  Invalid credentials. Access denied.
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
          <button onClick={() => setView('landing')} className="font-semibold" style={{ color: '#E6900E' }}>
            Go back
          </button>
        </p>
      </div>
    </div>
  )
}
