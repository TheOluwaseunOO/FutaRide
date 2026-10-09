import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { type View } from '../App'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { subscribeDriverToPush } from '../lib/pushNotifications'
import CancelRideModal from '../components/CancelRideModal'
import NetworkBanner from '../components/NetworkBanner'
import EmptyState from '../components/EmptyState'
import { RideHistorySkeleton } from '../components/SkeletonLoader'

interface QueueRide {
  id: string
  from: string
  to: string
  fare: number
  rider: string
  dept?: string
  phone: string
  createdAt: string
  sec: number
  customPickup?: string | null
  customDropoff?: string | null
  driverId?: string | null
  status?: string
}

interface CompletedRide {
  id: string
  from: string
  to: string
  fare: number
  rider: string
  time: string
}

interface DriverNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  time: string
  unread: boolean
}

type Phase = 'arriving' | 'in_progress' | 'completed' | null
interface Props { setView?: (v: View) => void }

const TIMEOUT_SECONDS = 180

export default function DriverDashboard({ setView }: Props) {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  const driverName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Driver'
  const firstName = driverName.split(' ')[0]
  const driverPlate = profile?.vehicle_plate_number || user?.user_metadata?.vehicle_plate_number || 'Keke Unit'
  const driverUnit = profile?.role ? `${driverPlate} · ${profile.role}` : `North Gate Unit · ${driverPlate}`

  const [verificationStatus, setVerificationStatus] = useState<'verified' | 'pending' | 'suspended'>(
    (profile?.verification_status as any) || 'verified'
  )

  const [online, setOnline] = useState(true)
  const [pendingQueue, setPendingQueue] = useState<QueueRide[]>([])
  const [activeRide, setActiveRide] = useState<QueueRide | null>(null)
  const [completedRides, setCompletedRides] = useState<CompletedRide[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [phase, setPhase] = useState<Phase>(null)
  const [tab, setTab] = useState<'queue' | 'history'>('queue')
  const [claimError, setClaimError] = useState<string>('')
  
  // Per-driver individual quotes mapped by ride_id
  const [driverQuoteInputs, setDriverQuoteInputs] = useState<Record<string, string>>({})
  const [submittedQuotes, setSubmittedQuotes] = useState<Record<string, number>>({})

  // Transition guard to eliminate UI phase rollback
  const isTransitioningRef = useRef(false)

  // Notifications State
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<DriverNotification[]>([])
  const notifRef = useRef<HTMLDivElement>(null)

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [showIosPrompt, setShowIosPrompt] = useState(false)

  const earnings = completedRides.reduce((s, r) => s + r.fare, 0)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  function getNotificationBadgeColor(type: DriverNotification['type']) {
    switch (type) {
      case 'error': return 'bg-red-500'
      case 'success': return 'bg-emerald-500'
      case 'warning': return 'bg-amber-500'
      default: return 'bg-blue-500'
    }
  }

  // Detect iOS Safari standalone mode
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
    if (isIOS && !isStandalone) setShowIosPrompt(true)
  }, [])

  // Universal Push Registration
  useEffect(() => {
    if (user?.id && online && verificationStatus !== 'suspended') {
      subscribeDriverToPush(user.id).catch(console.warn)
    }
  }, [user?.id, online, verificationStatus])

  // Load quotes submitted by this current driver
  useEffect(() => {
    if (!user) return
    async function loadMyQuotes() {
      const { data } = await supabase
        .from('ride_quotes')
        .select('ride_id, amount')
        .eq('driver_id', user!.id)
      if (data) {
        const map: Record<string, number> = {}
        data.forEach(q => { map[q.ride_id] = Number(q.amount) })
        setSubmittedQuotes(map)
      }
    }
    loadMyQuotes()
  }, [user])

  // Click outside to dismiss notification dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Internal notifications list based on status
  useEffect(() => {
    const list: DriverNotification[] = [
      {
        id: 'welcome',
        title: 'Welcome onboard',
        message: 'Your driver account has been activated for campus dispatch.',
        type: 'info',
        time: 'Active',
        unread: false,
      },
    ]

    if (verificationStatus === 'verified') {
      list.unshift({
        id: 'approved',
        title: 'Your account has been approved',
        message: 'Administrative verification is active. You can now accept rides freely.',
        type: 'success',
        time: 'Live',
        unread: false,
      })
    } else if (verificationStatus === 'suspended') {
      list.unshift({
        id: 'suspended',
        title: 'Your account has been suspended',
        message: 'Dispatch and ride acceptance have been restricted by campus administration.',
        type: 'error',
        time: 'Urgent',
        unread: true,
      })
    }
    setNotifications(list)
  }, [verificationStatus])

  // Map database row safely
  async function transformDbRide(rideRow: any): Promise<QueueRide> {
    let fromName = rideRow.custom_pickup || ''
    let toName = rideRow.custom_dropoff || ''

    if (rideRow.route_id && (!fromName || !toName)) {
      const { data: route } = await supabase
        .from('routes')
        .select('pickup:locations!pickup_location_id(name), dropoff:locations!dropoff_location_id(name)')
        .eq('id', rideRow.route_id)
        .maybeSingle()

      if (route) {
        if (!fromName) fromName = (route.pickup as any)?.name || 'Campus Hub'
        if (!toName) toName = (route.dropoff as any)?.name || 'Campus Hub'
      }
    }

    if (!fromName) fromName = 'Campus Hub'
    if (!toName) toName = 'Campus Hub'

    let riderName = 'Rider'
    let phone = '0800-000-0000'
    let dept: string | undefined = undefined

    const riderId = rideRow.student_id || rideRow.rider_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (riderId && uuidRegex.test(riderId)) {
      try {
        const { data: stProfile } = await supabase
          .from('profiles')
          .select('full_name, phone_number, department')
          .eq('id', riderId)
          .maybeSingle()

        if (stProfile) {
          riderName = stProfile.full_name || 'Rider'
          phone = stProfile.phone_number || phone
          dept = stProfile.department || undefined
        }
      } catch (err) {
        console.warn('Could not fetch profile:', err)
      }
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(rideRow.created_at).getTime()) / 1000))

    return {
      id: rideRow.id,
      from: fromName,
      to: toName,
      fare: Number(rideRow.fare) || 0,
      rider: riderName,
      dept,
      phone,
      createdAt: rideRow.created_at,
      sec: elapsedSeconds,
      customPickup: rideRow.custom_pickup,
      customDropoff: rideRow.custom_dropoff,
      driverId: rideRow.driver_id || null,
      status: rideRow.status,
    }
  }

  // Verification status check
  useEffect(() => {
    if (!user) return
    async function checkVerification() {
      const { data: dp } = await supabase.from('driver_profiles').select('verification_status').eq('id', user!.id).maybeSingle()
      const { data: p } = await supabase.from('profiles').select('verification_status').eq('id', user!.id).maybeSingle()
      const status = dp?.verification_status || p?.verification_status || 'verified'
      setVerificationStatus(status)
      if (status === 'suspended') setOnline(false)
    }
    checkVerification()
  }, [user])

  // Restore active ongoing trip with transition protection
  const restoreActiveRide = useCallback(async () => {
    if (!user || isTransitioningRef.current) return

    try {
      const { data: ongoingRide } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', user.id)
        .in('status', ['accepted', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (ongoingRide) {
        const item = await transformDbRide(ongoingRide)
        setActiveRide(item)
        const dbPhase: Phase = ongoingRide.status === 'accepted' ? 'arriving' : 'in_progress'
        setPhase((prev) => (prev === 'in_progress' && dbPhase === 'arriving' ? prev : dbPhase))
      } else {
        if (!isTransitioningRef.current && (phase === 'arriving' || phase === 'in_progress')) {
          setActiveRide(null)
          setPhase(null)
        }
      }
    } catch (err) {
      console.error('Restore error:', err)
    }
  }, [user, phase])

  useEffect(() => {
    restoreActiveRide()
  }, [restoreActiveRide])

  // Fetch completed rides for today
  useEffect(() => {
    async function loadCompletedRides() {
      if (!user) return
      setLoadingHistory(true)
      try {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const { data } = await supabase
          .from('rides')
          .select('*')
          .eq('driver_id', user.id)
          .eq('status', 'completed')
          .gte('created_at', todayStart.toISOString())
          .order('completed_time', { ascending: false })

        if (data) {
          const items: CompletedRide[] = await Promise.all(
            data.map(async (row) => {
              const tr = await transformDbRide(row)
              return {
                id: row.id,
                from: tr.from,
                to: tr.to,
                fare: tr.fare,
                rider: tr.rider,
                time: row.completed_time
                  ? new Date(row.completed_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Earlier',
              }
            })
          )
          setCompletedRides(items)
        }
      } finally {
        setLoadingHistory(false)
      }
    }
    loadCompletedRides()
  }, [user, phase])

  // Load initial queue
  const loadInitialQueue = useCallback(async () => {
    if (!online || verificationStatus === 'suspended') {
      setPendingQueue([])
      return
    }

    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('status', 'requested')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const mapped = await Promise.all(data.map(transformDbRide))
      setPendingQueue(mapped.filter((r) => r.sec < TIMEOUT_SECONDS))
    }
  }, [online, verificationStatus])

  // Realtime queue listener & instant multi-driver claimed notifications
  useEffect(() => {
    loadInitialQueue()
    if (!online || verificationStatus === 'suspended') return

    const channel = supabase
      .channel('driver-queue-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newRow = payload.new
          if (newRow.status === 'requested') {
            const item = await transformDbRide(newRow)
            if (item.sec < TIMEOUT_SECONDS) {
              setPendingQueue((prev) => [item, ...prev.filter((r) => r.id !== item.id)])
              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate([200, 100, 200])
              }
            }
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedRow = payload.new

          // If accepted by ME, immediately promote to active trip
          if (updatedRow.status === 'accepted' && updatedRow.driver_id === user?.id) {
            const myTrip = await transformDbRide(updatedRow)
            setActiveRide(myTrip)
            setPhase('arriving')
            setPendingQueue((prev) => prev.filter((r) => r.id !== updatedRow.id))
            return
          }

          // If accepted by ANOTHER driver, show instant claimed banner and remove
          if (updatedRow.status === 'accepted' && updatedRow.driver_id !== user?.id) {
            setPendingQueue((prev) => prev.map((r) => (r.id === updatedRow.id ? { ...r, status: 'claimed' } : r)))
            setTimeout(() => {
              setPendingQueue((prev) => prev.filter((r) => r.id !== updatedRow.id))
            }, 3000)
          } else if (updatedRow.status !== 'requested') {
            setPendingQueue((prev) => prev.filter((r) => r.id !== updatedRow.id))
          } else {
            const item = await transformDbRide(updatedRow)
            setPendingQueue((prev) => prev.map((r) => (r.id === item.id ? item : r)))
          }
        } else if (payload.eventType === 'DELETE') {
          setPendingQueue((prev) => prev.filter((r) => r.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [online, verificationStatus, user?.id, loadInitialQueue])

  // Queue elapsed seconds timer
  useEffect(() => {
    if (!online || pendingQueue.length === 0) return
    const interval = setInterval(() => {
      setPendingQueue((prev) =>
        prev
          .map((r) => ({
            ...r,
            sec: Math.max(0, Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 1000)),
          }))
          .filter((r) => r.sec < TIMEOUT_SECONDS)
      )
    }, 1000)
    return () => clearInterval(interval)
  }, [online, pendingQueue.length])

  async function handleToggleOnline() {
    if (verificationStatus === 'suspended') return
    const next = !online
    setOnline(next)
    if (next && user?.id) subscribeDriverToPush(user.id).catch(console.warn)
  }

  // Multi-driver quoting: saves directly to ride_quotes table
  async function handleSendQuote(rideId: string) {
    if (!user || verificationStatus === 'suspended') return
    const quoteVal = Number(driverQuoteInputs[rideId])
    if (!quoteVal || quoteVal <= 0) return

    setSubmittedQuotes((prev) => ({ ...prev, [rideId]: quoteVal }))

    const { error } = await supabase
      .from('ride_quotes')
      .upsert(
        {
          ride_id: rideId,
          driver_id: user.id,
          amount: quoteVal,
          status: 'pending',
        },
        { onConflict: 'ride_id,driver_id' }
      )

    if (error) {
      setClaimError(error.message || 'Failed to submit quote.')
      setSubmittedQuotes((prev) => {
        const copy = { ...prev }
        delete copy[rideId]
        return copy
      })
    }
  }

  // Accept a standard fixed-fare ride
  async function accept(ride: QueueRide) {
    if (!user) return
    isTransitioningRef.current = true
    setActiveRide(ride)
    setPhase('arriving')
    setPendingQueue((prev) => prev.filter((r) => r.id !== ride.id))

    try {
      const { data, error } = await supabase.rpc('claim_ride', {
        p_ride_id: ride.id,
        p_driver_id: user.id,
      })

      setTimeout(() => { isTransitioningRef.current = false }, 1500)
      if (error || !data?.success) {
        setClaimError(data?.message || 'Ride already claimed by another driver.')
        setActiveRide(null)
        setPhase(null)
        loadInitialQueue()
      }
    } catch (err: any) {
      setClaimError(err?.message || 'Failed to claim ride.')
      setActiveRide(null)
      setPhase(null)
      loadInitialQueue()
    }
  }

  async function startRide() {
    if (!activeRide) return
    isTransitioningRef.current = true
    setPhase('in_progress')
    await supabase.from('rides').update({ status: 'in_progress', pickup_time: new Date().toISOString() }).eq('id', activeRide.id)
    setTimeout(() => { isTransitioningRef.current = false }, 1500)
  }

  async function completeRide() {
    if (!activeRide) return
    isTransitioningRef.current = true
    setPhase('completed')
    await supabase.from('rides').update({ status: 'completed', completed_time: new Date().toISOString() }).eq('id', activeRide.id)
    setTimeout(() => { isTransitioningRef.current = false }, 1500)
  }

  function resetRide() {
    setActiveRide(null)
    setPhase(null)
  }

  async function handleConfirmCancel(reason: string) {
    if (!activeRide || !user) return
    setIsCancelling(true)

    try {
      await supabase
        .from('rides')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', activeRide.id)

      setShowCancelModal(false)
      setActiveRide(null)
      setPhase(null)
    } catch (err) {
      console.error('Driver cancellation error:', err)
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-sans pb-12 sm:pb-8" style={{ background: '#f7f7f7' }}>
      <NetworkBanner onReconnect={() => { restoreActiveRide(); loadInitialQueue(); }} />

      {/* Top Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16 bg-white/95 backdrop-blur border-b border-neutral-200">
        <button onClick={() => { if (setView) setView('landing'); navigate('/') }}>
          <img src="/logo.png" alt="FutaRide" className="h-6 sm:h-7 w-auto" />
        </button>

        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* Online Toggle */}
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] sm:text-xs font-bold hidden sm:block"
              style={{ color: online && verificationStatus !== 'suspended' ? '#16a34a' : '#a3a3a3' }}
            >
              {verificationStatus === 'suspended' ? 'Suspended' : online ? 'Online' : 'Offline'}
            </span>
            <button
              onClick={handleToggleOnline}
              disabled={verificationStatus === 'suspended'}
              className="relative w-11 sm:w-12 h-6 rounded-full transition-colors active:scale-95"
              style={{ background: online && verificationStatus !== 'suspended' ? '#E6900E' : '#d4d4d4' }}
            >
              <span
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all"
                style={{ left: online && verificationStatus !== 'suspended' ? '24px' : '4px' }}
              />
            </button>
          </div>

          {/* Notifications Dropdown Container */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(prev => !prev)}
              className="relative p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 transition-colors"
              title="Notifications"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifications.some(n => n.unread) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <div className="fixed sm:absolute top-16 sm:top-full left-3 right-3 sm:left-auto sm:right-0 sm:mt-2 sm:w-80 md:w-88 bg-white rounded-2xl shadow-2xl border border-neutral-200 py-3 z-50">
                <div className="px-4 pb-2.5 border-b border-neutral-100 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Notifications</h4>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                    {notifications.length} alerts
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-3.5 hover:bg-neutral-50 transition-colors flex items-start gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${getNotificationBadgeColor(n.type)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-neutral-800">{n.title}</p>
                          <span className="text-[10px] text-neutral-400">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-neutral-600 mt-0.5 leading-snug">{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hidden sm:block text-right">
            <p className="text-sm font-bold leading-none text-neutral-900 truncate max-w-[140px]">{driverName}</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">{driverUnit}</p>
          </div>

          <button
            onClick={async () => { await signOut(); if (setView) setView('landing'); navigate('/') }}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Greeting Banner */}
      <div className="px-4 sm:px-8 py-5 sm:py-6 bg-white border-b border-neutral-200">
        <div className="max-w-lg mx-auto">
          <p className="text-xs uppercase tracking-wider font-bold mb-0.5" style={{ color: '#E6900E' }}>
            {greeting}, {firstName}
          </p>
          <h2 className="text-xl sm:text-2xl font-black text-neutral-900">
            {verificationStatus === 'suspended'
              ? 'Account Restricted'
              : online
              ? "You're live, watching for rides"
              : 'Go online to start earning'}
          </h2>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-0 py-5 sm:py-6">
        {/* iOS Notice */}
        {showIosPrompt && (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5 shadow-sm">
            <span className="text-base flex-shrink-0 mt-0.5">📲</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold">Using an iPhone?</p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                To receive ride alerts while your screen is locked, tap <strong>Share</strong> and choose <strong>"Add to Home Screen"</strong>.
              </p>
            </div>
            <button onClick={() => setShowIosPrompt(false)} className="text-amber-500 font-bold text-xs px-1">✕</button>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-5">
          {[
            { v: `₦${earnings}`, l: "Today's earnings", accent: true },
            { v: completedRides.length, l: 'Rides today', accent: false },
            { v: online && verificationStatus !== 'suspended' ? pendingQueue.length : 0, l: 'In queue', accent: false },
          ].map((s) => (
            <div key={s.l} className="bg-white rounded-2xl p-3 sm:p-4 text-center border border-neutral-200 shadow-sm">
              <p className="text-lg sm:text-xl font-black mb-0.5 truncate" style={{ color: s.accent ? '#E6900E' : '#1a1a1a' }}>
                {s.v}
              </p>
              <p className="text-[10px] sm:text-xs text-neutral-400 font-medium truncate">{s.l}</p>
            </div>
          ))}
        </div>

        {claimError && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600 shadow-sm">
            {claimError}
          </div>
        )}

        {/* Active Trip Card */}
        {activeRide && phase && phase !== 'completed' && (
          <div className="mb-5 bg-white rounded-2xl overflow-hidden border border-amber-300 shadow-md">
            <div className="px-4 sm:px-5 py-3 flex items-center gap-2.5" style={{ background: phase === 'arriving' ? '#fff7ed' : '#E6900E' }}>
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: phase === 'arriving' ? '#ea580c' : '#fff' }}>
                {phase === 'arriving' ? 'Heading to Passenger Pickup' : 'Ride In Progress'}
              </span>
            </div>
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3.5">
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <p className="text-[11px] text-neutral-400 font-semibold mb-0.5">Pickup</p>
                  <p className="text-xs sm:text-sm font-bold truncate text-neutral-800">{activeRide.from}</p>
                </div>
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <p className="text-[11px] text-neutral-400 font-semibold mb-0.5">Drop-off</p>
                  <p className="text-xs sm:text-sm font-bold truncate text-neutral-800">{activeRide.to}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <div>
                  <p className="text-[11px] text-neutral-400 font-semibold mb-0.5">Rider</p>
                  <p className="text-xs sm:text-sm font-bold text-neutral-900">{activeRide.rider}</p>
                  <p className="text-[11px] font-mono text-neutral-500 mt-0.5">{activeRide.phone}</p>
                </div>
                <p className="text-2xl font-black text-amber-600">₦{activeRide.fare}</p>
              </div>

              {phase === 'arriving' ? (
                <div className="space-y-2">
                  <button
                    onClick={startRide}
                    className="w-full py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white hover:opacity-95 active:scale-[0.99] transition-all shadow-sm"
                    style={{ background: '#E6900E' }}
                  >
                    Passenger Boarded — Start Ride
                  </button>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full py-2.5 rounded-xl text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Cancel Ride
                  </button>
                </div>
              ) : (
                <button
                  onClick={completeRide}
                  className="w-full py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white hover:opacity-90 active:scale-[0.99] transition-all shadow-sm"
                  style={{ background: '#1a1a1a' }}
                >
                  Complete Ride ✓
                </button>
              )}
            </div>
          </div>
        )}

        {/* Completed Modal Card */}
        {phase === 'completed' && activeRide && (
          <div className="mb-5 bg-white rounded-2xl p-6 sm:p-7 text-center border border-neutral-200 shadow-sm">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-2xl shadow-inner">
              ✓
            </div>
            <h3 className="text-lg font-black mb-1 text-neutral-900">Ride Completed!</h3>
            <p className="text-xs sm:text-sm text-neutral-500 mb-2">{activeRide.from} → {activeRide.to}</p>
            <p className="text-3xl font-black text-amber-600 mb-5">+₦{activeRide.fare}</p>
            <button
              onClick={resetRide}
              className="px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm text-white shadow-sm"
              style={{ background: '#E6900E' }}
            >
              Back to Queue
            </button>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl bg-white border border-neutral-200 shadow-sm">
          {(['queue', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all active:scale-[0.98]"
              style={{
                background: tab === t ? '#1a1a1a' : 'transparent',
                color: tab === t ? '#fff' : '#737373',
              }}
            >
              {t === 'queue' ? `Queue${online && verificationStatus !== 'suspended' ? ` (${pendingQueue.length})` : ''}` : "Today's Rides"}
            </button>
          ))}
        </div>

        {/* Tab: Queue */}
        {tab === 'queue' && (!online || verificationStatus === 'suspended') && (
          <EmptyState
            icon="⏻"
            title={verificationStatus === 'suspended' ? 'Account Restricted' : "You're Offline"}
            description="Toggle your status to online above to begin receiving live student ride requests."
            actionLabel={verificationStatus !== 'suspended' ? 'Go Online Now' : undefined}
            onAction={() => setOnline(true)}
          />
        )}

        {tab === 'queue' && online && verificationStatus !== 'suspended' && (
          <div className="space-y-3">
            {pendingQueue.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-neutral-200 shadow-sm">
                <p className="text-sm font-bold text-neutral-800">Scanning for Ride Requests...</p>
                <p className="text-xs text-neutral-400 mt-1">You are active. New ride requests will appear here automatically.</p>
              </div>
            ) : (
              pendingQueue.map((ride) => {
                const isNegotiable = !ride.fare || ride.fare <= 0
                const isClaimedByOther = ride.status === 'claimed'
                const mySubmittedQuote = submittedQuotes[ride.id]

                return (
                  <div key={ride.id} className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200 shadow-sm transition-all">
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] sm:text-xs font-mono text-neutral-400">ID: {ride.id.slice(0, 8)}</span>
                        <p className="text-sm sm:text-base font-bold text-neutral-900 truncate mt-0.5">{ride.from} → {ride.to}</p>
                        <p className="text-xs text-neutral-500 truncate mt-0.5">{ride.rider} {ride.dept ? `· ${ride.dept}` : ''}</p>
                        {isNegotiable && (
                          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            Custom Location
                          </span>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-black" style={{ color: '#E6900E' }}>
                          {ride.fare > 0 ? `₦${ride.fare}` : mySubmittedQuote ? `₦${mySubmittedQuote}` : 'Needs quote'}
                        </p>
                        <div className="flex items-center gap-1 justify-end mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          <span className="text-[11px] font-medium text-neutral-400">{ride.sec}s</span>
                        </div>
                      </div>
                    </div>

                    {isClaimedByOther ? (
                      <div className="p-2.5 bg-neutral-100 rounded-xl text-center text-xs font-bold text-neutral-500 border border-neutral-200">
                        ⚡ Ride claimed by another driver
                      </div>
                    ) : isNegotiable ? (
                      <div className="mt-3 pt-3 border-t border-neutral-100">
                        {mySubmittedQuote ? (
                          <div className="p-2.5 bg-neutral-50 rounded-xl text-center text-xs font-semibold text-neutral-600 border border-neutral-200">
                            Your quote of <span className="font-bold text-amber-600">₦{mySubmittedQuote}</span> was submitted. Awaiting rider's choice...
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Enter price quote (₦)"
                              value={driverQuoteInputs[ride.id] || ''}
                              onChange={(e) => setDriverQuoteInputs({ ...driverQuoteInputs, [ride.id]: e.target.value })}
                              className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 border border-neutral-200 focus:outline-none focus:border-amber-500"
                            />
                            <button
                              onClick={() => handleSendQuote(ride.id)}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 active:scale-95 transition-all"
                            >
                              Quote
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => accept(ride)}
                        disabled={Boolean(activeRide && phase !== 'completed')}
                        className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm bg-neutral-900 text-white hover:opacity-90 active:scale-[0.99] transition-all"
                      >
                        Accept Ride (₦{ride.fare})
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Tab: History */}
        {tab === 'history' && (
          <div className="bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
            <div className="px-4 sm:px-5 py-4 flex items-center justify-between border-b border-neutral-100">
              <h2 className="text-sm sm:text-base font-bold text-neutral-900">Completed Rides Today</h2>
              <span className="text-sm font-black text-amber-600">₦{earnings}</span>
            </div>
            {loadingHistory ? (
              <div className="p-4">
                <RideHistorySkeleton />
              </div>
            ) : completedRides.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon="📊"
                  title="No Rides Completed Yet"
                  description="Complete passenger trips today to build up your daily earnings record."
                />
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {completedRides.map((r) => (
                  <div key={r.id} className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-sm flex-shrink-0">
                        🛺
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-neutral-800 truncate">{r.from} → {r.to}</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{r.time} · {r.rider}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-bold text-xs sm:text-sm text-amber-600">+₦{r.fare}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                        Done
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mandatory Cancellation Modal */}
      <CancelRideModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleConfirmCancel}
        role="driver"
        isSubmitting={isCancelling}
      />
    </div>
  )
}