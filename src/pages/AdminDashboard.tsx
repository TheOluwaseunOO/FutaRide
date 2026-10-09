import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import AdminManagerModal from '../components/AdminManagerModal'

interface LocationHub {
  id: string
  name: string
  created_at?: string
}

interface RouteFare {
  id: string
  pickup_location_id: string
  dropoff_location_id: string
  base_fare: number
  pickup?: { name: string }
  dropoff?: { name: string }
}

interface DriverRecord {
  id: string
  full_name: string
  phone_number?: string
  plate_number?: string
  verification_status: 'verified' | 'pending' | 'suspended'
  created_at?: string
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  const [activeTab, setActiveTab] = useState<'locations' | 'fares' | 'drivers'>('locations')
  const [locations, setLocations] = useState<LocationHub[]>([])
  const [routes, setRoutes] = useState<RouteFare[]>([])
  const [drivers, setDrivers] = useState<DriverRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Super Admin state & modal
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)

  // New location form state
  const [newLocationName, setNewLocationName] = useState('')
  const [isAddingLocation, setIsAddingLocation] = useState(false)

  // Edit location state
  const [editingLocId, setEditingLocId] = useState<string | null>(null)
  const [editingLocName, setEditingLocName] = useState('')

  // New route fare state
  const [newPickupId, setNewPickupId] = useState('')
  const [newDropoffId, setNewDropoffId] = useState('')
  const [newFareAmount, setNewFareAmount] = useState('')
  const [isAddingRoute, setIsAddingRoute] = useState(false)

  // Edit route fare state
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const [editingFareInput, setEditingFareInput] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!user) return
    async function verifySuperAdminRole() {
      try {
        const { data } = await supabase
          .from('admin_users')
          .select('is_super_admin')
          .eq('user_id', user.id)
          .maybeSingle()

        if (data?.is_super_admin) {
          setIsSuperAdmin(true)
        }
      } catch (err) {
        console.warn('Super Admin check warning:', err)
      }
    }
    verifySuperAdminRole()
  }, [user])

  function showNotification(msg: string, isError = false) {
    if (isError) {
      setErrorMsg(msg)
      setSuccessMsg('')
    } else {
      setSuccessMsg(msg)
      setErrorMsg('')
    }
    setTimeout(() => {
      setErrorMsg('')
      setSuccessMsg('')
    }, 4000)
  }

  async function fetchDrivers() {
    setLoadingDrivers(true)
    try {
      const [{ data: dProfiles }, { data: generalProfiles }] = await Promise.all([
        supabase.from('driver_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'driver'),
      ])

      const combinedMap = new Map<string, DriverRecord>()

      ;(generalProfiles || []).forEach(p => {
        combinedMap.set(p.id, {
          id: p.id,
          full_name: p.full_name || (p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : 'Driver'),
          phone_number: p.phone_number || '',
          plate_number: p.vehicle_plate_number || p.plate_number || 'N/A',
          verification_status: p.verification_status || 'verified',
          created_at: p.created_at,
        })
      })

      ;(dProfiles || []).forEach(d => {
        const existing = combinedMap.get(d.id)
        combinedMap.set(d.id, {
          id: d.id,
          full_name: d.full_name || existing?.full_name || 'Driver',
          phone_number: d.phone_number || existing?.phone_number || '',
          plate_number: d.vehicle_plate_number || d.plate_number || existing?.plate_number || 'N/A',
          verification_status: d.verification_status || existing?.verification_status || 'verified',
          created_at: d.created_at || existing?.created_at,
        })
      })

      setDrivers(Array.from(combinedMap.values()))
    } catch (err: any) {
      console.error('Error fetching drivers:', err)
    } finally {
      setLoadingDrivers(false)
    }
  }

  async function fetchData() {
    setLoading(true)
    try {
      const { data: locData, error: locErr } = await supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true })

      if (locErr) throw locErr
      setLocations(locData || [])

      const { data: routeData, error: routeErr } = await supabase
        .from('routes')
        .select(`
          id,
          pickup_location_id,
          dropoff_location_id,
          base_fare,
          pickup:locations!pickup_location_id(name),
          dropoff:locations!dropoff_location_id(name)
        `)
        .order('base_fare', { ascending: true })

      if (routeErr) throw routeErr
      setRoutes((routeData as any) || [])

      await fetchDrivers()
    } catch (err: any) {
      showNotification(err.message || 'Failed to load data', true)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!newLocationName.trim()) return

    setIsAddingLocation(true)
    try {
      const trimmed = newLocationName.trim()
      const exists = locations.some(l => l.name.toLowerCase() === trimmed.toLowerCase())
      if (exists) throw new Error('A location hub with this name already exists.')

      const { data, error } = await supabase
        .from('locations')
        .insert({ name: trimmed })
        .select()
        .single()

      if (error) throw error

      setLocations(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewLocationName('')
      showNotification(`Hub "${trimmed}" created successfully.`)
    } catch (err: any) {
      showNotification(err.message || 'Error adding location', true)
    } finally {
      setIsAddingLocation(false)
    }
  }

  async function handleSaveEditLocation(id: string) {
    if (!editingLocName.trim()) return

    try {
      const { error } = await supabase
        .from('locations')
        .update({ name: editingLocName.trim() })
        .eq('id', id)

      if (error) throw error

      setLocations(prev =>
        prev.map(l => (l.id === id ? { ...l, name: editingLocName.trim() } : l))
      )
      setEditingLocId(null)
      showNotification('Location updated successfully.')
      fetchData()
    } catch (err: any) {
      showNotification(err.message || 'Error updating location', true)
    }
  }

  async function handleDeleteLocation(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"? Associated routes may also be affected.`)) {
      return
    }

    try {
      const { error } = await supabase.from('locations').delete().eq('id', id)
      if (error) throw error

      setLocations(prev => prev.filter(l => l.id !== id))
      showNotification(`Location "${name}" removed.`)
      fetchData()
    } catch (err: any) {
      showNotification(err.message || 'Error deleting location', true)
    }
  }

  async function handleAddRoute(e: React.FormEvent) {
    e.preventDefault()
    if (!newPickupId || !newDropoffId || !newFareAmount) return
    if (newPickupId === newDropoffId) {
      showNotification('Pickup and Drop-off locations cannot be identical.', true)
      return
    }

    const fareVal = Number(newFareAmount)
    if (isNaN(fareVal) || fareVal <= 0) {
      showNotification('Please enter a valid fare amount.', true)
      return
    }

    setIsAddingRoute(true)
    try {
      const { data: existing } = await supabase
        .from('routes')
        .select('id')
        .eq('pickup_location_id', newPickupId)
        .eq('dropoff_location_id', newDropoffId)
        .maybeSingle()

      if (existing) {
        const { error: updateErr } = await supabase
          .from('routes')
          .update({
            base_fare: fareVal,
          })
          .eq('id', existing.id)

        if (updateErr) throw updateErr
        showNotification('Existing route fare updated successfully.')
      } else {
        const { error: insertErr } = await supabase
          .from('routes')
          .insert({
            pickup_location_id: newPickupId,
            dropoff_location_id: newDropoffId,
            base_fare: fareVal,
          })

        if (insertErr) throw insertErr
        showNotification('Route fare established successfully.')
      }

      setNewPickupId('')
      setNewDropoffId('')
      setNewFareAmount('')
      fetchData()
    } catch (err: any) {
      showNotification(err.message || 'Error configuring route fare', true)
    } finally {
      setIsAddingRoute(false)
    }
  }

  async function handleUpdateFare(routeId: string) {
    const fareVal = Number(editingFareInput)
    if (isNaN(fareVal) || fareVal <= 0) {
      showNotification('Please enter a valid fare value.', true)
      return
    }

    try {
      const { error } = await supabase
        .from('routes')
        .update({
          base_fare: fareVal,
        })
        .eq('id', routeId)

      if (error) throw error

      setRoutes(prev =>
        prev.map(r => (r.id === routeId ? { ...r, base_fare: fareVal } : r))
      )
      setEditingRouteId(null)
      showNotification('Fare updated successfully.')
    } catch (err: any) {
      showNotification(err.message || 'Error updating fare', true)
    }
  }

  async function handleDeleteRoute(routeId: string) {
    if (!confirm('Are you sure you want to delete this route fare configuration?')) return

    try {
      const { error } = await supabase.from('routes').delete().eq('id', routeId)
      if (error) throw error

      setRoutes(prev => prev.filter(r => r.id !== routeId))
      showNotification('Route fare removed.')
    } catch (err: any) {
      showNotification(err.message || 'Error removing route', true)
    }
  }

  async function handleUpdateDriverStatus(driverId: string, newStatus: 'verified' | 'suspended') {
    try {
      await Promise.all([
        supabase.from('driver_profiles').update({ verification_status: newStatus }).eq('id', driverId),
        supabase.from('profiles').update({ verification_status: newStatus }).eq('id', driverId),
      ])

      setDrivers(prev =>
        prev.map(d => (d.id === driverId ? { ...d, verification_status: newStatus } : d))
      )
      showNotification(`Driver verification status updated to "${newStatus}".`)
    } catch (err: any) {
      showNotification(err.message || 'Error updating driver verification status', true)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="FutaRide" className="h-7 w-auto" />
          <span className="text-xs font-mono font-bold bg-neutral-900 text-white px-2 py-0.5 rounded">
            Admin Portal
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          {isSuperAdmin && (
            <button
              onClick={() => setShowAdminModal(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <span>⚙️</span>
              <span>Team & Rights</span>
            </button>
          )}

          <span className="text-xs text-neutral-500 hidden sm:inline">
            Logged in as <strong className="text-neutral-900">{profile?.full_name || user?.email}</strong>
          </span>
          <button
            onClick={async () => {
              await signOut()
              navigate('/auth')
            }}
            className="text-xs font-bold text-neutral-600 hover:text-red-600 border border-neutral-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Admin Console</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage official campus hubs, standard route pricing, and driver verification</p>
          </div>

          {/* Module Navigation Tabs */}
          <div className="flex p-1 bg-neutral-200/70 rounded-xl">
            <button
              onClick={() => setActiveTab('locations')}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'locations' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Hubs ({locations.length})
            </button>
            <button
              onClick={() => setActiveTab('fares')}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'fares' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Fares ({routes.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('drivers')
                fetchDrivers()
              }}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'drivers' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Drivers ({drivers.length})
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            {successMsg}
          </div>
        )}

        {/* TAB 1: LOCATIONS */}
        {activeTab === 'locations' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm h-fit">
              <h2 className="text-sm font-bold text-neutral-900 mb-1">Add Location Hub</h2>
              <p className="text-xs text-neutral-500 mb-4">Register a designated pickup/drop-off point on or around campus.</p>
              <form onSubmit={handleAddLocation} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-neutral-500">Hub Name</label>
                  <input
                    type="text"
                    value={newLocationName}
                    onChange={e => setNewLocationName(e.target.value)}
                    placeholder="e.g. ETF Lecture Theatre"
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingLocation}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                >
                  {isAddingLocation ? 'Creating...' : '+ Add Hub Location'}
                </button>
              </form>
            </div>

            <div className="md:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-neutral-900">Configured Hubs</h2>
                <span className="text-xs text-neutral-400 font-mono">{locations.length} total</span>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-neutral-400">Loading hubs...</div>
              ) : locations.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400">No location hubs registered yet.</div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {locations.map(loc => (
                    <div key={loc.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-neutral-50/60 transition-colors">
                      {editingLocId === loc.id ? (
                        <div className="flex items-center gap-2 flex-1 mr-3">
                          <input
                            type="text"
                            value={editingLocName}
                            onChange={e => setEditingLocName(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEditLocation(loc.id)}
                            className="px-3 py-1.5 text-xs font-bold bg-neutral-900 text-white rounded-lg"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingLocId(null)}
                            className="px-2 py-1.5 text-xs text-neutral-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-xs font-semibold text-neutral-800">{loc.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingLocId(loc.id)
                                setEditingLocName(loc.name)
                              }}
                              className="text-xs font-mono text-neutral-500 hover:text-neutral-900 px-2 py-1 rounded"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteLocation(loc.id, loc.name)}
                              className="text-xs font-mono text-red-500 hover:text-red-700 px-2 py-1 rounded"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ROUTE FARES */}
        {activeTab === 'fares' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm h-fit">
              <h2 className="text-sm font-bold text-neutral-900 mb-1">Set Route Base Fare</h2>
              <p className="text-xs text-neutral-500 mb-4">Establish fixed rates for campus route pairings.</p>
              <form onSubmit={handleAddRoute} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-neutral-500">Pickup Hub</label>
                  <select
                    value={newPickupId}
                    onChange={e => setNewPickupId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs focus:outline-none"
                    required
                  >
                    <option value="">Select origin...</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-neutral-500">Drop-off Hub</label>
                  <select
                    value={newDropoffId}
                    onChange={e => setNewDropoffId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs focus:outline-none"
                    required
                  >
                    <option value="">Select destination...</option>
                    {locations
                      .filter(l => l.id !== newPickupId)
                      .map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-neutral-500">Base Fare (₦)</label>
                  <input
                    type="number"
                    value={newFareAmount}
                    onChange={e => setNewFareAmount(e.target.value)}
                    placeholder="e.g. 500"
                    step="50"
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs focus:outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingRoute}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                >
                  {isAddingRoute ? 'Configuring...' : '+ Set Route Fare'}
                </button>
              </form>
            </div>

            <div className="md:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-neutral-900">Configured Route Matrix</h2>
                <span className="text-xs text-neutral-400 font-mono">{routes.length} pairs</span>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-neutral-400">Loading fares...</div>
              ) : routes.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400">No fixed route fares configured yet.</div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {routes.map(r => (
                    <div key={r.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-neutral-50/60 transition-colors">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="text-xs font-bold text-neutral-900 truncate">
                          {(r.pickup as any)?.name || 'Unknown Hub'} → {(r.dropoff as any)?.name || 'Unknown Hub'}
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Fixed standard rate</p>
                      </div>

                      {editingRouteId === r.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editingFareInput}
                            onChange={e => setEditingFareInput(e.target.value)}
                            step="50"
                            className="w-24 px-2 py-1 text-xs font-bold rounded-lg border border-neutral-300 focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateFare(r.id)}
                            className="px-2.5 py-1 text-xs font-bold bg-amber-500 text-white rounded-lg"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingRouteId(null)}
                            className="px-1.5 py-1 text-xs text-neutral-400"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-amber-600">
                            ₦{r.base_fare}
                          </span>
                          <button
                            onClick={() => {
                              setEditingRouteId(r.id)
                              setEditingFareInput(String(r.base_fare))
                            }}
                            className="text-xs font-mono text-neutral-500 hover:text-neutral-900 px-2 py-1 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteRoute(r.id)}
                            className="text-xs font-mono text-red-500 hover:text-red-700 px-2 py-1 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DRIVER VERIFICATION */}
        {activeTab === 'drivers' && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Registered Drivers</h2>
                <p className="text-xs text-neutral-500">Review, approve credentials, or suspend campus drivers</p>
              </div>
              <span className="text-xs text-neutral-400 font-mono">{drivers.length} total</span>
            </div>

            {loadingDrivers ? (
              <div className="p-8 text-center text-xs text-neutral-400">Loading driver records...</div>
            ) : drivers.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">No registered drivers found.</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {drivers.map(driver => (
                  <div
                    key={driver.id}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/60 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-neutral-900">{driver.full_name}</span>
                        <span
                          className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full ${
                            driver.verification_status === 'verified'
                              ? 'bg-emerald-100 text-emerald-700'
                              : driver.verification_status === 'suspended'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {driver.verification_status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1">
                        <span>Plate: <strong className="font-mono text-neutral-800">{driver.plate_number}</strong></span>
                        {driver.phone_number && <span>· Tel: {driver.phone_number}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {driver.verification_status !== 'verified' && (
                        <button
                          onClick={() => handleUpdateDriverStatus(driver.id, 'verified')}
                          className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                        >
                          Approve Driver
                        </button>
                      )}
                      {driver.verification_status !== 'suspended' && (
                        <button
                          onClick={() => handleUpdateDriverStatus(driver.id, 'suspended')}
                          className="px-3 py-1.5 text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <AdminManagerModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
      />
    </div>
  )
}