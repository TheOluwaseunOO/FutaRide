import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface AdminRecord {
  id: string
  email: string
  is_super_admin: boolean
  invite_status: string
  can_verify_drivers: boolean
  can_suspend_drivers: boolean
  can_suspend_riders: boolean
  can_manage_locations: boolean
  can_manage_fares: boolean
  can_settle_disputes: boolean
  can_view_audits: boolean
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function AdminManagerModal({ isOpen, onClose }: Props) {
  const [admins, setAdmins] = useState<AdminRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const [rights, setRights] = useState({
    can_verify_drivers: true,
    can_suspend_drivers: false,
    can_suspend_riders: false,
    can_manage_locations: false,
    can_manage_fares: false,
    can_settle_disputes: true,
    can_view_audits: false,
  })

  const toggleList = [
    { key: 'can_verify_drivers', label: 'Verify Drivers', desc: 'Approve, reject, or put drivers on review' },
    { key: 'can_suspend_drivers', label: 'Suspend Drivers', desc: 'Revoke or ban driver dispatch activity' },
    { key: 'can_suspend_riders', label: 'Suspend Riders', desc: 'Ban fraudulent or abusive rider accounts' },
    { key: 'can_manage_locations', label: 'Manage Locations', desc: 'Add or delete campus hubs & nodes' },
    { key: 'can_manage_fares', label: 'Manage Fares', desc: 'Edit campus standard route pricing' },
    { key: 'can_settle_disputes', label: 'Settle Disputes', desc: 'Review in-ride chat and resolve delays' },
    { key: 'can_view_audits', label: 'View Audits', desc: 'Access platform stats, logs, & earnings' },
  ] as const

  async function loadAdmins() {
    setLoading(true)
    const { data } = await supabase.from('admin_users').select('*').order('created_at', { ascending: false })
    if (data) setAdmins(data as AdminRecord[])
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen) loadAdmins()
  }, [isOpen])

  async function handleAddAdmin() {
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    setIsSubmitting(true)
    setStatusMsg('')

    try {
      // 1. Save admin rights in Postgres
      const { data, error } = await supabase.rpc('upsert_admin_with_rights', {
        p_email: email,
        p_can_verify_drivers: rights.can_verify_drivers,
        p_can_suspend_drivers: rights.can_suspend_drivers,
        p_can_suspend_riders: rights.can_suspend_riders,
        p_can_manage_locations: rights.can_manage_locations,
        p_can_manage_fares: rights.can_manage_fares,
        p_can_settle_disputes: rights.can_settle_disputes,
        p_can_view_audits: rights.can_view_audits,
      })

      if (error || !data?.success) {
        setStatusMsg(data?.message || error?.message || 'Failed to save admin.')
        return
      }

      // 2. Trigger the invite email via the Edge Function
      try {
        const { error: fnErr } = await supabase.functions.invoke('invite-admin', {
          body: { email },
        })
        if (fnErr) {
          console.warn('Invite email notification notice:', fnErr)
        }
      } catch (e) {
        console.warn('Invite function error:', e)
      }

      setStatusMsg(`Invitation email sent & rights configured for ${email}!`)
      setEmailInput('')
      loadAdmins()
    } catch (err: any) {
      setStatusMsg(err.message || 'Error assigning admin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteAdmin(id: string) {
    if (!confirm('Are you sure you want to revoke this admin access?')) return
    await supabase.from('admin_users').delete().eq('id', id)
    loadAdmins()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-neutral-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
          <div>
            <h3 className="text-base font-black text-neutral-900">Admin Team Management</h3>
            <p className="text-xs text-neutral-500">Assign role rights and permission toggles</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 font-bold text-sm">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Add Admin Form */}
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">Add New Admin</h4>
            <input
              type="email"
              placeholder="Admin Email (e.g. staff@futa.edu.ng)"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-neutral-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
            />

            {/* Rights Toggles */}
            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Set Rights & Access:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {toggleList.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-neutral-200 cursor-pointer hover:border-amber-400 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={rights[item.key as keyof typeof rights]}
                      onChange={(e) => setRights({ ...rights, [item.key]: e.target.checked })}
                      className="mt-0.5 rounded accent-[#E6900E] focus:ring-0 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-800 leading-none">{item.label}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5 leading-tight">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {statusMsg && (
              <p className="text-xs font-semibold text-amber-700">{statusMsg}</p>
            )}

            <button
              onClick={handleAddAdmin}
              disabled={isSubmitting || !emailInput.trim()}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 transition-all active:scale-[0.99]"
            >
              {isSubmitting ? 'Saving...' : 'Add Admin with Selected Rights'}
            </button>
          </div>

          {/* Current Admins List */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">Active Admin Team ({admins.length})</h4>
            {loading ? (
              <p className="text-xs text-neutral-400">Loading administrators...</p>
            ) : (
              <div className="space-y-2">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="p-3 bg-white border border-neutral-200 rounded-xl flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-neutral-900 truncate">{admin.email}</p>
                        {admin.is_super_admin && (
                          <span className="text-[10px] font-normal uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Super Admin
                          </span>
                        )}
                        <span className={`text-[10px] font-light px-1.5 py-0.5 rounded ${admin.invite_status === 'accepted' ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500'}`}>
                          {admin.invite_status}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1 truncate">
                        Rights: {[
                          admin.can_verify_drivers && 'Verify',
                          admin.can_suspend_drivers && 'Suspend Drivers',
                          admin.can_suspend_riders && 'Suspend Riders',
                          admin.can_manage_locations && 'Locations',
                          admin.can_manage_fares && 'Fares',
                          admin.can_settle_disputes && 'Disputes',
                          admin.can_view_audits && 'Audits',
                        ].filter(Boolean).join(' · ') || 'None'}
                      </p>
                    </div>

                    {!admin.is_super_admin && (
                      <button
                        onClick={() => handleDeleteAdmin(admin.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded hover:bg-red-50"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}