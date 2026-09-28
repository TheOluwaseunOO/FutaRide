import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { type View } from '../App'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

interface LocationHub {
  id: string
  name: string
}

const FALLBACK_HUBS: LocationHub[] = [
  { id: '1', name: 'FUTA North Gate' },
  { id: '2', name: 'FUTA South Gate' },
  { id: '3', name: 'Obanla Campus Center' },
  { id: '4', name: 'School of Engineering (SEET)' },
  { id: '5', name: 'Obakekere Junction' },
  { id: '6', name: 'Aule Junction Hub' },
  { id: '7', name: 'FUTA Junction (Ilesha Rd)' },
  { id: '8', name: 'South Gate / Titilayo' },
]

const FALLBACK_FARES: Record<string, number> = {
  'FUTA North Gate→FUTA South Gate': 500,
  'FUTA North Gate→Obanla Campus Center': 500,
  'FUTA North Gate→School of Engineering (SEET)': 500,
  'FUTA North Gate→Obakekere Junction': 700,
  'FUTA North Gate→Aule Junction Hub': 900,
  'FUTA North Gate→FUTA Junction (Ilesha Rd)': 700,
  'FUTA North Gate→South Gate / Titilayo': 600,
  'FUTA South Gate→FUTA North Gate': 500,
  'FUTA South Gate→Obanla Campus Center': 500,
  'FUTA South Gate→School of Engineering (SEET)': 500,
  'FUTA South Gate→Obakekere Junction': 600,
  'FUTA South Gate→Aule Junction Hub': 800,
  'FUTA South Gate→FUTA Junction (Ilesha Rd)': 700,
  'FUTA South Gate→South Gate / Titilayo': 500,
  'Obakekere Junction→FUTA North Gate': 700,
  'Obakekere Junction→FUTA South Gate': 600,
  'Obakekere Junction→Obanla Campus Center': 700,
  'Obakekere Junction→South Gate / Titilayo': 600,
  'Aule Junction Hub→FUTA North Gate': 900,
  'Aule Junction Hub→FUTA South Gate': 800,
  'Aule Junction Hub→Obakekere Junction': 700,
  'Obanla Campus Center→FUTA North Gate': 500,
  'Obanla Campus Center→FUTA South Gate': 500,
  'School of Engineering (SEET)→FUTA North Gate': 500,
  'School of Engineering (SEET)→FUTA South Gate': 500,
}

const HISTORY = [
  { from: 'FUTA South Gate', to: 'Obakekere Junction', fare: 600, status: 'COMPLETED', date: 'Today, 8:14 AM', driver: 'Adewale K.' },
  { from: 'FUTA North Gate', to: 'Obanla Campus Center', fare: 500, status: 'COMPLETED', date: 'Yesterday, 5:42 PM', driver: 'Kunle B.' },
  { from: 'FUTA South Gate', to: 'Aule Junction Hub', fare: 800, status: 'CANCELLED', date: 'Mon, 7:30 PM', driver: '—' },
  { from: 'Obakekere Junction', to: 'FUTA North Gate', fare: 700, status: 'EXPIRED', date: 'Sun, 6:15 PM', driver: '—' },
]

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  COMPLETED: { bg: '#f0fdf4', color: '#16a34a' },
  CANCELLED: { bg: '#fef2f2', color: '#dc2626' },
  EXPIRED:   { bg: '#f5f5f5', color: '#737373' },
}

type Phase = 'idle' | 'searching' | 'accepted' | 'arriving' | 'completed'

interface Props { setView?: (v: View) => void }

export default function StudentDashboard({ setView }: Props) {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student'
  const firstName = displayName.split(' ')[0]
  const matricOrSub = profile?.matric_number || (user?.id ? `ID: ${user.id.slice(0, 8)}...` : 'FUTA Student')

  // Live DB State
  const [hubs, setHubs] = useState<LocationHub[]>(FALLBACK_HUBS)
  const [loadingHubs, setLoadingHubs] = useState(true)

  // Hub & Destination Selection
  const [pickupHub, setPickupHub] = useState<LocationHub | null>(null)
  const [dropoffHub, setDropoffHub] = useState<LocationHub | null>(null)
  const [isOthers, setIsOthers] = useState(false)
  const [customDest, setCustomDest] = useState('')
  const [dynamicFare, setDynamicFare] = useState<number | null>(null)
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)

  // Request & Lifecycle state
  const [activeRideId, setActiveRideId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [tab, setTab] = useState<'book' | 'history'>('book')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // 1. Fetch active hubs from Supabase on mount
  useEffect(() => {
    async function loadHubs() {
      try {
        setLoadingHubs(true)
        const { data, error } = await supabase
          .from('locations')
          .select('id, name')
          .order('name', { ascending: true })

        if (error) throw error
        if (data && data.length > 0) {
          setHubs(data)
        }
      } catch (err) {
        console.warn('Using fallback hubs. Supabase query notice:', err)
      } finally {
        setLoadingHubs(false)
      }
    }

    loadHubs()
  }, [])

  // 2. Resolve Route and Fare whenever selections change
  useEffect(() => {
    if (!pickupHub || (!dropoffHub && !isOthers)) {
      setDynamicFare(null)
      setActiveRouteId(null)
      return
    }

    async function resolveRoute() {
      try {
        const targetDropoffId = dropoffHub?.id
        if (!targetDropoffId) return

        const { data, error } = await supabase
          .from('routes')
          .select('id, base_fare')
          .eq('pickup_location_id', pickupHub!.id)
          .eq('dropoff_location_id', targetDropoffId)
          .maybeSingle()

        if (!error && data) {
          setActiveRouteId(data.id)
          setDynamicFare(Number(data.base_fare))
          return
        }

        // Fallback fare lookup
        const fallbackKey = `${pickupHub!.name}→${dropoffHub!.name}`
        const reverseKey = `${dropoffHub!.name}→${pickupHub!.name}`
        const resolvedFallback = FALLBACK_FARES[fallbackKey] || FALLBACK_FARES[reverseKey] || 500
        setDynamicFare(isOthers ? 0 : resolvedFallback)
      } catch {
        const fallbackKey = `${pickupHub!.name}→${dropoffHub?.name}`
        setDynamicFare(isOthers ? 0 : FALLBACK_FARES[fallbackKey] || 500)
      }
    }

    resolveRoute()
  }, [pickupHub, dropoffHub, isOthers])

  const canRequest = pickupHub && (isOthers ? customDest.trim().length > 0 : dropoffHub)
  const displayPickup = pickupHub?.name || ''
  const displayDest = isOthers ? (customDest.trim() || 'Others') : (dropoffHub?.name || '')

  async function handleRequest() {
    if (!canRequest || !user) return
    setIsSubmitting(true)
    setRequestError('')

    try {
      let routeId = activeRouteId

      // If route ID hasn't resolved yet, query directly
      if (!routeId && dropoffHub) {
        const { data: routeData } = await supabase
          .from('routes')
          .select('id, base_fare')
          .eq('pickup_location_id', pickupHub!.id)
          .eq('dropoff_location_id', dropoffHub.id)
          .maybeSingle()

        if (routeData) {
          routeId = routeData.id
        }
      }

      if (!routeId) {
        throw new Error('Please select valid origin and drop-off hubs.')
      }

      const finalFare = isOthers ? 0 : (dynamicFare ?? 500)

      // Insert directly into Supabase rides table
      const { data: rideData, error: rideErr } = await supabase
        .from('rides')
        .insert({
          student_id: user.id,
          route_id: routeId,
          fare: finalFare,
          status: 'requested',
        })
        .select('id')
        .single()

      if (rideErr) throw rideErr

      setActiveRideId(rideData.id)
      setPhase('searching')

      
    } catch (err: any) {
      console.error('Ride request error:', err)
      setRequestError(err?.message || 'Failed to request ride. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCancelRequest() {
    if (activeRideId) {
      await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('id', activeRideId)
    }
    setPhase('idle')
    setActiveRideId(null)
  }

     // Realtime subscription for the active ride
  useEffect(() => {
    if (!activeRideId) return

    const channel = supabase
      .channel(`ride-status-${activeRideId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${activeRideId}`,
        },
        (payload) => {
          const updatedRide = payload.new as { status: string }
          if (updatedRide.status === 'accepted') {
            setPhase('accepted')
          } else if (updatedRide.status === 'arriving' || updatedRide.status === 'in_progress') {
            setPhase('arriving')
          } else if (updatedRide.status === 'completed') {
            setPhase('completed')
          } else if (updatedRide.status === 'cancelled') {
            setPhase('idle')
            setActiveRideId(null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeRideId])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f7f7f7' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-8 h-16 bg-white"
        style={{ borderBottom: '1px solid #e8e8e8' }}>
        <button onClick={() => { if (setView) setView('landing'); navigate('/'); }}>
          <img src="/src/assets/logo.png" alt="FutaRide" className="h-7 w-auto" />
        </button>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold leading-none" style={{ color: '#1a1a1a' }}>{displayName}</p>
            <p className="text-xs mt-0.5" style={{ color: '#737373' }}>{matricOrSub}</p>
          </div>
          <img
            src="https://images.unsplash.com/photo-1694175271713-a6e2cc378980?w=80&h=80&fit=crop&auto=format"
            alt="Student"
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

      {/* Greeting banner */}
      <div className="px-5 md:px-8 py-6 bg-white" style={{ borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-mono uppercase tracking-widest mb-0.5" style={{ color: '#E6900E' }}>
              {greeting}, {firstName} 👋
            </p>
            <h2 className="text-2xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#1a1a1a' }}>
              Where are you going?
            </h2>
          </div>
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-xs" style={{ color: '#737373' }}>Total rides</p>
            <p className="text-2xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>4</p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-5 md:px-0 py-6">

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl bg-white" style={{ border: '1px solid #e8e8e8' }}>
          {(['book', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: tab === t ? '#1a1a1a' : 'transparent', color: tab === t ? '#fff' : '#737373' }}>
              {t === 'book' ? 'Book a Ride' : 'My History'}
            </button>
          ))}
        </div>

        {/* Book tab */}
        {tab === 'book' && (
          <>
            {phase === 'idle' && (
              <div className="rounded-2xl overflow-hidden bg-white" style={{ border: '1px solid #e8e8e8' }}>

                {/* Pickup Hub Selection */}
                <div className="p-5 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0"
                      style={{ background: pickupHub ? '#E6900E' : '#f0f0f0', color: pickupHub ? '#fff' : '#999' }}>1</span>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#737373' }}>Pickup hub</p>
                    {pickupHub && <span className="ml-auto text-xs font-semibold truncate max-w-[140px]" style={{ color: '#E6900E' }}>{pickupHub.name}</span>}
                  </div>
                  {loadingHubs ? (
                    <p className="text-xs text-neutral-400 py-2">Loading hubs...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {hubs.map(h => (
                        <button key={h.id} onClick={() => setPickupHub(h)}
                          className="px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all leading-snug"
                          style={{
                            background: pickupHub?.id === h.id ? '#E6900E' : '#f7f7f7',
                            color: pickupHub?.id === h.id ? '#fff' : '#1a1a1a',
                            border: `1px solid ${pickupHub?.id === h.id ? '#E6900E' : 'transparent'}`,
                          }}>
                          {h.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Route Line Indicator */}
                <div className="flex items-center gap-3 px-5 py-2" style={{ borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#E6900E' }} />
                    <div className="w-px h-4" style={{ background: '#d4d4d4' }} />
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: pickupHub ? '#1a1a1a' : '#d4d4d4' }} />
                  </div>
                  <div className="flex-1 flex items-center justify-between text-xs min-w-0">
                    <span className="truncate" style={{ color: pickupHub ? '#1a1a1a' : '#a3a3a3' }}>{displayPickup || 'Select pickup'}</span>
                    <span className="px-2" style={{ color: '#d4d4d4' }}>→</span>
                    <span className="truncate text-right" style={{ color: displayDest ? '#1a1a1a' : '#a3a3a3' }}>
                      {displayDest || 'Select drop-off'}
                    </span>
                  </div>
                </div>

                {/* Drop-off Hub Selection */}
                <div className="p-5 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0"
                      style={{ background: dropoffHub || isOthers ? '#1a1a1a' : '#f0f0f0', color: dropoffHub || isOthers ? '#fff' : '#999' }}>2</span>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#737373' }}>Drop-off</p>
                    {displayDest && <span className="ml-auto text-xs font-semibold truncate max-w-[140px]" style={{ color: '#1a1a1a' }}>{displayDest}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {hubs
                      .filter(h => h.id !== pickupHub?.id)
                      .map(h => {
                        const isOthersHub = h.name.toLowerCase().includes('others')
                        const isSelected = isOthersHub ? isOthers : dropoffHub?.id === h.id

                        return (
                          <button
                            key={h.id}
                            onClick={() => {
                              if (isOthersHub) {
                                setIsOthers(true)
                                setDropoffHub(h)
                              } else {
                                setIsOthers(false)
                                setDropoffHub(h)
                                setCustomDest('')
                              }
                            }}
                            className={`px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all leading-snug ${
                              isOthersHub ? 'col-span-2' : ''
                            }`}
                            style={{
                              background: isSelected ? '#1a1a1a' : isOthersHub ? 'transparent' : '#f7f7f7',
                              color: isSelected ? '#fff' : isOthersHub ? '#737373' : '#1a1a1a',
                              border: isOthersHub
                                ? `1px dashed ${isSelected ? '#1a1a1a' : '#d4d4d4'}`
                                : `1px solid ${isSelected ? '#1a1a1a' : 'transparent'}`,
                            }}
                          >
                            {h.name}
                            {isOthersHub && !isSelected && ' — driver sets price on acceptance'}
                          </button>
                        )
                      })}
                  </div>

                  {isOthers && (
                    <input
                      type="text"
                      value={customDest}
                      onChange={e => setCustomDest(e.target.value)}
                      placeholder="Enter destination (e.g. Akure Town Centre)"
                      autoFocus
                      className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none mb-1"
                      style={{ background: '#f7f7f7', border: '1px solid #e8e8e8', color: '#1a1a1a' }}
                    />
                  )}
                </div>

                {/* Fare Summary & Request CTA */}
                {pickupHub && (dropoffHub || isOthers) && (
                  <div className="px-5 pb-5">
                    {isOthers ? (
                      <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-3"
                        style={{ background: '#f7f7f7', border: '1px solid #e8e8e8' }}>
                        <div className="flex-1">
                          <p className="text-xs font-semibold" style={{ color: '#1a1a1a' }}>Driver sets the price</p>
                          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#737373' }}>
                            The driver will quote a fare when they accept your request. Agree before boarding.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-3"
                        style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: '#ea580c' }}>Locked fare</p>
                          <p className="text-xs mt-0.5" style={{ color: '#737373' }}>Cash on arrival · no hidden charges</p>
                        </div>
                        <span className="text-2xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>
                          ₦{dynamicFare ?? 500}
                        </span>
                      </div>
                    )}

                    {requestError && (
                      <p className="text-xs mb-3 font-semibold" style={{ color: '#dc2626' }}>
                        {requestError}
                      </p>
                    )}

                    <button
                      onClick={handleRequest}
                      disabled={!canRequest || isSubmitting}
                      className="w-full py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-30 hover:opacity-90"
                      style={{ background: '#E6900E', color: '#fff' }}
                    >
                      {isSubmitting ? 'Requesting Ride...' : 'Request Ride'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SEARCHING */}
            {phase === 'searching' && (
              <div className="bg-white rounded-2xl p-8 text-center" style={{ border: '1px solid #e8e8e8' }}>
                <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
                  style={{ background: '#fff7ed', border: '2px solid #fed7aa' }}>
                  <span className="text-3xl" style={{ animation: 'spin 2s linear infinite', display: 'inline-block' }}>🛺</span>
                </div>
                <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: '#E6900E' }}>Finding your driver</p>
                <h2 className="text-xl font-black mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Matching you now…</h2>
                <p className="text-sm mb-2" style={{ color: '#737373' }}>{displayPickup} → {displayDest}</p>
                {dynamicFare != null && !isOthers
                  ? <p className="text-3xl font-black mb-1" style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>₦{dynamicFare}</p>
                  : <p className="text-base font-bold mb-1" style={{ color: '#1a1a1a' }}>Driver quotes price</p>
                }
                <p className="text-xs mb-6" style={{ color: '#a3a3a3' }}>
                  {dynamicFare != null && !isOthers ? 'Fare locked · expires in 3 min if no driver accepts' : 'Agree fare with driver before boarding'}
                </p>
                <div className="w-full h-1 rounded-full mb-6" style={{ background: '#f5f5f5' }}>
                  <div className="h-1 rounded-full" style={{ background: '#E6900E', width: '45%', animation: 'pulse 1.5s infinite' }} />
                </div>
                <button
                  onClick={handleCancelRequest}
                  className="text-sm font-semibold px-5 py-2.5 rounded-xl border"
                  style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                >
                  Cancel Request
                </button>
              </div>
            )}

            {/* ACCEPTED */}
            {phase === 'accepted' && (
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e8e8' }}>
                <div className="px-5 py-3 flex items-center gap-2.5" style={{ background: '#E6900E' }}>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-mono uppercase tracking-widest text-white">Driver accepted — heading to you</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-4 mb-5 p-4 rounded-xl" style={{ background: '#f7f7f7' }}>
                    <img
                      src="https://images.unsplash.com/photo-1620829813573-7c9e1877706f?w=80&h=80&fit=crop&auto=format"
                      alt="Driver"
                      className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                      style={{ border: '2px solid #E6900E' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold" style={{ color: '#1a1a1a' }}>Adewale Kayode</p>
                      <p className="text-sm" style={{ color: '#737373' }}>North Gate Park Unit</p>
                      <p className="text-sm font-mono font-bold mt-0.5" style={{ color: '#E6900E' }}>🛺 AKR-442-KE</p>
                    </div>
                    <a href="tel:08034567890"
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                      style={{ background: '#1a1a1a', color: '#fff' }}>
                      📞
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-xl" style={{ background: '#f7f7f7' }}>
                      <p className="text-xs mb-0.5" style={{ color: '#737373' }}>Pickup</p>
                      <p className="text-sm font-semibold">{displayPickup}</p>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: '#f7f7f7' }}>
                      <p className="text-xs mb-0.5" style={{ color: '#737373' }}>Drop-off</p>
                      <p className="text-sm font-semibold">{displayDest}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl"
                    style={{ background: dynamicFare != null ? '#fff7ed' : '#f7f7f7', border: `1px solid ${dynamicFare != null ? '#fed7aa' : '#e8e8e8'}` }}>
                    <p className="text-sm" style={{ color: '#737373' }}>{dynamicFare != null ? 'Locked fare · Pay cash' : 'Agree price with driver'}</p>
                    {dynamicFare != null
                      ? <p className="text-xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>₦{dynamicFare}</p>
                      : <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>TBD</p>
                    }
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setPhase('completed')}
                      className="flex-1 py-3 rounded-xl font-bold text-sm hover:opacity-90"
                      style={{ background: '#1a1a1a', color: '#fff' }}>
                      Mark Completed
                    </button>
                    <button onClick={() => setPhase('idle')}
                      className="px-4 py-3 rounded-xl font-semibold text-sm border"
                      style={{ borderColor: '#e8e8e8', color: '#737373' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ARRIVING */}
            {phase === 'arriving' && (
              <div className="bg-white rounded-2xl p-8 text-center" style={{ border: '1px solid #fed7aa' }}>
                <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center text-3xl"
                  style={{ background: '#fff7ed' }}>
                  🛺
                </div>
                <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: '#E6900E' }}>Driver arriving</p>
                <h2 className="text-xl font-black mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Adewale is on the way</h2>
                <p className="text-sm mb-5" style={{ color: '#737373' }}>Head to {displayPickup}. Your driver will take you to {displayDest}.</p>
                {dynamicFare != null
                  ? <p className="text-4xl font-black mb-1" style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>₦{dynamicFare}</p>
                  : <p className="text-lg font-bold mb-1" style={{ color: '#1a1a1a' }}>Fare agreed with driver</p>
                }
                <p className="text-xs" style={{ color: '#a3a3a3' }}>Pay on arrival · AKR-442-KE</p>
              </div>
            )}

            {/* COMPLETED */}
            {phase === 'completed' && (
              <div className="bg-white rounded-2xl p-8 text-center" style={{ border: '1px solid #e8e8e8' }}>
                <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
                  style={{ background: '#f0fdf4', border: '2px solid #bbf7d0' }}>
                  <span className="text-2xl">✓</span>
                </div>
                <h2 className="text-2xl font-black mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Ride Complete</h2>
                <p className="text-sm mb-1" style={{ color: '#737373' }}>{displayPickup} → {displayDest}</p>
                {dynamicFare != null
                  ? <p className="text-4xl font-black my-5" style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>₦{dynamicFare}</p>
                  : <p className="text-base font-bold my-5" style={{ color: '#737373' }}>Fare agreed with driver</p>
                }
                <p className="text-sm mb-7" style={{ color: '#a3a3a3' }}>Logged to your trip history.</p>
                <button
                  onClick={() => {
                    setPhase('idle')
                    setPickupHub(null)
                    setDropoffHub(null)
                    setIsOthers(false)
                    setCustomDest('')
                    setActiveRideId(null)
                  }}
                  className="px-6 py-3 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: '#E6900E', color: '#fff' }}
                >
                  Book Another Ride
                </button>
              </div>
            )}
          </>
        )}

        {/* History tab */}
        {tab === 'history' && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e8e8' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #f5f5f5' }}>
              <h2 className="text-base font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Trip History</h2>
            </div>
            <div className="divide-y" style={{ borderColor: '#f5f5f5' }}>
              {HISTORY.map((r, i) => (
                <div key={i} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
                      style={{ background: '#fff7ed' }}>
                      🛺
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{r.from} → {r.to}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#a3a3a3' }}>{r.date} · {r.driver}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-bold">₦{r.fare}</span>
                    <span className="text-xs px-2 py-1 rounded-lg font-mono"
                      style={{ background: STATUS_STYLE[r.status].bg, color: STATUS_STYLE[r.status].color }}>
                      {r.status}
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