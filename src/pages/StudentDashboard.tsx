import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { type View } from '../App'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

interface LocationHub {
  id: string
  name: string
}

interface AssignedDriver {
  name: string
  plate: string
  phone: string
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
  { id: 'offcampus', name: 'Others (Off-Campus)' },
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

type Phase = 'idle' | 'searching' | 'accepted' | 'arriving' | 'completed'
interface Props { setView?: (v: View) => void }

export default function StudentDashboard({ setView }: Props) {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student'
  const firstName = displayName.split(' ')[0]
  const matricOrSub = profile?.matric_number || (user?.id ? `ID: ${user.id.slice(0, 8)}...` : 'FUTA Student')

  const [hubs, setHubs] = useState<LocationHub[]>(FALLBACK_HUBS)
  const [loadingHubs, setLoadingHubs] = useState(true)

  // Pickup selection
  const [pickupHub, setPickupHub] = useState<LocationHub | null>(null)
  const [isPickupOthers, setIsPickupOthers] = useState(false)
  const [customPickupText, setCustomPickupText] = useState('')

  // Dropoff selection
  const [dropoffHub, setDropoffHub] = useState<LocationHub | null>(null)
  const [isDropoffOthers, setIsDropoffOthers] = useState(false)
  const [customDropoffText, setCustomDropoffText] = useState('')

  const [dynamicFare, setDynamicFare] = useState<number | null>(null)
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)

  // Active Ride & Live Negotiation State
  const [activeRideId, setActiveRideId] = useState<string | null>(null)
  const [assignedDriver, setAssignedDriver] = useState<AssignedDriver | null>(null)
  const [requestError, setRequestError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [tab, setTab] = useState<'book' | 'history'>('book')

  // Negotiation states
  const [driverQuote, setDriverQuote] = useState<number | null>(null)
  const [quoteStatus, setQuoteStatus] = useState<string>('none')
  const [counterPriceInput, setCounterPriceInput] = useState<string>('')
  const [showCounterBox, setShowCounterBox] = useState<boolean>(false)

  const isOffCampusTrip = isPickupOthers || isDropoffOthers

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Helper to fetch driver profile by driver_id across tables
  async function fetchDriverInfo(driverId: string) {
    if (!driverId) return

    try {
      // 1. Fetch from driver_profiles
      const { data: d1 } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('id', driverId)
        .maybeSingle()

      // 2. Fetch from profiles
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', driverId)
        .maybeSingle()

      const resolvedName =
        d1?.full_name ||
        p?.full_name ||
        d1?.name ||
        p?.name ||
        (p?.first_name ? `${p.first_name} ${p?.last_name || ''}`.trim() : null) ||
        'Emma John'

      const resolvedPlate =
        d1?.vehicle_plate_number ||
        p?.vehicle_plate_number ||
        d1?.plate_number ||
        p?.plate_number ||
        'ABC - 123 - D5'

      const resolvedPhone = d1?.phone_number || p?.phone_number || ''

      setAssignedDriver({
        name: resolvedName,
        plate: resolvedPlate,
        phone: resolvedPhone,
      })
    } catch (err) {
      console.error('Error fetching driver details:', err)
      setAssignedDriver({
        name: 'Emma John',
        plate: 'ABC - 123 - D5',
        phone: '',
      })
    }
  }

  // 1. Restore active student ride on refresh
  useEffect(() => {
    async function restoreStudentRide() {
      if (!user) return

      try {
        const { data: ongoing } = await supabase
          .from('rides')
          .select('*')
          .eq('student_id', user.id)
          .in('status', ['requested', 'accepted', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (ongoing) {
          setActiveRideId(ongoing.id)
          setDynamicFare(Number(ongoing.fare))
          if (ongoing.custom_pickup) {
            setIsPickupOthers(true)
            setCustomPickupText(ongoing.custom_pickup)
          }
          if (ongoing.custom_dropoff) {
            setIsDropoffOthers(true)
            setCustomDropoffText(ongoing.custom_dropoff)
          }
          if (ongoing.fare_quote) setDriverQuote(Number(ongoing.fare_quote))
          if (ongoing.quote_status) setQuoteStatus(ongoing.quote_status)

          if (ongoing.status === 'requested') {
            setPhase('searching')
          } else if (ongoing.status === 'accepted') {
            setPhase('accepted')
            if (ongoing.driver_id) fetchDriverInfo(ongoing.driver_id)
          } else if (ongoing.status === 'in_progress') {
            setPhase('arriving')
            if (ongoing.driver_id) fetchDriverInfo(ongoing.driver_id)
          }
        }
      } catch (err) {
        console.error('Error restoring student session:', err)
      }
    }

    restoreStudentRide()
  }, [user])

  // 2. Fetch hubs on mount
  useEffect(() => {
    async function loadHubs() {
      try {
        setLoadingHubs(true)
        const { data, error } = await supabase
          .from('locations')
          .select('id, name')
          .order('name', { ascending: true })

        if (!error && data && data.length > 0) {
          const hasOthers = data.some(h => h.name.toLowerCase().includes('others'))
          if (!hasOthers) {
            setHubs([...data, { id: 'offcampus', name: 'Others (Off-Campus)' }])
          } else {
            setHubs(data)
          }
        }
      } catch (err) {
        console.warn('Fallback hubs notice:', err)
      } finally {
        setLoadingHubs(false)
      }
    }
    loadHubs()
  }, [])

  // 3. Resolve Route & Standard Campus Fare
  useEffect(() => {
    if (!pickupHub || !dropoffHub) {
      setDynamicFare(null)
      setActiveRouteId(null)
      return
    }

    if (isOffCampusTrip) {
      setDynamicFare(0)
      return
    }

    async function resolveRoute() {
      try {
        const { data } = await supabase
          .from('routes')
          .select('id, base_fare')
          .eq('pickup_location_id', pickupHub!.id)
          .eq('dropoff_location_id', dropoffHub!.id)
          .maybeSingle()

        if (data) {
          setActiveRouteId(data.id)
          setDynamicFare(Number(data.base_fare))
          return
        }

        const fallbackKey = `${pickupHub!.name}→${dropoffHub!.name}`
        const reverseKey = `${dropoffHub!.name}→${pickupHub!.name}`
        setDynamicFare(FALLBACK_FARES[fallbackKey] || FALLBACK_FARES[reverseKey] || 500)
      } catch {
        setDynamicFare(500)
      }
    }
    resolveRoute()
  }, [pickupHub, dropoffHub, isPickupOthers, isDropoffOthers])

  const canRequest =
    (isPickupOthers ? customPickupText.trim().length > 0 : !!pickupHub) &&
    (isDropoffOthers ? customDropoffText.trim().length > 0 : !!dropoffHub)

  const displayPickup = isPickupOthers ? customPickupText.trim() : pickupHub?.name || ''
  const displayDest = isDropoffOthers ? customDropoffText.trim() : dropoffHub?.name || ''

  // 4. Realtime subscription for active ride updates & negotiations
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
        async (payload) => {
          const row = payload.new as any

          if (row.fare_quote) {
            setDriverQuote(Number(row.fare_quote))
          }
          if (row.quote_status) {
            setQuoteStatus(row.quote_status)
          }

          if (row.status === 'accepted') {
            setDynamicFare(Number(row.fare))
            setPhase('accepted')

            const targetDriverId = row.driver_id
            if (targetDriverId) {
              await fetchDriverInfo(targetDriverId)
            } else {
              const { data: fresh } = await supabase
                .from('rides')
                .select('driver_id')
                .eq('id', activeRideId)
                .single()
              if (fresh?.driver_id) await fetchDriverInfo(fresh.driver_id)
            }
          } else if (row.status === 'in_progress') {
            setPhase('arriving')
            const targetDriverId = row.driver_id
            if (targetDriverId) {
              await fetchDriverInfo(targetDriverId)
            } else {
              const { data: fresh } = await supabase
                .from('rides')
                .select('driver_id')
                .eq('id', activeRideId)
                .single()
              if (fresh?.driver_id) await fetchDriverInfo(fresh.driver_id)
            }
          } else if (row.status === 'completed') {
            setPhase('completed')
          } else if (row.status === 'cancelled') {
            setPhase('idle')
            setActiveRideId(null)
            setAssignedDriver(null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeRideId])

  async function handleRequest() {
    if (!canRequest || !user) return
    setIsSubmitting(true)
    setRequestError('')

    try {
      let routeId = activeRouteId

      if (!routeId) {
        const { data: routeData } = await supabase.from('routes').select('id').limit(1).maybeSingle()
        routeId = routeData?.id || null
      }

      const initialFare = isOffCampusTrip ? 0 : (dynamicFare ?? 500)

      const { data: rideData, error: rideErr } = await supabase
        .from('rides')
        .insert({
          student_id: user.id,
          route_id: routeId,
          fare: initialFare,
          status: 'requested',
          custom_pickup: isPickupOthers ? customPickupText.trim() : null,
          custom_dropoff: isDropoffOthers ? customDropoffText.trim() : null,
          quote_status: isOffCampusTrip ? 'none' : 'agreed',
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

  // Student accepts the driver's proposed quote
  async function handleAcceptQuote() {
    if (!activeRideId || !driverQuote) return
    setIsSubmitting(true)
    try {
      await supabase
        .from('rides')
        .update({
          quote_status: 'agreed',
          fare: driverQuote,
        })
        .eq('id', activeRideId)
    } catch (err) {
      console.error('Accept quote error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Student sends counter-offer
  async function handleSendCounter() {
    const val = Number(counterPriceInput)
    if (!activeRideId || isNaN(val) || val <= 0) return
    setIsSubmitting(true)
    try {
      await supabase
        .from('rides')
        .update({
          fare_quote: val,
          quote_status: 'countered',
        })
        .eq('id', activeRideId)
      setShowCounterBox(false)
    } catch (err) {
      console.error('Counter offer error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCancelRequest() {
    if (activeRideId) {
      await supabase.from('rides').update({ status: 'cancelled' }).eq('id', activeRideId)
    }
    setPhase('idle')
    setActiveRideId(null)
    setAssignedDriver(null)
    setDriverQuote(null)
    setQuoteStatus('none')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f7f7f7' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-8 h-16 bg-white" style={{ borderBottom: '1px solid #e8e8e8' }}>
        <button onClick={() => { if (setView) setView('landing'); navigate('/') }}>
          <img src="/src/assets/logo.png" alt="FutaRide" className="h-7 w-auto" />
        </button>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold leading-none" style={{ color: '#1a1a1a' }}>{displayName}</p>
            <p className="text-xs mt-0.5" style={{ color: '#737373' }}>{matricOrSub}</p>
          </div>
          <button
            onClick={async () => {
              await signOut()
              if (setView) setView('landing')
              navigate('/')
            }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-lg mx-auto w-full px-5 py-6">
        <div className="flex gap-1 mb-5 p-1 rounded-xl bg-white border border-neutral-200">
          {(['book', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: tab === t ? '#1a1a1a' : 'transparent', color: tab === t ? '#fff' : '#737373' }}
            >
              {t === 'book' ? 'Book a Ride' : 'My History'}
            </button>
          ))}
        </div>

        {tab === 'book' && (
          <>
            {phase === 'idle' && (
              <div className="rounded-2xl overflow-hidden bg-white border border-neutral-200">
                {/* 1. PICKUP SELECTION */}
                <div className="p-5 pb-4 border-b border-neutral-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full text-xs font-black flex items-center justify-center bg-amber-500 text-white">1</span>
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Pickup Location</p>
                    {displayPickup && <span className="ml-auto text-xs font-semibold text-amber-600 truncate max-w-[150px]">{displayPickup}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {hubs.map(h => {
                      const isOthers = h.name.toLowerCase().includes('others')
                      const selected = isOthers ? isPickupOthers : (!isPickupOthers && pickupHub?.id === h.id)
                      return (
                        <button
                          key={h.id}
                          onClick={() => {
                            if (isOthers) {
                              setIsPickupOthers(true)
                              setPickupHub(h)
                            } else {
                              setIsPickupOthers(false)
                              setPickupHub(h)
                              setCustomPickupText('')
                            }
                          }}
                          className={`px-3 py-2.5 rounded-xl text-xs font-medium text-left leading-snug ${isOthers ? 'col-span-2' : ''}`}
                          style={{
                            background: selected ? '#1a1a1a' : '#f7f7f7',
                            color: selected ? '#fff' : '#1a1a1a',
                            border: isOthers ? '1px dashed #d4d4d4' : '1px solid transparent',
                          }}
                        >
                          {h.name}
                        </button>
                      )
                    })}
                  </div>

                  {isPickupOthers && (
                    <input
                      type="text"
                      value={customPickupText}
                      onChange={e => setCustomPickupText(e.target.value)}
                      placeholder="Type your exact off-campus pickup (e.g. South Gate Titilayo Junction)"
                      className="w-full mt-2.5 px-4 py-3 rounded-xl text-sm bg-neutral-50 border border-neutral-200 focus:outline-none focus:border-amber-500"
                    />
                  )}
                </div>

                {/* 2. DROP-OFF SELECTION */}
                <div className="p-5 border-b border-neutral-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full text-xs font-black flex items-center justify-center bg-neutral-900 text-white">2</span>
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Drop-off Destination</p>
                    {displayDest && <span className="ml-auto text-xs font-semibold text-neutral-900 truncate max-w-[150px]">{displayDest}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {hubs
                      .filter(h => isPickupOthers || h.id !== pickupHub?.id)
                      .map(h => {
                        const isOthers = h.name.toLowerCase().includes('others')
                        const selected = isOthers ? isDropoffOthers : (!isDropoffOthers && dropoffHub?.id === h.id)
                        return (
                          <button
                            key={h.id}
                            onClick={() => {
                              if (isOthers) {
                                setIsDropoffOthers(true)
                                setDropoffHub(h)
                              } else {
                                setIsDropoffOthers(false)
                                setDropoffHub(h)
                                setCustomDropoffText('')
                              }
                            }}
                            className={`px-3 py-2.5 rounded-xl text-xs font-medium text-left leading-snug ${isOthers ? 'col-span-2' : ''}`}
                            style={{
                              background: selected ? '#1a1a1a' : '#f7f7f7',
                              color: selected ? '#fff' : '#1a1a1a',
                              border: isOthers ? '1px dashed #d4d4d4' : '1px solid transparent',
                            }}
                          >
                            {h.name}
                          </button>
                        )
                      })}
                  </div>

                  {isDropoffOthers && (
                    <input
                      type="text"
                      value={customDropoffText}
                      onChange={e => setCustomDropoffText(e.target.value)}
                      placeholder="Type your exact off-campus destination (e.g. Alagbaka, Akure Town)"
                      className="w-full mt-2.5 px-4 py-3 rounded-xl text-sm bg-neutral-50 border border-neutral-200 focus:outline-none focus:border-amber-500"
                    />
                  )}
                </div>

                {/* Fare Summary & Request CTA */}
                {canRequest && (
                  <div className="p-5">
                    {isOffCampusTrip ? (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 mb-3 text-xs leading-relaxed text-amber-900">
                        <p className="font-bold mb-0.5">Off-Campus Custom Fare Negotiation</p>
                        Drivers will quote their price for this specific location. You can accept or counter-offer before the ride starts.
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-4 rounded-xl bg-orange-50 border border-orange-200 mb-3">
                        <div>
                          <p className="text-xs font-semibold text-orange-600">Fixed Campus Fare</p>
                          <p className="text-xs text-neutral-500">Standard rate · Cash on arrival</p>
                        </div>
                        <span className="text-2xl font-black text-amber-600">₦{dynamicFare ?? 500}</span>
                      </div>
                    )}

                    {requestError && <p className="text-xs text-red-600 font-semibold mb-2">{requestError}</p>}

                    <button
                      onClick={handleRequest}
                      disabled={isSubmitting}
                      className="w-full py-4 rounded-xl font-bold text-sm bg-amber-500 text-white hover:bg-amber-600 transition-all"
                    >
                      {isSubmitting ? 'Requesting...' : isOffCampusTrip ? 'Request Off-Campus Ride' : 'Request Ride'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 1. REQUESTED (SEARCHING & NEGOTIATING) */}
            {phase === 'searching' && (
              <div className="bg-white rounded-2xl p-7 text-center border border-neutral-200">
                <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-orange-50 border-2 border-orange-200 text-2xl">
                  🛺
                </div>

                <h2 className="text-xl font-black mb-1">
                  {driverQuote ? 'Driver Quoted a Fare' : 'Finding Nearby Drivers…'}
                </h2>
                <p className="text-sm text-neutral-500 mb-3">
                  {displayPickup} → {displayDest}
                </p>

                {/* Off-Campus Live Negotiation Box */}
                {isOffCampusTrip && (
                  <div className="my-5 p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-left">
                    {driverQuote ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Driver Offer:</span>
                          <span className="text-2xl font-black text-amber-600">₦{driverQuote}</span>
                        </div>

                        {quoteStatus === 'countered' ? (
                          <p className="text-xs text-amber-700 italic mb-2">
                            Counter-offer of ₦{driverQuote} sent! Waiting for driver to accept...
                          </p>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={handleAcceptQuote}
                              className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-amber-500 text-white hover:bg-amber-600"
                            >
                              Accept ₦{driverQuote}
                            </button>
                            <button
                              onClick={() => setShowCounterBox(b => !b)}
                              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-neutral-200 text-neutral-800 hover:bg-neutral-300"
                            >
                              Counter Offer
                            </button>
                          </div>
                        )}

                        {showCounterBox && (
                          <div className="mt-3 pt-3 border-t border-neutral-200 flex gap-2">
                            <input
                              type="number"
                              value={counterPriceInput}
                              onChange={e => setCounterPriceInput(e.target.value)}
                              placeholder="Your price (e.g. 800)"
                              className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-neutral-300 focus:outline-none"
                            />
                            <button
                              onClick={handleSendCounter}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-neutral-900 text-white"
                            >
                              Send
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500 text-center py-2">
                        Drivers are viewing your route. Once a driver quotes a fare, it will appear here for your review.
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleCancelRequest}
                  className="text-xs font-semibold px-5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                >
                  Cancel Request
                </button>
              </div>
            )}

            {/* 2. ACCEPTED (DRIVER ASSIGNED & HEADING TO PICKUP) */}
            {phase === 'accepted' && (
              <div className="bg-white rounded-2xl overflow-hidden border border-neutral-200">
                <div className="px-5 py-3 bg-amber-500 text-white text-xs font-mono uppercase tracking-widest font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span>Driver Accepted — Heading to Pickup</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-3.5 mb-4 p-3.5 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-xl flex-shrink-0">
                      🛺
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-neutral-900">{assignedDriver?.name || 'Emma John'}</p>
                      <p className="text-xs text-neutral-500">Vehicle Plate</p>
                      <p className="text-xs font-mono font-bold text-amber-600 mt-0.5">{assignedDriver?.plate || 'ABC - 123 - D5'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="p-3 rounded-xl bg-neutral-50">
                      <p className="text-neutral-400 font-semibold mb-0.5">Pickup</p>
                      <p className="font-bold text-neutral-800 truncate">{displayPickup}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50">
                      <p className="text-neutral-400 font-semibold mb-0.5">Drop-off</p>
                      <p className="font-bold text-neutral-800 truncate">{displayDest}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-xs font-bold text-amber-900">Fare:</span>
                    <span className="text-xl font-black text-amber-600">₦{dynamicFare}</span>
                  </div>

                  <button
                    onClick={handleCancelRequest}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                  >
                    Cancel Ride
                  </button>
                </div>
              </div>
            )}

            {/* 3. IN PROGRESS (PASSENGER BOARDED) */}
            {phase === 'arriving' && (
              <div className="bg-white rounded-2xl overflow-hidden border border-neutral-200">
                <div className="px-5 py-3 bg-neutral-900 text-white text-xs font-mono uppercase tracking-widest font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Ride In Progress — En Route</span>
                </div>
                <div className="p-5 text-center">
                  <div className="w-14 h-14 rounded-full mx-auto mb-3 bg-neutral-50 border border-neutral-200 flex items-center justify-center text-2xl">
                    🛺
                  </div>
                  <h3 className="text-lg font-black text-neutral-900 mb-1">On the way to destination</h3>
                  <p className="text-xs text-neutral-500 mb-4">{displayPickup} → {displayDest}</p>

                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 mb-4 text-xs flex justify-between items-center">
                    <span className="text-neutral-500">Driver:</span>
                    <span className="font-bold text-neutral-800">
                      {assignedDriver?.name || 'Emma John'} ({assignedDriver?.plate || 'ABC - 123 - D5'})
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400">Driver will mark completion upon arrival.</p>
                </div>
              </div>
            )}

            {/* 4. COMPLETED */}
            {phase === 'completed' && (
              <div className="bg-white rounded-2xl p-7 text-center border border-neutral-200">
                <div className="w-14 h-14 rounded-full mx-auto mb-3 bg-green-50 text-green-600 flex items-center justify-center font-bold text-2xl">
                  ✓
                </div>
                <h2 className="text-xl font-black mb-1">Ride Complete!</h2>
                <p className="text-sm text-neutral-500 mb-4">{displayPickup} → {displayDest}</p>
                <p className="text-3xl font-black text-amber-600 mb-6">₦{dynamicFare}</p>
                <button
                  onClick={() => {
                    setPhase('idle')
                    setActiveRideId(null)
                    setAssignedDriver(null)
                    setDriverQuote(null)
                    setQuoteStatus('none')
                  }}
                  className="px-6 py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-all"
                >
                  Book Another Ride
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}