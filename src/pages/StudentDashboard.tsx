import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { type View } from '../App'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import CancelRideModal from '../components/CancelRideModal'
import NetworkBanner from '../components/NetworkBanner'
import EmptyState from '../components/EmptyState'
import { RideHistorySkeleton, HubSelectionSkeleton } from '../components/SkeletonLoader'

interface LocationHub {
  id: string
  name: string
}

interface AssignedDriver {
  name: string
  plate: string
  phone: string
}

interface PreloadedRoute {
  id: string
  pickup_location_id: string
  dropoff_location_id: string
  base_fare: number
}

interface DriverOffer {
  id: string
  driver_id: string
  amount: number
  driver_name: string
  driver_plate: string
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
  { id: 'offcampus', name: 'Others (Custom Location)' },
]

const FALLBACK_FARES: Record<string, number> = {
  'FUTA North Gate→FUTA South Gate': 700,
  'FUTA North Gate→Obanla Campus Center': 500,
  'FUTA North Gate→School of Engineering (SEET)': 500,
  'FUTA North Gate→Obakekere Junction': 700,
  'FUTA North Gate→Aule Junction Hub': 900,
  'FUTA North Gate→FUTA Junction (Ilesha Rd)': 700,
  'FUTA North Gate→South Gate / Titilayo': 600,
  'FUTA South Gate→FUTA North Gate': 700,
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

type Phase = 'idle' | 'searching' | 'accepted' | 'arriving' | 'completed' | 'expired'
interface Props { setView?: (v: View) => void }

const TIMEOUT_SECONDS = 180

export default function StudentDashboard({ setView }: Props) {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Rider'
  const affiliation = profile?.department || 'Campus Rider'

  const [hubs, setHubs] = useState<LocationHub[]>(FALLBACK_HUBS)
  const [loadingHubs, setLoadingHubs] = useState(true)

  const routesCache = useRef<Map<string, { id: string; fare: number }>>(new Map())

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
  const [isResolvingFare, setIsResolvingFare] = useState(false)

  // Active Ride & Live Negotiation State
  const [activeRideId, setActiveRideId] = useState<string | null>(null)
  const [activeRideFare, setActiveRideFare] = useState<number>(0)
  const [rideCreatedAt, setRideCreatedAt] = useState<string | null>(null)
  const [assignedDriver, setAssignedDriver] = useState<AssignedDriver | null>(null)
  const [driverOffers, setDriverOffers] = useState<DriverOffer[]>([])
  const [requestError, setRequestError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Clean initialization directly to 'idle'
  const [phase, setPhase] = useState<Phase>('idle')
  const [tab, setTab] = useState<'book' | 'history'>('book')

  const [timeLeft, setTimeLeft] = useState<number>(TIMEOUT_SECONDS)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const [historyRides, setHistoryRides] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const isCustomTrip = isPickupOthers || isDropoffOthers || (activeRideId !== null && activeRideFare === 0)

  async function fetchDriverInfo(driverId: string) {
    if (!driverId) return

    try {
      const [{ data: dp }, { data: p }] = await Promise.all([
        supabase.from('driver_profiles').select('*').eq('id', driverId).maybeSingle(),
        supabase.from('profiles').select('*').eq('id', driverId).maybeSingle(),
      ])

      const resolvedName = dp?.full_name || p?.full_name || dp?.name || p?.name || 'Assigned Driver'
      const resolvedPlate = dp?.vehicle_plate_number || p?.vehicle_plate_number || dp?.plate_number || p?.plate_number || 'Keke Unit'
      const resolvedPhone = dp?.phone_number || p?.phone_number || ''

      setAssignedDriver({
        name: resolvedName,
        plate: resolvedPlate,
        phone: resolvedPhone,
      })
    } catch (err) {
      console.error('Error fetching driver details:', err)
    }
  }

  const restoreRiderRide = useCallback(async () => {
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
        if (ongoing.status === 'requested') {
          const elapsed = Math.floor((Date.now() - new Date(ongoing.created_at).getTime()) / 1000)
          if (elapsed >= TIMEOUT_SECONDS) {
            await supabase.from('rides').update({ status: 'expired' }).eq('id', ongoing.id)
            setPhase('expired')
            setActiveRideId(ongoing.id)
            return
          } else {
            setTimeLeft(TIMEOUT_SECONDS - elapsed)
          }
        }

        setActiveRideId(ongoing.id)
        setActiveRideFare(Number(ongoing.fare) || 0)
        setRideCreatedAt(ongoing.created_at)
        setDynamicFare(Number(ongoing.fare))
        if (ongoing.custom_pickup) {
          setIsPickupOthers(true)
          setCustomPickupText(ongoing.custom_pickup)
        }
        if (ongoing.custom_dropoff) {
          setIsDropoffOthers(true)
          setCustomDropoffText(ongoing.custom_dropoff)
        }

        if (ongoing.status === 'requested') {
          setPhase('searching')
        } else if (ongoing.status === 'accepted') {
          setPhase('accepted')
          if (ongoing.driver_id) fetchDriverInfo(ongoing.driver_id)
        } else if (ongoing.status === 'in_progress') {
          setPhase('arriving')
          if (ongoing.driver_id) fetchDriverInfo(ongoing.driver_id)
        }
      } else {
        if (phase === 'searching' || phase === 'accepted' || phase === 'arriving') {
          const { data: lastRide } = await supabase
            .from('rides')
            .select('status')
            .eq('student_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (lastRide?.status === 'completed') setPhase('completed')
          else if (lastRide?.status === 'expired') setPhase('expired')
          else handleResetAfterExpired()
        } else if (!phase) {
          setPhase('idle')
        }
      }
    } catch (err) {
      console.error('Error restoring rider session:', err)
      setPhase('idle')
    }
  }, [user, phase])

  useEffect(() => {
    restoreRiderRide()
  }, [restoreRiderRide])

  useEffect(() => {
    async function initLocationsAndRoutes() {
      try {
        setLoadingHubs(true)
        const [{ data: locData }, { data: routeData }] = await Promise.all([
          supabase.from('locations').select('id, name').order('name', { ascending: true }),
          supabase.from('routes').select('id, pickup_location_id, dropoff_location_id, base_fare'),
        ])

        if (locData && locData.length > 0) {
          const hasOthers = locData.some(h => h.name.toLowerCase().includes('others'))
          if (!hasOthers) {
            setHubs([...locData, { id: 'offcampus', name: 'Others' }])
          } else {
            setHubs(locData)
          }
        }

        if (routeData && routeData.length > 0) {
          routeData.forEach((r: PreloadedRoute) => {
            const key = `${r.pickup_location_id}::${r.dropoff_location_id}`
            routesCache.current.set(key, { id: r.id, fare: Number(r.base_fare) })
          })
        }
      } catch (err) {
        console.warn('Locations/routes preload notice:', err)
      } finally {
        setLoadingHubs(false)
      }
    }
    initLocationsAndRoutes()
  }, [])

  useEffect(() => {
    if (!pickupHub || !dropoffHub) {
      setDynamicFare(null)
      setActiveRouteId(null)
      setIsResolvingFare(false)
      return
    }

    if (isPickupOthers || isDropoffOthers) {
      setDynamicFare(0)
      setActiveRouteId(null)
      setIsResolvingFare(false)
      return
    }

    const directKey = `${pickupHub.id}::${dropoffHub.id}`
    const cached = routesCache.current.get(directKey)

    if (cached) {
      setActiveRouteId(cached.id)
      setDynamicFare(cached.fare)
      setIsResolvingFare(false)
      return
    }

    const fallbackKey = `${pickupHub.name}→${dropoffHub.name}`
    const reverseKey = `${dropoffHub.name}→${pickupHub.name}`
    const staticFare = FALLBACK_FARES[fallbackKey] || FALLBACK_FARES[reverseKey]

    if (staticFare) {
      setDynamicFare(staticFare)
      setIsResolvingFare(false)
      return
    }

    setIsResolvingFare(true)
    async function resolveUncachedRoute() {
      try {
        const { data } = await supabase
          .from('routes')
          .select('id, base_fare')
          .eq('pickup_location_id', pickupHub!.id)
          .eq('dropoff_location_id', dropoffHub!.id)
          .maybeSingle()

        if (data) {
          routesCache.current.set(directKey, { id: data.id, fare: Number(data.base_fare) })
          setActiveRouteId(data.id)
          setDynamicFare(Number(data.base_fare))
        } else {
          setDynamicFare(500)
        }
      } catch {
        setDynamicFare(500)
      } finally {
        setIsResolvingFare(false)
      }
    }

    resolveUncachedRoute()
  }, [pickupHub, dropoffHub, isPickupOthers, isDropoffOthers])

  useEffect(() => {
    if (tab !== 'history' || !user) return

    async function fetchHistory() {
      setLoadingHistory(true)
      try {
        const { data: ridesData, error: ridesErr } = await supabase
          .from('rides')
          .select('*')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false })

        if (ridesErr) throw ridesErr
        if (!ridesData || ridesData.length === 0) {
          setHistoryRides([])
          return
        }

        const [{ data: routesData }, { data: locsData }] = await Promise.all([
          supabase.from('routes').select('id, pickup_location_id, dropoff_location_id'),
          supabase.from('locations').select('id, name'),
        ])

        const locMap = new Map((locsData || []).map(l => [l.id, l.name]))
        const routeMap = new Map(
          (routesData || []).map(r => [
            r.id,
            {
              pickup: locMap.get(r.pickup_location_id) || 'Campus Hub',
              dropoff: locMap.get(r.dropoff_location_id) || 'Campus Hub',
            },
          ])
        )

        const formatted = ridesData.map(r => {
          const route = r.route_id ? routeMap.get(r.route_id) : null
          const pickupName = r.custom_pickup || route?.pickup || 'Campus Hub'
          const dropoffName = r.custom_dropoff || route?.dropoff || 'Campus Hub'

          return {
            id: r.id,
            pickup: pickupName,
            dropoff: dropoffName,
            fare: r.fare ?? 0,
            status: r.status,
            date: new Date(r.created_at || Date.now()).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          }
        })

        setHistoryRides(formatted)
      } catch (err: any) {
        console.error('History fetch error:', err)
      } finally {
        setLoadingHistory(false)
      }
    }

    fetchHistory()
  }, [tab, user])

  const canRequest =
    (isPickupOthers ? customPickupText.trim().length > 0 : !!pickupHub) &&
    (isDropoffOthers ? customDropoffText.trim().length > 0 : !!dropoffHub)

  const displayPickup = isPickupOthers ? customPickupText.trim() : pickupHub?.name || ''
  const displayDest = isDropoffOthers ? customDropoffText.trim() : dropoffHub?.name || ''

  useEffect(() => {
    if (phase !== 'searching' || !activeRideId) return

    const timer = setInterval(async () => {
      let secondsRemaining = 0

      if (rideCreatedAt) {
        const elapsed = Math.floor((Date.now() - new Date(rideCreatedAt).getTime()) / 1000)
        secondsRemaining = Math.max(0, TIMEOUT_SECONDS - elapsed)
      } else {
        secondsRemaining = Math.max(0, timeLeft - 1)
      }

      setTimeLeft(secondsRemaining)

      if (secondsRemaining <= 0) {
        clearInterval(timer)
        try {
          await supabase.from('rides').update({ status: 'expired' }).eq('id', activeRideId)
        } catch (err) {
          console.error('Failed updating expired ride status:', err)
        }
        setPhase('expired')
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [phase, activeRideId, rideCreatedAt, timeLeft])

  // Realtime subscription for active ride updates & RPC-powered driver quote resolution
  useEffect(() => {
    if (!activeRideId) return

    async function loadQuotes() {
      try {
        const { data, error } = await supabase.rpc('get_ride_quotes_with_drivers', {
          p_ride_id: activeRideId,
        })

        if (!error && data) {
          setDriverOffers(
            data.map((q: any) => ({
              id: q.id,
              driver_id: q.driver_id,
              amount: Number(q.amount),
              driver_name: q.driver_name || 'Campus Driver',
              driver_plate: q.driver_plate || 'Keke Unit',
            }))
          )
        }
      } catch (err) {
        console.error('Error loading quotes via RPC:', err)
      }
    }

    loadQuotes()

    const channel = supabase
      .channel(`ride-status-and-quotes-${activeRideId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ride_quotes',
          filter: `ride_id=eq.${activeRideId}`,
        },
        () => {
          loadQuotes()
        }
      )
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

          if (row.status === 'accepted') {
            setDynamicFare(Number(row.fare))
            setActiveRideFare(Number(row.fare))
            setPhase('accepted')
            if (row.driver_id) await fetchDriverInfo(row.driver_id)
          } else if (row.status === 'in_progress') {
            setPhase('arriving')
            if (row.driver_id) await fetchDriverInfo(row.driver_id)
          } else if (row.status === 'completed') {
            setPhase('completed')
          } else if (row.status === 'expired') {
            setPhase('expired')
          } else if (row.status === 'cancelled') {
            setPhase('idle')
            setActiveRideId(null)
            setAssignedDriver(null)
            setDriverOffers([])
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
    if (!navigator.onLine) {
      setRequestError('You are currently offline. Please check your connection before requesting.')
      return
    }

    setIsSubmitting(true)
    setRequestError('')

    try {
      const finalPickup = isPickupOthers ? customPickupText.trim() : pickupHub?.name || null
      const finalDropoff = isDropoffOthers ? customDropoffText.trim() : dropoffHub?.name || null

      const finalRouteId = isCustomTrip ? null : activeRouteId
      const initialFare = isCustomTrip ? 0 : (dynamicFare ?? 500)
      const nowIso = new Date().toISOString()

      const { data: rideData, error: rideErr } = await supabase
        .from('rides')
        .insert({
          student_id: user.id,
          route_id: finalRouteId,
          fare: initialFare,
          status: 'requested',
          custom_pickup: finalPickup,
          custom_dropoff: finalDropoff,
          quote_status: isCustomTrip ? 'none' : 'agreed',
          created_at: nowIso,
        })
        .select('id, created_at, fare')
        .single()

      if (rideErr) throw rideErr

      setActiveRideId(rideData.id)
      setActiveRideFare(Number(rideData.fare) || 0)
      setRideCreatedAt(rideData.created_at || nowIso)
      setTimeLeft(TIMEOUT_SECONDS)
      setDriverOffers([])
      setPhase('searching')
    } catch (err: any) {
      console.error('Ride request error:', err)
      setRequestError(err?.message || 'Failed to request ride. Please check network connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAcceptQuote(offer: DriverOffer) {
    if (!activeRideId) return
    setIsSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('accept_driver_quote', {
        p_ride_id: activeRideId,
        p_quote_id: offer.id,
        p_driver_id: offer.driver_id,
        p_agreed_fare: offer.amount,
      })

      if (error || !data?.success) {
        setRequestError(data?.message || error?.message || 'Failed to accept quote.')
        return
      }

      setDynamicFare(offer.amount)
      setActiveRideFare(offer.amount)
      setPhase('accepted')
      await fetchDriverInfo(offer.driver_id)
    } catch (err: any) {
      console.error('Accept quote error:', err)
      setRequestError(err?.message || 'Failed to accept quote.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleConfirmCancel(reason: string) {
    if (!activeRideId || !user) return
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
        .eq('id', activeRideId)

      setShowCancelModal(false)
      setPhase('idle')
      setActiveRideId(null)
      setActiveRideFare(0)
      setAssignedDriver(null)
      setDriverOffers([])
      setPickupHub(null)
      setIsPickupOthers(false)
      setCustomPickupText('')
      setDropoffHub(null)
      setIsDropoffOthers(false)
      setCustomDropoffText('')
      setDynamicFare(null)
    } catch (err) {
      console.error('Cancellation error:', err)
    } finally {
      setIsCancelling(false)
    }
  }

  function handleResetAfterExpired() {
    setPhase('idle')
    setActiveRideId(null)
    setActiveRideFare(0)
    setAssignedDriver(null)
    setDriverOffers([])
    setPickupHub(null)
    setIsPickupOthers(false)
    setCustomPickupText('')
    setDropoffHub(null)
    setIsDropoffOthers(false)
    setCustomDropoffText('')
    setDynamicFare(null)
  }

  return (
    <div className="min-h-screen flex flex-col font-sans pb-12 sm:pb-8" style={{ background: '#f7f7f7' }}>
      <NetworkBanner onReconnect={restoreRiderRide} />

      {/* Top Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16 bg-white/95 backdrop-blur border-b border-neutral-200">
        <button
          onClick={() => { if (setView) setView('landing'); navigate('/') }}
          className="active:scale-95 transition-transform"
        >
          <img src="/logo.png" alt="FutaRide" className="h-6 sm:h-7 w-auto" />
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right">
            <p className="text-xs sm:text-sm font-bold leading-tight text-neutral-900 break-words max-w-[140px] sm:max-w-[200px]">
              {displayName}
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {affiliation}
            </p>
          </div>
          <button
            onClick={async () => {
              await signOut()
              if (setView) setView('landing')
              navigate('/')
            }}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-5 py-5 sm:py-6">
        {/* Tab Toggle */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl bg-white border border-neutral-200 shadow-sm">
          {(['book', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all active:scale-[0.98]"
              style={{
                background: tab === t ? '#1a1a1a' : 'transparent',
                color: tab === t ? '#fff' : '#737373',
              }}
            >
              {t === 'book' ? 'Book a Ride' : 'My History'}
            </button>
          ))}
        </div>

        {tab === 'book' && (
          <>
            {phase === 'idle' && (
              <div className="rounded-2xl overflow-hidden bg-white border border-neutral-200 shadow-sm">
                {/* 1. PICKUP SELECTION */}
                <div className="p-4 sm:p-5 pb-4 border-b border-neutral-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center bg-amber-500 text-white flex-shrink-0">
                      1
                    </span>
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Pickup Location</p>
                    {displayPickup && (
                      <span className="ml-auto text-xs font-bold text-amber-600 break-words text-right max-w-[160px] sm:max-w-[220px]">
                        {displayPickup}
                      </span>
                    )}
                  </div>

                  {loadingHubs ? (
                    <HubSelectionSkeleton />
                  ) : (
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
                                setPickupHub(null)
                              } else {
                                setIsPickupOthers(false)
                                setPickupHub(h)
                                setCustomPickupText('')
                              }
                            }}
                            className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all active:scale-[0.98] leading-tight break-words ${
                              isOthers ? 'col-span-2' : ''
                            }`}
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
                  )}

                  {isPickupOthers && (
                    <input
                      type="text"
                      value={customPickupText}
                      onChange={e => setCustomPickupText(e.target.value)}
                      placeholder="Type custom location (e.g. SLIT, School Park, Off-Campus...)"
                      className="w-full mt-2.5 px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm bg-neutral-50 border border-neutral-200 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  )}
                </div>

                {/* 2. DROP-OFF SELECTION */}
                <div className="p-4 sm:p-5 border-b border-neutral-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center bg-neutral-900 text-white flex-shrink-0">
                      2
                    </span>
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Drop-off Destination</p>
                    {displayDest && (
                      <span className="ml-auto text-xs font-bold text-neutral-900 break-words text-right max-w-[160px] sm:max-w-[220px]">
                        {displayDest}
                      </span>
                    )}
                  </div>

                  {loadingHubs ? (
                    <HubSelectionSkeleton />
                  ) : (
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
                                  setDropoffHub(null)
                                } else {
                                  setIsDropoffOthers(false)
                                  setDropoffHub(h)
                                  setCustomDropoffText('')
                                }
                              }}
                              className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all active:scale-[0.98] leading-tight break-words ${
                                isOthers ? 'col-span-2' : ''
                              }`}
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
                  )}

                  {isDropoffOthers && (
                    <input
                      type="text"
                      value={customDropoffText}
                      onChange={e => setCustomDropoffText(e.target.value)}
                      placeholder="Type custom destination (e.g. SLIT, Hilltop, Off-Campus...)"
                      className="w-full mt-2.5 px-3.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm bg-neutral-50 border border-neutral-200 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  )}
                </div>

                {/* Fare Summary & Action Button */}
                {canRequest && (
                  <div className="p-4 sm:p-5">
                    {isCustomTrip ? (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 mb-3 text-xs leading-relaxed text-amber-900">
                        <p className="font-bold mb-0.5">Custom Route Fare</p>
                        Multiple online drivers will submit quotes. You can compare offers and choose the driver you prefer.
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-orange-50 border border-orange-200 mb-3">
                        <div>
                          <p className="text-xs font-bold text-orange-600">Fixed Campus Fare</p>
                          <p className="text-[11px] text-neutral-500">Standard rate · Pay cash on arrival</p>
                        </div>
                        <div className="text-right">
                          {isResolvingFare ? (
                            <span className="inline-block w-16 h-7 bg-amber-200/60 animate-pulse rounded-lg" />
                          ) : (
                            <span className="text-2xl font-black text-amber-600">₦{dynamicFare ?? 500}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {requestError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600 mb-3">
                        {requestError}
                      </div>
                    )}

                    <button
                      onClick={handleRequest}
                      disabled={isSubmitting || isResolvingFare}
                      className="w-full py-3.5 sm:py-4 rounded-xl font-bold text-xs sm:text-sm bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.99] transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSubmitting ? 'Requesting...' : isCustomTrip ? 'Request Custom Ride' : 'Request Ride'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Phase: Searching */}
            {phase === 'searching' && (
              <div className="bg-white rounded-2xl p-6 sm:p-8 text-center border border-neutral-200 shadow-sm">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-orange-50 border-2 border-orange-200 text-3xl shadow-inner">
                  🛺
                </div>

                <h2 className="text-lg sm:text-xl font-black text-neutral-900 mb-1">
                  {isCustomTrip ? 'Waiting for Driver Bids…' : 'Looking for Nearby Drivers…'}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-600 mb-4 px-2 break-words leading-relaxed">
                  <span className="font-semibold text-neutral-900">{displayPickup}</span>
                  <span className="mx-1.5 text-neutral-400">→</span>
                  <span className="font-semibold text-neutral-900">{displayDest}</span>
                </p>

                {/* Expiration countdown pill */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700 mb-5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>
                    Auto-expires in: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                {isCustomTrip && (
                  <div className="my-4 space-y-2 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        Driver Quotes ({driverOffers.length})
                      </p>
                      <span className="text-[11px] text-amber-600 font-semibold animate-pulse">
                        Live offers
                      </span>
                    </div>

                    {driverOffers.length === 0 ? (
                      <div className="p-4 bg-neutral-50 rounded-xl text-center border border-neutral-100">
                        <p className="text-xs text-neutral-500">
                          Drivers are viewing your route. Quoted prices will appear here in real time.
                        </p>
                      </div>
                    ) : (
                      driverOffers.map((offer) => (
                        <div
                          key={offer.id}
                          className="p-3.5 bg-white border border-neutral-200 rounded-xl shadow-sm flex items-center justify-between gap-3 hover:border-amber-300 transition-all"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-bold text-neutral-900 break-words leading-snug">
                              {offer.driver_name}
                            </p>
                            <p className="text-[11px] text-neutral-500 font-mono mt-0.5 break-words">
                              {offer.driver_plate}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-base sm:text-lg font-black text-amber-600">
                              ₦{offer.amount}
                            </span>
                            <button
                              onClick={() => handleAcceptQuote(offer)}
                              disabled={isSubmitting}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                            >
                              Accept
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="text-xs font-bold px-5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Cancel Request
                  </button>
                </div>
              </div>
            )}

            {/* Phase: Expired */}
            {phase === 'expired' && (
              <EmptyState
                icon="⏱"
                title="Request Timed Out"
                description="No drivers were able to accept your trip within 3 minutes. Drivers may currently be busy on other campus routes."
                actionLabel="Try Again"
                onAction={handleRequest}
              />
            )}

            {/* Phase: Accepted */}
            {phase === 'accepted' && (
              <div className="bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
                <div className="px-5 py-3 bg-amber-500 text-white text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span>Driver Accepted, Heading to Pickup</span>
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex items-center gap-3.5 mb-4 p-3.5 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">
                      🛺
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-neutral-900 text-sm break-words">{assignedDriver?.name || 'Assigned Driver'}</p>
                      <p className="text-[11px] text-neutral-500">Vehicle Plate</p>
                      <p className="text-xs font-bold text-amber-600 break-words">{assignedDriver?.plate || 'Keke Unit'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="p-3 rounded-xl bg-neutral-50">
                      <p className="text-neutral-400 font-semibold mb-0.5">Pickup</p>
                      <p className="font-bold text-neutral-800 break-words leading-snug">{displayPickup}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50">
                      <p className="text-neutral-400 font-semibold mb-0.5">Drop-off</p>
                      <p className="font-bold text-neutral-800 break-words leading-snug">{displayDest}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-xs font-bold text-amber-900">Agreed Fare:</span>
                    <span className="text-xl font-black text-amber-600">₦{dynamicFare}</span>
                  </div>

                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full py-2.5 rounded-xl text-xs font-bold border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-colors"
                  >
                    Cancel Ride
                  </button>
                </div>
              </div>
            )}

            {/* Phase: In Progress */}
            {phase === 'arriving' && (
              <div className="bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
                <div className="px-5 py-3 bg-neutral-900 text-white text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Ride In Progress — En Route</span>
                </div>
                <div className="p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-3 bg-neutral-50 border border-neutral-200 flex items-center justify-center text-3xl shadow-inner">
                    🛺
                  </div>
                  <h3 className="text-lg font-black text-neutral-900 mb-1">On the way to destination</h3>
                  <p className="text-xs text-neutral-500 mb-4 break-words">{displayPickup} → {displayDest}</p>

                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100 mb-4 text-xs flex justify-between items-center gap-2">
                    <span className="text-neutral-500">Driver:</span>
                    <span className="font-bold text-neutral-800 text-right break-words">
                      {assignedDriver?.name} ({assignedDriver?.plate})
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400">Driver will complete trip upon arrival.</p>
                </div>
              </div>
            )}

            {/* Phase: Completed */}
            {phase === 'completed' && (
              <div className="bg-white rounded-2xl p-7 text-center border border-neutral-200 shadow-sm">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 bg-green-50 text-green-600 flex items-center justify-center font-bold text-2xl shadow-inner">
                  ✓
                </div>
                <h2 className="text-xl font-black mb-1">Ride Complete!</h2>
                <p className="text-xs sm:text-sm text-neutral-500 mb-3 break-words">{displayPickup} → {displayDest}</p>
                <p className="text-3xl font-black text-amber-600 mb-6">₦{dynamicFare}</p>
                <button
                  onClick={handleResetAfterExpired}
                  className="px-6 py-3 rounded-xl bg-amber-500 text-white font-bold text-xs sm:text-sm hover:bg-amber-600 active:scale-95 transition-all shadow-sm"
                >
                  Book Another Ride
                </button>
              </div>
            )}
          </>
        )}

        {/* Tab: My History */}
        {tab === 'history' && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Past Trips</h2>
            {loadingHistory ? (
              <RideHistorySkeleton />
            ) : historyRides.length === 0 ? (
              <EmptyState
                icon="🛺"
                title="No Trips Recorded"
                description="You haven't ordered any rides yet. Going somewhere?"
                actionLabel="Book a Ride Now"
                onAction={() => setTab('book')}
              />
            ) : (
              historyRides.map(ride => (
                <div key={ride.id} className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-between gap-3">
                  <div className="min-w-0 pr-2 flex-1">
                    <div className="font-bold text-xs sm:text-sm text-neutral-900 break-words leading-snug">
                      <span>{ride.pickup}</span>
                      <span className="text-neutral-400 mx-1">→</span>
                      <span>{ride.dropoff}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1">{ride.date}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-black text-amber-600">₦{ride.fare}</span>
                    <span className={`block text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                      ride.status === 'completed'
                        ? 'text-emerald-600'
                        : ride.status === 'cancelled'
                        ? 'text-red-500'
                        : ride.status === 'expired'
                        ? 'text-neutral-500'
                        : 'text-amber-500'
                    }`}>
                      {ride.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <CancelRideModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleConfirmCancel}
        role="rider"
        isSubmitting={isCancelling}
      />
    </div>
  )
}