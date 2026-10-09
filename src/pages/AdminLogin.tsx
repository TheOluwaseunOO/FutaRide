import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isInviteMode, setIsInviteMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    // 1. Check if the URL hash contains invite/recovery tokens
    const hash = window.location.hash
    if (hash && (hash.includes('type=invite') || hash.includes('type=recovery'))) {
      setIsInviteMode(true)
    }

    // 2. Also listen for Supabase auth state change (PASSWORD_RECOVERY or USER_UPDATED)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && hash.includes('type=invite'))) {
        setIsInviteMode(true)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  // Standard Login Handler
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) throw error

      // Check if user is in admin_users
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (!adminRow) {
        await supabase.auth.signOut()
        throw new Error('Access denied. This account does not have admin permissions.')
      }

      navigate('/admin')
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  // Set Initial Password for Invited Admin
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      // Mark invite_status as accepted in admin_users
      if (data.user) {
        await supabase
          .from('admin_users')
          .update({ invite_status: 'accepted', user_id: data.user.id })
          .eq('email', data.user.email?.toLowerCase())
      }

      setSuccessMsg('Password configured successfully! Redirecting...')
      setTimeout(() => {
        navigate('/admin')
      }, 1500)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f7f7] px-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="FutaRide" className="h-8 w-auto" />
        </div>

        <div className="bg-white rounded-3xl p-7 sm:p-8 border border-neutral-200 shadow-sm">
          {isInviteMode ? (
            <>
              <h2 className="text-xl font-black text-neutral-900 mb-1">Welcome to FutaRide Admin</h2>
              <p className="text-xs text-neutral-500 mb-6">Create a password to activate your admin account.</p>

              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                  {successMsg}
                </div>
              )}

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500 transition-colors"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm bg-[#E6900E] text-white hover:opacity-95 active:scale-[0.99] transition-all shadow-sm disabled:opacity-50 mt-2"
                >
                  {loading ? 'Activating Account...' : 'Set Password & Enter Console'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-black text-neutral-900 mb-1">Admin Console</h2>
              <p className="text-xs text-neutral-500 mb-6">Restricted access. Authorised personnel only.</p>

              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@futa.edu.ng"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500 transition-colors"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm bg-neutral-900 text-white hover:bg-neutral-800 active:scale-[0.99] transition-all shadow-sm disabled:opacity-50 mt-2"
                >
                  {loading ? 'Verifying...' : 'Access Console'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="text-center mt-5">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Not an admin? <span className="font-bold text-[#E6900E]">Go back</span>
          </button>
        </div>
      </div>
    </div>
  )
}