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
  sec: number
}

const DONE_TODAY = [
  { id: 'R-2838', from: 'FUTA North Gate', to: 'Obakekere Junction', fare: 500, student: 'Tunde M.', time: '10:22 AM' },
  { id: 'R-2835', from: 'FUTA South Gate', to: 'Obanla Campus Center', fare: 500, student: 'Amaka E.', time: '8:47 AM' },
  { id: 'R-2831', from: 'Obakekere Junction', to: 'FUTA North Gate', fare: 700, student: 'Ibrahim L.', time: '7:15 AM' },
]

type Phase = 'arriving' | 'in_progress' | 'completed' | null
interface Props { setView?: (v: View) => void }

export default function DriverDashboard({ setView }: Props) {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  const driverName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Driver'
  const firstName = driverName.split(' ')[0]
  const driverPlate = profile?.vehicle_plate_number || user?.user_metadata?.vehicle_plate_number || 'Keke Unit'
  const driverUnit = profile?.role ? `${driverPlate} · ${profile.role}` : `North Gate Unit · ${driverPlate}`

  const [online, setOnline] = useState(false)
  const [pendingQueue, setPendingQueue] = useState<QueueRide[]>([])
  const [activeRide, setActiveRide] = useState<QueueRide | null>(null)
  const [phase, setPhase] = useState<Phase>(null)
  const [tab, setTab] = useState<'queue' | 'history'>('queue')
  const [claimError, setClaimError] = useState<string>('')

  const earnings = DONE_TODAY.reduce((s, r) => s + r.fare, 0)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Helper to map DB ride records to UI queue items
  async function transformDbRide(rideRow: any): Promise<QueueRide> {
    let fromName = 'Campus Hub'
    let toName = 'Destination Hub'

    if (rideRow.route_id) {
      const { data: route } = await supabase
        .from('routes')
        .select('pickup:locations!pickup_location_id(name), dropoff:locations!dropoff_location_id(name)')
        .eq('id', rideRow.route_id)
        .maybeSingle()

      if (route) {
        fromName = (route.pickup as any)?.name || fromName
        toName = (route.dropoff as any)?.name || toName
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
      fare: Number(rideRow.fare) || 500,
      student: studentName,
      dept,
      phone,
      sec: elapsedSeconds,
    }
  }

  // 1. Initial Load and Realtime Queue Subscription
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

    // Realtime channel for rides
    const channel = supabase
      .channel('driver-rides-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new
            if (newRow.status === 'requested') {
              const item = await transformDbRide(newRow)
              setPendingQueue(prev => [item, ...prev.filter(r => r.id !== item.id)])
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new
            // If ride was claimed or cancelled, take it off the pending list
            if (updatedRow.status !== 'requested') {
              setPendingQueue(prev => prev.filter(r => r.id !== updatedRow.id))
            }
          } else if (payload.eventType === 'DELETE') {
            setPendingQueue(prev => prev.filter(r => r.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [online])

  // 2. Claim ride atomically (FR-48 integration)
  async function accept(ride: QueueRide) {
    if (!user) return
    setClaimError('')

    try {
      // Find driver ID in driver_profiles or use user.id
      let targetDriverId = user.id
      const { data: driverProf } = await supabase
        .from('driver_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      // Fallback if driver account uses custom profile ID
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

  // 3. Advance ride status to in_progress (arrived/picked up)
  async function startRide() {
    if (!activeRide) return
    setPhase('in_progress')
    await supabase
      .from('rides')
      .update({ status: 'in_progress', pickup_time: new Date().toISOString() })
      .eq('id', activeRide.id)
  }

  // 4. Complete ride
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

      {/* ── Header ──────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8 h-14 md:h-16 bg-white"
        style={{ borderBottom: '1px solid #e8e8e8' }}>
        <button onClick={() => { if (setView) setView('landing'); navigate('/'); }}>
          <img src="/src/assets/logo.png" alt="FutaRide" className="h-7 w-auto" />
        </button>
        <div className="flex items-center gap-4">
          {/* Online toggle */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold hidden sm:block"
              style={{ color: online ? '#16a34a' : '#a3a3a3' }}>
              {online ? 'Online' : 'Offline'}
            </span>
            <button onClick={() => setOnline(o => !o)}
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

      {/* ── Greeting ────────────────────────── */}
      <div className="px-5 md:px-8 py-6 bg-white" style={{ borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest mb-0.5" style={{ color: '#E6900E' }}>
            {greeting}, {firstName} 👋
          </p>
          <h2 className="text-2xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#1a1a1a' }}>
            {online ? "You're live — watching for rides" : 'Go online to start earning'}
          </h2>
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 md:px-0 py-5 md:py-6">

        {/* ── Stats ───────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { v: `₦${earnings}`, l: "Today's earnings", accent: true },
            { v: DONE_TODAY.length, l: 'Rides today', accent: false },
            { v: online ? pendingQueue.length : 0, l: 'In queue', accent: false },
          ].map(s => (
            <div key={s.l} className="bg-white rounded-2xl p-4 text-center" style={{ border: '1px solid #e8e8e8' }}>
              <p className="text-xl font-black mb-0.5"
                style={{ fontFamily: 'Outfit, sans-serif', color: s.accent ? '#E6900E' : '#1a1a1a' }}>
                {s.v}
              </p>
              <p className="text-xs" style={{ color: '#a3a3a3' }}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Claim error message */}
        {claimError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
            {claimError}
          </div>
        )}

        {/* ── Active ride ─────────────────────── */}
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

        {/* Completed toast */}
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

        {/* ── Tabs ────────────────────────────── */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl bg-white" style={{ border: '1px solid #e8e8e8' }}>
          {(['queue', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: tab === t ? '#1a1a1a' : 'transparent', color: tab === t ? '#fff' : '#737373' }}>
              {t === 'queue' ? `Queue${online ? ` (${pendingQueue.length})` : ''}` : "Today's Rides"}
            </button>
          ))}
        </div>

        {/* ── Queue ───────────────────────────── */}
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
              pendingQueue.map(ride => (
                <div key={ride.id} className="bg-white rounded-2xl p-5" style={{ border: '1px solid #e8e8e8' }}>
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div>
                      <span className="text-xs font-mono" style={{ color: '#a3a3a3' }}>
                        ID: {ride.id.slice(0, 8)}
                      </span>
                      <p className="text-base font-bold mt-0.5">{ride.from} → {ride.to}</p>
                      <p className="text-sm mt-0.5" style={{ color: '#737373' }}>{ride.student} · {ride.dept}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>
                        ₦{ride.fare}
                      </p>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        <span className="text-xs font-mono" style={{ color: '#a3a3a3' }}>{ride.sec}s</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => accept(ride)}
                    disabled={!!activeRide && phase !== 'completed'}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-30 hover:opacity-90"
                    style={{ background: '#1a1a1a', color: '#fff' }}>
                    Accept Ride
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── History ─────────────────────────── */}
        {tab === 'history' && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e8e8' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f5f5f5' }}>
              <h2 className="text-base font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Completed Rides</h2>
              <span className="text-sm font-black" style={{ color: '#E6900E' }}>₦{earnings}</span>
            </div>
            <div className="divide-y" style={{ borderColor: '#f5f5f5' }}>
              {DONE_TODAY.map(r => (
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}