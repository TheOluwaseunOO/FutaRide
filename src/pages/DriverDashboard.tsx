import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { type View } from '../App'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

interface QueueRide {
  id: string
  from: string
  to: string
  fare: number
  student: string
  dept: string
  phone: string
  createdAt: string
  sec: number
  customPickup?: string | null
  customDropoff?: string | null
  fareQuote?: number | null
  quoteStatus?: string
}

interface CompletedRide {
  id: string
  from: string
  to: string
  fare: number
  student: string
  time: string
}

type Phase = 'arriving' | 'in_progress' | 'completed' | null
interface Props { setView?: (v: View) => void }

export default function DriverDashboard({ setView }: Props) {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  const driverName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Driver'
  const firstName = driverName.split(' ')[0]
  const driverPlate = profile?.vehicle_plate_number || user?.user_metadata?.vehicle_plate_number || 'Keke Unit'
  const driverUnit = profile?.role ? `${driverPlate} · ${profile.role}` : `North Gate Unit · ${driverPlate}`

  const [online, setOnline] = useState(true)
  const [pendingQueue, setPendingQueue] = useState<QueueRide[]>([])
  const [activeRide, setActiveRide] = useState<QueueRide | null>(null)
  const [completedRides, setCompletedRides] = useState<CompletedRide[]>([])
  const [phase, setPhase] = useState<Phase>(null)
  const [tab, setTab] = useState<'queue' | 'history'>('queue')
  const [claimError, setClaimError] = useState<string>('')
  const [loadingActive, setLoadingActive] = useState(true)

  // Driver quote inputs state for off-campus negotiation
  const [driverQuoteInputs, setDriverQuoteInputs] = useState<Record<string, string>>({})

  const earnings = completedRides.reduce((s, r) => s + r.fare, 0)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Helper: Map database row to standard UI object with off-campus fields
  async function transformDbRide(rideRow: any): Promise<QueueRide> {
    let fromName = rideRow.custom_pickup || 'Campus Hub'
    let toName = rideRow.custom_dropoff || 'Destination Hub'

    if (rideRow.route_id && (!rideRow.custom_pickup || !rideRow.custom_dropoff)) {
      const { data: route } = await supabase
        .from('routes')
        .select('pickup:locations!pickup_location_id(name), dropoff:locations!dropoff_location_id(name)')
        .eq('id', rideRow.route_id)
        .maybeSingle()

      if (route) {
        if (!rideRow.custom_pickup) fromName = (route.pickup as any)?.name || fromName
        if (!rideRow.custom_dropoff) toName = (route.dropoff as any)?.name || toName
      }
    }

    let studentName = 'Student'
    let phone = '0800-000-0000'
    let dept = 'Undergraduate'

    if (rideRow.student_id) {
      const { data: stProfile } = await supabase
        .from('profiles')
        .select('full_name, phone_number, department')
        .eq('id', rideRow.student_id)
        .maybeSingle()

      if (stProfile) {
        studentName = stProfile.full_name || studentName
        phone = stProfile.phone_number || phone
        dept = stProfile.department || dept
      }
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(rideRow.created_at).getTime()) / 1000))

    return {
      id: rideRow.id,
      from: fromName,
      to: toName,
      fare: Number(rideRow.fare) || 0,
      student: studentName,
      dept,
      phone,
      createdAt: rideRow.created_at,
      sec: elapsedSeconds,
      customPickup: rideRow.custom_pickup,
      customDropoff: rideRow.custom_dropoff,
      fareQuote: rideRow.fare_quote ? Number(rideRow.fare_quote) : null,
      quoteStatus: rideRow.quote_status || 'none',
    }
  }

  // 1. Check for ongoing active ride on mount/refresh
  useEffect(() => {
    async function restoreActiveRide() {
      if (!user) return
      setLoadingActive(true)

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
          setPhase(ongoingRide.status === 'accepted' ? 'arriving' : 'in_progress')
        }
      } catch (err) {
        console.error('Failed restoring active trip:', err)
      } finally {
        setLoadingActive(false)
      }
    }

    restoreActiveRide()
  }, [user])

  // 2. Fetch completed rides for today's history tab
  useEffect(() => {
    async function loadCompletedRides() {
      if (!user) return

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
        const historyItems: CompletedRide[] = await Promise.all(
          data.map(async (row) => {
            const transformed = await transformDbRide(row)
            const timeStr = row.completed_time
              ? new Date(row.completed_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Earlier'
            return {
              id: row.id,
              from: transformed.from,
              to: transformed.to,
              fare: transformed.fare,
              student: transformed.student,
              time: timeStr,
            }
          })
        )
        setCompletedRides(historyItems)
      }
    }

    loadCompletedRides()
  }, [user, phase])

  // 3. Live queue data fetching and Realtime channel
  useEffect(() => {
    if (!online) {
      setPendingQueue([])
      return
    }

    async function loadInitialQueue() {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('status', 'requested')
        .order('created_at', { ascending: false })

      if (!error && data) {
        const mapped = await Promise.all(data.map(transformDbRide))
        setPendingQueue(mapped)
      }
    }

    loadInitialQueue()

    const channel = supabase
      .channel('driver-queue-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new
            if (newRow.status === 'requested') {
              const item = await transformDbRide(newRow)
              setPendingQueue((prev) => [item, ...prev.filter((r) => r.id !== item.id)])
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new
            if (updatedRow.status !== 'requested') {
              setPendingQueue((prev) => prev.filter((r) => r.id !== updatedRow.id))
            } else {
              // Update live quote and counter status within the pending queue
              const item = await transformDbRide(updatedRow)
              setPendingQueue((prev) => prev.map((r) => (r.id === item.id ? item : r)))
            }
          } else if (payload.eventType === 'DELETE') {
            setPendingQueue((prev) => prev.filter((r) => r.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [online])

  // 4. Live ticker for wait timers
  useEffect(() => {
    if (!online || pendingQueue.length === 0) return

    const interval = setInterval(() => {
      setPendingQueue((prev) =>
        prev.map((r) => ({
          ...r,
          sec: Math.max(0, Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 1000)),
        }))
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [online, pendingQueue.length])

  // 5. Driver Quote submission for Off-Campus
  async function handleSendQuote(rideId: string) {
    const quoteVal = Number(driverQuoteInputs[rideId])
    if (!quoteVal || quoteVal <= 0) return

    await supabase
      .from('rides')
      .update({
        fare_quote: quoteVal,
        quote_status: 'quoted',
      })
      .eq('id', rideId)
  }

  // 6. Accept ride agreed via negotiation
  async function handleAcceptOffcampusAgreed(ride: QueueRide) {
    if (!user) return
    const finalFare = Number(ride.fareQuote || ride.fare)
    const { data, error } = await supabase.rpc('confirm_offcampus_ride', {
      p_ride_id: ride.id,
      p_driver_id: user.id,
      p_agreed_fare: finalFare,
    })

    if (!error && data?.success) {
      setActiveRide(ride)
      setPhase('arriving')
    } else {
      setClaimError(data?.message || error?.message || 'Failed to claim ride.')
    }
  }

  // 7. Atomic Claim Call for standard campus routes
  async function accept(ride: QueueRide) {
    if (!user) return
    setClaimError('')

    try {
      let targetDriverId = user.id
      const { data: driverProf } = await supabase
        .from('driver_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (!driverProf) {
        const { data: anyDriver } = await supabase
          .from('driver_profiles')
          .select('id')
          .limit(1)
          .maybeSingle()
        if (anyDriver) targetDriverId = anyDriver.id
      }

      const { data, error } = await supabase.rpc('claim_ride', {
        p_ride_id: ride.id,
        p_driver_id: targetDriverId,
      })

      if (error) throw error

      if (!data.success) {
        setClaimError(data.message || 'Ride already claimed by another driver.')
        return
      }

      setActiveRide(ride)
      setPhase('arriving')
    } catch (err: any) {
      console.error('Claim error:', err)
      setClaimError(err?.message || 'Failed to claim ride.')
    }
  }

  async function startRide() {
    if (!activeRide) return
    setPhase('in_progress')
    await supabase
      .from('rides')
      .update({ status: 'in_progress', pickup_time: new Date().toISOString() })
      .eq('id', activeRide.id)
  }

  async function completeRide() {
    if (!activeRide) return
    setPhase('completed')
    await supabase
      .from('rides')
      .update({ status: 'completed', completed_time: new Date().toISOString() })
      .eq('id', activeRide.id)
  }

  function resetRide() {
    setActiveRide(null)
    setPhase(null)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f7f7f7' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8 h-14 md:h-16 bg-white"
        style={{ borderBottom: '1px solid #e8e8e8' }}>
        <button onClick={() => { if (setView) setView('landing'); navigate('/'); }}>
          <img src="/src/assets/logo.png" alt="FutaRide" className="h-7 w-auto" />
        </button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold hidden sm:block"
              style={{ color: online ? '#16a34a' : '#a3a3a3' }}>
              {online ? 'Online' : 'Offline'}
            </span>
            <button onClick={() => setOnline((o) => !o)}
              className="relative w-12 h-6 rounded-full transition-colors"
              style={{ background: online ? '#E6900E' : '#d4d4d4' }}>
              <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all"
                style={{ left: online ? '28px' : '4px' }} />
            </button>
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold leading-none" style={{ color: '#1a1a1a' }}>{driverName}</p>
            <p className="text-xs mt-0.5" style={{ color: '#737373' }}>{driverUnit}</p>
          </div>
          <img
            src="https://images.unsplash.com/photo-1620831468075-db24ca183258?w=80&h=80&fit=crop&auto=format"
            alt="Driver"
            className="w-9 h-9 rounded-full object-cover"
            style={{ border: '2px solid #E6900E' }}
          />
          <button
            onClick={async () => {
              await signOut()
              if (setView) setView('landing')
              navigate('/')
            }}
            title="Sign Out"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:bg-neutral-100"
            style={{ color: '#737373', border: '1px solid #e8e8e8' }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Greeting Banner */}
      <div className="px-5 md:px-8 py-6 bg-white" style={{ borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest mb-0.5" style={{ color: '#E6900E' }}>
            {greeting}, {firstName} 👋
          </p>
          <h2 className="text-2xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#1a1a1a' }}>
            {online ? "You're live, watching for rides" : 'Go online to start earning'}
          </h2>
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 md:px-0 py-5 md:py-6">

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { v: `₦${earnings}`, l: "Today's earnings", accent: true },
            { v: completedRides.length, l: 'Rides today', accent: false },
            { v: online ? pendingQueue.length : 0, l: 'In queue', accent: false },
          ].map((s) => (
            <div key={s.l} className="bg-white rounded-2xl p-4 text-center" style={{ border: '1px solid #e8e8e8' }}>
              <p className="text-xl font-black mb-0.5"
                style={{ fontFamily: 'Outfit, sans-serif', color: s.accent ? '#E6900E' : '#1a1a1a' }}>
                {s.v}
              </p>
              <p className="text-xs" style={{ color: '#a3a3a3' }}>{s.l}</p>
            </div>
          ))}
        </div>

        {claimError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
            {claimError}
          </div>
        )}

        {/* Active Trip Banner */}
        {activeRide && phase && phase !== 'completed' && (
          <div className="mb-5 bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${phase === 'arriving' ? '#fed7aa' : '#e8e8e8'}` }}>
            <div className="px-5 py-3 flex items-center gap-2.5"
              style={{ background: phase === 'arriving' ? '#fff7ed' : '#E6900E' }}>
              <span className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: phase === 'arriving' ? '#E6900E' : '#fff' }} />
              <span className="text-xs font-mono uppercase tracking-widest"
                style={{ color: phase === 'arriving' ? '#ea580c' : '#fff' }}>
                {phase === 'arriving' ? 'Arriving at pickup' : 'Ride in progress'}
              </span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl" style={{ background: '#f7f7f7' }}>
                  <p className="text-xs mb-0.5" style={{ color: '#737373' }}>Pickup</p>
                  <p className="text-sm font-bold">{activeRide.from}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: '#f7f7f7' }}>
                  <p className="text-xs mb-0.5" style={{ color: '#737373' }}>Drop-off</p>
                  <p className="text-sm font-bold">{activeRide.to}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mb-4 p-3 rounded-xl" style={{ background: '#f7f7f7' }}>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#737373' }}>Student</p>
                  <p className="text-sm font-semibold">{activeRide.student}</p>
                  <p className="text-xs font-mono" style={{ color: '#a3a3a3' }}>{activeRide.phone}</p>
                </div>
                <p className="text-2xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>
                  ₦{activeRide.fare}
                </p>
              </div>
              {phase === 'arriving' ? (
                <button onClick={startRide}
                  className="w-full py-3.5 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: '#E6900E', color: '#fff' }}>
                  Passenger Boarded — Start Ride
                </button>
              ) : (
                <button onClick={completeRide}
                  className="w-full py-3.5 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: '#1a1a1a', color: '#fff' }}>
                  Complete Ride ✓
                </button>
              )}
            </div>
          </div>
        )}

        {/* Completed Modal / Toast */}
        {phase === 'completed' && activeRide && (
          <div className="mb-5 bg-white rounded-2xl p-6 text-center" style={{ border: '1px solid #e8e8e8' }}>
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: '#f0fdf4', border: '2px solid #bbf7d0' }}>
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="text-lg font-black mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Ride Complete!</h3>
            <p className="text-sm mb-3" style={{ color: '#737373' }}>{activeRide.from} → {activeRide.to}</p>
            <p className="text-3xl font-black mb-5" style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>
              +₦{activeRide.fare}
            </p>
            <button onClick={resetRide}
              className="px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
              style={{ background: '#E6900E', color: '#fff' }}>
              Back to Queue
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl bg-white" style={{ border: '1px solid #e8e8e8' }}>
          {(['queue', 'history'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: tab === t ? '#1a1a1a' : 'transparent', color: tab === t ? '#fff' : '#737373' }}>
              {t === 'queue' ? `Queue${online ? ` (${pendingQueue.length})` : ''}` : "Today's Rides"}
            </button>
          ))}
        </div>

        {/* Queue View */}
        {tab === 'queue' && !online && (
          <div className="bg-white rounded-2xl p-10 text-center" style={{ border: '1px solid #e8e8e8' }}>
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-xl"
              style={{ background: '#f5f5f5' }}>
              ⏻
            </div>
            <h3 className="text-base font-bold mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>You're offline</h3>
            <p className="text-sm mb-5" style={{ color: '#737373' }}>Toggle online to start receiving ride requests.</p>
            <button onClick={() => setOnline(true)}
              className="px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
              style={{ background: '#E6900E', color: '#fff' }}>
              Go Online
            </button>
          </div>
        )}

        {tab === 'queue' && online && (
          <div className="space-y-3">
            {pendingQueue.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center" style={{ border: '1px solid #e8e8e8' }}>
                <p className="text-2xl mb-2">🛺</p>
                <p className="text-sm font-bold text-neutral-800">No pending rides nearby</p>
                <p className="text-xs text-neutral-400 mt-1">New requests from students will appear here in real-time.</p>
              </div>
            ) : (
              pendingQueue.map((ride) => {
                const isOffCampus = Boolean(ride.customPickup || ride.customDropoff)

                return (
                  <div key={ride.id} className="bg-white rounded-2xl p-5" style={{ border: '1px solid #e8e8e8' }}>
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div>
                        <span className="text-xs font-mono" style={{ color: '#a3a3a3' }}>
                          ID: {ride.id.slice(0, 8)}
                        </span>
                        <p className="text-base font-bold mt-0.5">{ride.from} → {ride.to}</p>
                        <p className="text-sm mt-0.5" style={{ color: '#737373' }}>{ride.student} · {ride.dept}</p>
                        {isOffCampus && (
                          <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            Off-Campus Custom
                          </span>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>
                          {ride.fare > 0 ? `₦${ride.fare}` : ride.fareQuote ? `₦${ride.fareQuote}` : 'Quote needed'}
                        </p>
                        <div className="flex items-center gap-1 justify-end mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          <span className="text-xs font-mono" style={{ color: '#a3a3a3' }}>{ride.sec}s</span>
                        </div>
                      </div>
                    </div>

                    {/* Off-Campus Quote & Negotiation Controls */}
                    {isOffCampus ? (
                      <div className="mt-3 pt-3 border-t border-neutral-100">
                        {ride.quoteStatus === 'agreed' ? (
                          <button
                            onClick={() => handleAcceptOffcampusAgreed(ride)}
                            className="w-full py-3 rounded-xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                          >
                            Passenger Agreed to ₦{ride.fareQuote || ride.fare} — Confirm & Pick Up
                          </button>
                        ) : ride.quoteStatus === 'countered' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-700">Student countered: ₦{ride.fareQuote}</span>
                            <button
                              onClick={() => handleAcceptOffcampusAgreed(ride)}
                              className="ml-auto px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all"
                            >
                              Accept ₦{ride.fareQuote}
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Enter price quote (₦)"
                              value={driverQuoteInputs[ride.id] || ''}
                              onChange={(e) => setDriverQuoteInputs({ ...driverQuoteInputs, [ride.id]: e.target.value })}
                              className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 border border-neutral-200 focus:outline-none"
                            />
                            <button
                              onClick={() => handleSendQuote(ride.id)}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition-all"
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
                        className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-30 hover:opacity-90"
                        style={{ background: '#1a1a1a', color: '#fff' }}
                      >
                        Accept Ride
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* History View */}
        {tab === 'history' && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e8e8' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f5f5f5' }}>
              <h2 className="text-base font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Completed Rides</h2>
              <span className="text-sm font-black" style={{ color: '#E6900E' }}>₦{earnings}</span>
            </div>
            <div className="divide-y" style={{ borderColor: '#f5f5f5' }}>
              {completedRides.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400">
                  No completed rides recorded yet today.
                </div>
              ) : (
                completedRides.map((r) => (
                  <div key={r.id} className="px-5 py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: '#fff7ed' }}>🛺</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{r.from} → {r.to}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#a3a3a3' }}>{r.time} · {r.student}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-bold text-sm" style={{ color: '#E6900E' }}>+₦{r.fare}</span>
                      <span className="text-xs px-2 py-1 rounded-lg" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                        Done
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}