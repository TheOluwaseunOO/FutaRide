import { useState } from 'react'
import { type View } from '../App'

const PENDING = [
  { id: 'R-2841', from: 'FUTA South Gate', to: 'Obakekere Junction', fare: 150, student: 'Fatimah A.', dept: '300L · SEET', phone: '0803-456-7890', sec: 142 },
  { id: 'R-2840', from: 'FUTA North Gate', to: 'Aule Junction Hub',  fare: 250, student: 'Olusegun B.', dept: '200L · CONAS', phone: '0706-123-4567', sec: 88 },
  { id: 'R-2839', from: 'Obanla Campus Center', to: 'FUTA South Gate', fare: 100, student: 'Ngozi C.', dept: '400L · CONAS', phone: '0816-789-0123', sec: 55 },
]

const DONE_TODAY = [
  { id: 'R-2838', from: 'FUTA North Gate', to: 'Obakekere Junction', fare: 200, student: 'Tunde M.', time: '10:22 AM' },
  { id: 'R-2835', from: 'FUTA South Gate', to: 'Obanla Campus Center', fare: 100, student: 'Amaka E.', time: '8:47 AM' },
  { id: 'R-2831', from: 'Obakekere Junction', to: 'FUTA North Gate', fare: 200, student: 'Ibrahim L.', time: '7:15 AM' },
]

type Phase = 'arriving' | 'in_progress' | 'completed' | null
interface Props { setView: (v: View) => void }

export default function DriverDashboard({ setView }: Props) {
  const [online, setOnline] = useState(false)
  const [activeRide, setActiveRide] = useState<typeof PENDING[0] | null>(null)
  const [phase, setPhase]   = useState<Phase>(null)
  const [tab, setTab]       = useState<'queue' | 'history'>('queue')

  const earnings = DONE_TODAY.reduce((s, r) => s + r.fare, 0)
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  function accept(ride: typeof PENDING[0]) { setActiveRide(ride); setPhase('arriving') }
  function resetRide() { setActiveRide(null); setPhase(null) }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f7f7f7' }}>

      {/* ── Header ──────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8 h-14 md:h-16 bg-white"
        style={{ borderBottom: '1px solid #e8e8e8' }}>
        <button onClick={() => setView('landing')}>
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
            <p className="text-sm font-semibold leading-none" style={{ color: '#1a1a1a' }}>Adewale Kayode</p>
            <p className="text-xs mt-0.5" style={{ color: '#737373' }}>North Gate Unit · AKR-442</p>
          </div>
          <img
            src="https://images.unsplash.com/photo-1620831468075-db24ca183258?w=80&h=80&fit=crop&auto=format"
            alt="Driver"
            className="w-9 h-9 rounded-full object-cover"
            style={{ border: '2px solid #E6900E' }}
          />
        </div>
      </header>

      {/* ── Greeting ────────────────────────── */}
      <div className="px-5 md:px-8 py-6 bg-white" style={{ borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest mb-0.5" style={{ color: '#E6900E' }}>
            {greeting}, Adewale 👋
          </p>
          <h2 className="text-2xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#1a1a1a' }}>
            {online ? 'You\'re live — watching for rides' : 'Go online to start earning'}
          </h2>
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 md:px-0 py-5 md:py-6">

        {/* ── Stats ───────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { v: `₦${earnings}`, l: "Today's earnings", accent: true },
            { v: DONE_TODAY.length, l: 'Rides today', accent: false },
            { v: online ? PENDING.length : 0, l: 'In queue', accent: false },
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
                <button onClick={() => setPhase('in_progress')}
                  className="w-full py-3.5 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: '#E6900E', color: '#fff' }}>
                  Passenger Boarded — Start Ride
                </button>
              ) : (
                <button onClick={() => setPhase('completed')}
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
              {t === 'queue' ? `Queue${online ? ` (${PENDING.length})` : ''}` : "Today's Rides"}
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
            {PENDING.map(ride => (
              <div key={ride.id} className="bg-white rounded-2xl p-5" style={{ border: '1px solid #e8e8e8' }}>
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div>
                    <span className="text-xs font-mono" style={{ color: '#a3a3a3' }}>{ride.id}</span>
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
            ))}
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
