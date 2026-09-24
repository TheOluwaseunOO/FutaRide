import { useState } from 'react'
import { type View } from '../App'

type DriverStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'SUSPENDED'
interface Driver {
  id: string; name: string; phone: string; park: string
  plate: string; body: string; license: string; status: DriverStatus; rides: number
}

const INIT_DRIVERS: Driver[] = [
  { id: 'D-001', name: 'Adewale Kayode',  phone: '0803-456-7890', park: 'North Gate Unit', plate: 'AKR-442-KE', body: 'KE-12', license: 'LIC-NG-2021-8834', status: 'APPROVED',         rides: 47 },
  { id: 'D-002', name: 'Kunle Babatunde', phone: '0706-234-5678', park: 'South Gate Unit', plate: 'AKR-119-BT', body: 'BT-07', license: 'LIC-NG-2020-5521', status: 'APPROVED',         rides: 33 },
  { id: 'D-003', name: 'Emmanuel Obi',    phone: '0816-345-6789', park: 'Obakekere Unit',  plate: 'AKR-763-OB', body: 'OB-03', license: 'LIC-NG-2022-1103', status: 'PENDING_APPROVAL', rides: 0  },
  { id: 'D-004', name: 'Segun Afolabi',   phone: '0901-456-7890', park: 'North Gate Unit', plate: 'AKR-551-AF', body: 'AF-09', license: 'LIC-NG-2019-9978', status: 'PENDING_APPROVAL', rides: 0  },
  { id: 'D-005', name: 'Biodun Adeyemi',  phone: '0812-567-8901', park: 'South Gate Unit', plate: 'AKR-887-AD', body: 'AD-14', license: 'LIC-NG-2020-4456', status: 'SUSPENDED',        rides: 12 },
]

const RIDES = [
  { id: 'R-2841', student: 'Fatimah Adeleke · 300L', driver: 'Adewale K.',  from: 'FUTA South Gate',     to: 'Obakekere Junction', fare: 150, status: 'IN_PROGRESS', time: '11:40 AM' },
  { id: 'R-2840', student: 'Olusegun Bello · 200L',  driver: 'Kunle B.',    from: 'FUTA North Gate',     to: 'Aule Junction Hub',  fare: 250, status: 'REQUESTED',   time: '11:38 AM' },
  { id: 'R-2839', student: 'Ngozi Chukwu · 400L',    driver: '—',           from: 'Obanla Campus Center',to: 'FUTA South Gate',    fare: 100, status: 'REQUESTED',   time: '11:35 AM' },
  { id: 'R-2838', student: 'Tunde Musa · 500L',      driver: 'Adewale K.',  from: 'FUTA North Gate',     to: 'Obakekere Junction', fare: 200, status: 'COMPLETED',   time: '10:22 AM' },
  { id: 'R-2837', student: 'Amaka Eze · 100L',       driver: 'Kunle B.',    from: 'FUTA South Gate',     to: 'Obanla Campus Center',fare: 100, status: 'COMPLETED',  time: '8:47 AM'  },
  { id: 'R-2836', student: 'Ibrahim Lawal · 300L',   driver: '—',           from: 'Obakekere Junction',  to: 'FUTA North Gate',    fare: 200, status: 'EXPIRED',     time: '7:15 AM'  },
]

const HUBS = [
  { id: 'H-01', name: 'FUTA North Gate', active: true },
  { id: 'H-02', name: 'FUTA South Gate', active: true },
  { id: 'H-03', name: 'Obanla Campus Center', active: true },
  { id: 'H-04', name: 'School of Engineering (SEET)', active: true },
  { id: 'H-05', name: 'Obakekere Junction', active: true },
  { id: 'H-06', name: 'Aule Junction Hub', active: true },
  { id: 'H-07', name: 'FUTA Junction (Ilesha Rd)', active: true },
  { id: 'H-08', name: 'South Gate / Titilayo', active: false },
]

const FARE_MATRIX = [
  { from: 'FUTA South Gate',  to: 'Obakekere Junction', fare: 150 },
  { from: 'FUTA North Gate',  to: 'Obakekere Junction', fare: 200 },
  { from: 'FUTA North Gate',  to: 'Aule Junction Hub',  fare: 250 },
  { from: 'FUTA South Gate',  to: 'Aule Junction Hub',  fare: 200 },
  { from: 'FUTA North Gate',  to: 'FUTA South Gate',    fare: 150 },
  { from: 'FUTA North Gate',  to: 'Obanla Campus Center', fare: 100 },
]

const RIDE_S: Record<string, { bg: string; color: string }> = {
  COMPLETED:   { bg: '#f0fdf4', color: '#16a34a' },
  IN_PROGRESS: { bg: '#eff6ff', color: '#1d4ed8' },
  REQUESTED:   { bg: '#fff7ed', color: '#ea580c' },
  EXPIRED:     { bg: '#f5f5f5', color: '#737373' },
  CANCELLED:   { bg: '#fef2f2', color: '#dc2626' },
}
const DRV_S: Record<DriverStatus, { bg: string; color: string }> = {
  APPROVED:         { bg: '#f0fdf4', color: '#16a34a' },
  PENDING_APPROVAL: { bg: '#fff7ed', color: '#ea580c' },
  SUSPENDED:        { bg: '#fef2f2', color: '#dc2626' },
}

interface Props { setView: (v: View) => void }

export default function AdminDashboard({ setView }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>(INIT_DRIVERS)
  const [tab, setTab] = useState<'overview' | 'drivers' | 'rides' | 'fares'>('overview')

  const approve   = (id: string) => setDrivers(ds => ds.map(d => d.id === id ? { ...d, status: 'APPROVED' }  : d))
  const suspend   = (id: string) => setDrivers(ds => ds.map(d => d.id === id ? { ...d, status: 'SUSPENDED' } : d))
  const reinstate = (id: string) => setDrivers(ds => ds.map(d => d.id === id ? { ...d, status: 'APPROVED' }  : d))

  const pending      = drivers.filter(d => d.status === 'PENDING_APPROVAL').length
  const approved     = drivers.filter(d => d.status === 'APPROVED').length
  const todayRides   = RIDES.filter(r => r.status === 'COMPLETED').length
  const todayRevenue = RIDES.filter(r => r.status === 'COMPLETED').reduce((s, r) => s + r.fare, 0)

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'drivers',  label: `Drivers${pending ? ` · ${pending}` : ''}` },
    { key: 'rides',    label: 'Ride Logs' },
    { key: 'fares',    label: 'Hubs & Fares' },
  ] as const

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f7f7f7' }}>

      {/* ── Header ──────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8 h-14 md:h-16 bg-white"
        style={{ borderBottom: '1px solid #e8e8e8' }}>
        <button onClick={() => setView('landing')}>
          <img src="/src/assets/logo.png" alt="FutaRide" className="h-7 w-auto" />
        </button>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}>
              ⚠ {pending} pending
            </span>
          )}
          <span className="text-xs font-mono uppercase tracking-widest px-2.5 py-1.5 rounded-lg"
            style={{ background: '#f5f5f5', color: '#737373', border: '1px solid #e8e8e8' }}>
            Admin
          </span>
        </div>
      </header>

      {/* ── Greeting ────────────────────────── */}
      <div className="px-5 md:px-8 py-6 bg-white" style={{ borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest mb-0.5" style={{ color: '#E6900E' }}>
            Admin Console
          </p>
          <h2 className="text-2xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#1a1a1a' }}>
            Transport Operations · FUTA
          </h2>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-4 md:py-6">

        {/* ── Tabs ────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl bg-white mb-6 overflow-x-auto" style={{ border: '1px solid #e8e8e8' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all"
              style={{ background: tab === t.key ? '#1a1a1a' : 'transparent', color: tab === t.key ? '#fff' : '#737373' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview ────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Approved Drivers', value: approved,          color: '#E6900E' },
                { label: 'Pending Approval', value: pending,           color: '#ea580c' },
                { label: "Today's Rides",    value: todayRides,        color: '#1a1a1a' },
                { label: "Today's Revenue",  value: `₦${todayRevenue}`,color: '#E6900E' },
              ].map(s => (
                <div key={s.label} className="bg-white p-5 rounded-2xl" style={{ border: '1px solid #e8e8e8' }}>
                  <p className="text-3xl font-black mb-1" style={{ fontFamily: 'Outfit, sans-serif', color: s.color }}>
                    {s.value}
                  </p>
                  <p className="text-xs" style={{ color: '#a3a3a3' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {pending > 0 && (
              <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl"
                style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#ea580c' }}>
                    {pending} driver{pending > 1 ? 's' : ''} awaiting verification
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#737373' }}>
                    Drivers cannot receive rides until approved.
                  </p>
                </div>
                <button onClick={() => setTab('drivers')}
                  className="px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 hover:opacity-90"
                  style={{ background: '#E6900E', color: '#fff' }}>
                  Review
                </button>
              </div>
            )}

            {/* Live activity */}
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e8e8' }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f5f5f5' }}>
                <h3 className="text-sm font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Live Activity</h3>
                <button onClick={() => setTab('rides')} className="text-xs font-semibold hover:opacity-70"
                  style={{ color: '#E6900E' }}>
                  View all →
                </button>
              </div>
              <div className="divide-y" style={{ borderColor: '#f5f5f5' }}>
                {RIDES.slice(0, 4).map(r => (
                  <div key={r.id} className="px-5 py-3.5 flex items-center gap-4">
                    <span className="text-xs font-mono w-14 flex-shrink-0" style={{ color: '#a3a3a3' }}>{r.id}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.from} → {r.to}</p>
                      <p className="text-xs truncate" style={{ color: '#a3a3a3' }}>{r.student}</p>
                    </div>
                    <span className="text-sm font-bold flex-shrink-0">₦{r.fare}</span>
                    <span className="text-xs px-2 py-1 rounded-lg font-mono flex-shrink-0"
                      style={{ background: RIDE_S[r.status].bg, color: RIDE_S[r.status].color }}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Drivers ─────────────────────────── */}
        {tab === 'drivers' && (
          <div className="space-y-3">
            {drivers.map(d => (
              <div key={d.id} className="bg-white rounded-2xl p-5" style={{ border: '1px solid #e8e8e8' }}>
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div>
                    <p className="font-bold" style={{ color: '#1a1a1a' }}>{d.name}</p>
                    <p className="text-sm mt-0.5" style={{ color: '#737373' }}>{d.park}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-lg font-mono"
                    style={{ background: DRV_S[d.status].bg, color: DRV_S[d.status].color }}>
                    {d.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3" style={{ color: '#737373' }}>
                  <span>📞 {d.phone}</span>
                  <span>🛺 {d.plate}</span>
                  <span>Body: {d.body}</span>
                  <span>🪪 {d.license}</span>
                </div>
                {d.status !== 'PENDING_APPROVAL' && (
                  <p className="text-xs mb-3" style={{ color: '#a3a3a3' }}>{d.rides} completed rides</p>
                )}
                <div className="pt-3 flex gap-2" style={{ borderTop: '1px solid #f5f5f5' }}>
                  {d.status === 'PENDING_APPROVAL' && (
                    <>
                      <button onClick={() => approve(d.id)}
                        className="flex-1 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
                        style={{ background: '#E6900E', color: '#fff' }}>
                        Approve
                      </button>
                      <button onClick={() => suspend(d.id)}
                        className="px-4 py-2.5 rounded-xl font-semibold text-sm border"
                        style={{ borderColor: '#e8e8e8', color: '#737373' }}>
                        Reject
                      </button>
                    </>
                  )}
                  {d.status === 'APPROVED' && (
                    <button onClick={() => suspend(d.id)}
                      className="px-4 py-2 rounded-xl font-semibold text-xs border"
                      style={{ borderColor: '#fca5a5', color: '#dc2626' }}>
                      Suspend Account
                    </button>
                  )}
                  {d.status === 'SUSPENDED' && (
                    <button onClick={() => reinstate(d.id)}
                      className="px-4 py-2 rounded-xl font-semibold text-sm"
                      style={{ background: '#f5f5f5', color: '#1a1a1a' }}>
                      Reinstate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Ride logs ───────────────────────── */}
        {tab === 'rides' && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e8e8' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #f5f5f5' }}>
              <h3 className="text-sm font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>All Ride Records</h3>
              <p className="text-xs mt-0.5" style={{ color: '#a3a3a3' }}>Tamper-proof audit log · Today</p>
            </div>
            <div className="divide-y" style={{ borderColor: '#f5f5f5' }}>
              {RIDES.map(r => (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono" style={{ color: '#a3a3a3' }}>{r.id}</span>
                      <span className="text-xs" style={{ color: '#a3a3a3' }}>{r.time}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-lg font-mono"
                      style={{ background: RIDE_S[r.status].bg, color: RIDE_S[r.status].color }}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold mb-1">{r.from} → {r.to}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3 text-xs" style={{ color: '#737373' }}>
                      <span>{r.student}</span>
                      <span>Driver: {r.driver}</span>
                    </div>
                    <span className="font-bold text-sm">₦{r.fare}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Hubs & Fares ────────────────────── */}
        {tab === 'fares' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e8e8' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #f5f5f5' }}>
                <h3 className="text-sm font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Campus Hubs</h3>
              </div>
              <div className="divide-y" style={{ borderColor: '#f5f5f5' }}>
                {HUBS.map(h => (
                  <div key={h.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono" style={{ color: '#a3a3a3' }}>{h.id}</span>
                      <p className="text-sm font-medium">{h.name}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-lg font-mono"
                      style={{ background: h.active ? '#f0fdf4' : '#f5f5f5', color: h.active ? '#16a34a' : '#a3a3a3' }}>
                      {h.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e8e8' }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f5f5f5' }}>
                <h3 className="text-sm font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Fare Matrix</h3>
                <span className="text-xs" style={{ color: '#a3a3a3' }}>₦100 – ₦2,000 range</span>
              </div>
              <div className="divide-y" style={{ borderColor: '#f5f5f5' }}>
                {FARE_MATRIX.map((row, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <p className="text-sm">
                      {row.from} <span style={{ color: '#a3a3a3' }}>→</span> {row.to}
                    </p>
                    <span className="font-black text-base flex-shrink-0"
                      style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>
                      ₦{row.fare}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
