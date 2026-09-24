import { useState } from 'react'
import { type View } from '../App'

interface Props {
  setView: (v: View) => void
  goAdmin: () => void
}

const HUBS = [
  'FUTA North Gate', 'FUTA South Gate', 'Obanla Campus Center',
  'School of Engineering (SEET)', 'Obakekere Junction',
  'Aule Junction Hub', 'FUTA Junction (Ilesha Rd)', 'South Gate / Titilayo',
]

const FEATURES = [
  { n: '01', title: 'Fixed Fares', body: 'Your fare is locked at request time. No surge pricing, no roadside negotiation.' },
  { n: '02', title: 'Verified Drivers', body: 'Every driver is admin-verified before receiving a single dispatch.' },
  { n: '03', title: 'Instant Dispatch', body: 'Requests reach available drivers in seconds via live real-time sync.' },
  { n: '04', title: 'Full Audit Trail', body: 'Every ride is permanently logged with timestamps and counterpart IDs.' },
]

const STEPS = [
  { n: '01', title: 'Choose your hubs', body: 'Pick a pickup and drop-off from 8 fixed FUTA campus locations.' },
  { n: '02', title: 'Fare is locked in', body: 'See your exact fare before you confirm. It never changes.' },
  { n: '03', title: 'Driver dispatched', body: 'A verified Keke operator claims your ride and heads over.' },
]

const LIGHT_GRADIENT = [
  'radial-gradient(ellipse 55% 45% at 15% 25%, rgba(230,144,14,0.05) 0%, transparent 65%)',
  'radial-gradient(ellipse 50% 55% at 85% 15%, rgba(245,196,30,0.04) 0%, transparent 60%)',
  'radial-gradient(ellipse 60% 40% at 70% 85%, rgba(230,144,14,0.035) 0%, transparent 60%)',
  'radial-gradient(ellipse 45% 50% at 30% 80%, rgba(245,196,30,0.025) 0%, transparent 55%)',
  'radial-gradient(ellipse 35% 35% at 55% 45%, rgba(230,144,14,0.02) 0%, transparent 50%)',
].join(', ')


export default function Landing({ setView, goAdmin }: Props) {
  const [tapCount, setTapCount] = useState(0)
  const [showAdminLink, setShowAdminLink] = useState(false)

  function handleLogoTap() {
    const next = tapCount + 1
    setTapCount(next)
    if (next >= 7) { setShowAdminLink(true); setTapCount(0) }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ color: '#1a1a1a' }}>

      {/* ── Navbar ─────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 md:px-14 h-14 md:h-16"
        style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #e8e8e8' }}>
        <button onClick={handleLogoTap} className="select-none">
          <img src="/src/assets/logo.png" alt="FutaRide" className="h-7 md:h-8 w-auto" />
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('driver')}
            className="hidden sm:block text-sm font-medium px-4 py-2 rounded-lg transition-colors hover:bg-neutral-100"
            style={{ color: '#737373' }}>
            I'm a Driver
          </button>
          {showAdminLink && (
            <button onClick={goAdmin}
              className="hidden sm:block text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: '#737373', border: '1px solid #e8e8e8' }}>
              Admin
            </button>
          )}
          <button onClick={() => setView('student')}
            className="text-sm font-semibold px-4 py-2 md:px-5 md:py-2.5 rounded-xl transition-all hover:opacity-90"
            style={{ background: '#E6900E', color: '#fff' }}>
            Book a Ride
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center text-center pt-14 md:pt-16 min-h-screen overflow-hidden"
        style={{ background: '#fff' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: LIGHT_GRADIENT }} />

        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-14 md:py-24 w-full">


          <h1 className="font-black leading-[1.05] mb-5 md:mb-6"
            style={{ fontFamily: 'Outfit, sans-serif', color: '#1a1a1a', fontSize: 'clamp(2.2rem, 8vw, 6rem)' }}>
            Smart, safe, and fast<br />
            <span style={{ color: '#E6900E' }}>rides on campus.</span>
          </h1>

          <p className="text-base md:text-xl leading-relaxed mb-8 md:mb-10 max-w-xl mx-auto" style={{ color: '#737373' }}>
            FutaRide connects FUTA students with verified Keke drivers at fixed, transparent fares. No haggling, No waiting blind!
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-10 md:mb-14">
            <button onClick={() => setView('auth-student')}
              className="px-7 py-3.5 rounded-xl font-bold text-base transition-all hover:opacity-90"
              style={{ background: '#E6900E', color: '#fff' }}>
              Request a Ride
            </button>
            <button onClick={() => setView('auth-driver')}
              className="px-7 py-3.5 rounded-xl font-semibold text-base transition-all hover:bg-neutral-100"
              style={{ color: '#1a1a1a', border: '1px solid #e8e8e8' }}>
              I'm a Driver
            </button>
          </div>

          {/* Hero ride preview card */}
          <div className="w-full rounded-2xl overflow-hidden text-left shadow-sm"
            style={{ background: '#fff', border: '1px solid #e8e8e8' }}>
            <img
              src="https://images.unsplash.com/photo-1572816225927-d08fb138f2b2?w=1200&h=320&fit=crop&auto=format"
              alt="Nigerian street with Keke vehicles"
              className="w-full object-cover"
              style={{ height: '200px' }}
            />
            <div className="p-4 md:p-8">
              <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: '#E6900E' }}>
                Live — driver en route
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="p-4 rounded-xl" style={{ background: '#f7f7f7' }}>
                  <p className="text-xs mb-1" style={{ color: '#737373' }}>Pickup</p>
                  <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>FUTA South Gate</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: '#f7f7f7' }}>
                  <p className="text-xs mb-1" style={{ color: '#737373' }}>Drop-off</p>
                  <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>Obakekere Junction</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <p className="text-xs mb-1" style={{ color: '#ea580c' }}>Locked fare</p>
                  <p className="text-2xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>₦500</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: '#f7f7f7' }}>
                  <p className="text-xs mb-1" style={{ color: '#737373' }}>Driver</p>
                  <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>Adewale K.</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: '#a3a3a3' }}>AKR-442-KE</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────── */}
      <div className="relative overflow-hidden" style={{ borderTop: '1px solid #e8e8e8', borderBottom: '1px solid #e8e8e8', background: '#fff' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: LIGHT_GRADIENT }} />
        <div className="relative max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4">
          {[
            { v: '8', l: 'Campus hubs' },
            { v: '₦0', l: 'Hidden fees' },
            { v: '3 min', l: 'Auto-expiry' },
            { v: '100%', l: 'Verified drivers' },
          ].map((s, i) => (
            <div key={s.l} className="py-8 text-center"
              style={{ borderRight: i < 3 ? '1px solid #e8e8e8' : 'none' }}>
              <p className="text-3xl font-black mb-1" style={{ fontFamily: 'Outfit, sans-serif', color: '#E6900E' }}>{s.v}</p>
              <p className="text-sm" style={{ color: '#737373' }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ───────────────────────────── */}
      <section className="relative overflow-hidden py-16 md:py-28 px-4 md:px-14" style={{ background: '#fff' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: LIGHT_GRADIENT }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="mb-10 md:mb-16">
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: '#E6900E' }}>Why FutaRide</p>
            <h2 className="text-3xl md:text-5xl font-black" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Built for FUTA.<br />Designed for trust.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: '#e8e8e8' }}>
            {FEATURES.map(f => (
              <div key={f.title} className="p-8 flex flex-col gap-6" style={{ background: '#fff' }}>
                <span className="text-xs font-mono" style={{ color: '#a3a3a3' }}>{f.n}</span>
                <div>
                  <h3 className="text-base font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif', color: '#1a1a1a' }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#737373' }}>{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────── */}
      <section className="py-16 md:py-28 px-4 md:px-14" style={{ background: '#161616' }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: '#E6900E' }}>How it works</p>
            <h2 className="text-3xl md:text-5xl font-black mb-5" style={{ fontFamily: 'Outfit, sans-serif', color: '#fff' }}>
              Three steps.<br />Zero friction.
            </h2>
            <p className="text-base mb-10" style={{ color: '#666', lineHeight: '1.7' }}>
              From request to pickup — the whole flow is designed to be simple, fast, and transparent.
            </p>
            <button onClick={() => setView('student')}
              className="px-6 py-3 rounded-xl font-bold text-sm hover:opacity-90"
              style={{ background: '#E6900E', color: '#fff' }}>
              Try it now
            </button>
          </div>
          <div className="space-y-px" style={{ background: '#2a2a2a' }}>
            {STEPS.map(s => (
              <div key={s.n} className="flex items-start gap-6 p-7" style={{ background: '#1e1e1e' }}>
                <span className="text-xs font-mono flex-shrink-0 mt-0.5" style={{ color: '#E6900E' }}>{s.n}</span>
                <div>
                  <h4 className="text-sm font-bold mb-1.5" style={{ color: '#fff' }}>{s.title}</h4>
                  <p className="text-sm leading-relaxed" style={{ color: '#666' }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Campus hubs ────────────────────────── */}
      <section className="relative overflow-hidden py-16 md:py-28 px-4 md:px-14" style={{ background: '#fff' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: LIGHT_GRADIENT }} />
        <div className="relative max-w-5xl mx-auto grid md:grid-cols-2 gap-10 md:gap-20 items-center">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: '#E6900E' }}>Fixed & curated</p>
            <h2 className="text-3xl md:text-4xl font-black mb-5" style={{ fontFamily: 'Outfit, sans-serif' }}>
              8 hubs.<br />Zero guesswork.
            </h2>
            <p className="text-base mb-10" style={{ color: '#737373', lineHeight: '1.7' }}>
              No GPS. Every pickup and drop-off is a named, recognized landmark. Drivers always know where to go.
            </p>
            <button onClick={() => setView('student')}
              className="px-5 py-3 rounded-xl font-semibold text-sm hover:opacity-90"
              style={{ background: '#1a1a1a', color: '#fff' }}>
              Book at a hub
            </button>
          </div>
          <div className="grid grid-cols-2 gap-px" style={{ background: '#e8e8e8' }}>
            {HUBS.map(hub => (
              <div key={hub} className="px-4 py-3 text-xs md:text-sm font-medium leading-snug" style={{ background: '#fff', color: '#1a1a1a' }}>
                {hub}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Role cards ─────────────────────────── */}
      <section className="relative overflow-hidden py-16 md:py-28 px-4 md:px-14" style={{ background: '#f7f7f7' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: LIGHT_GRADIENT }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="mb-10 md:mb-16 text-center">
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: '#E6900E' }}>Two portals</p>
            <h2 className="text-3xl md:text-4xl font-black" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Built for every role on campus.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">

            {/* Student */}
            <div className="rounded-2xl overflow-hidden bg-white" style={{ border: '1px solid #e8e8e8' }}>
              <div className="h-52 overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1694175271713-a6e2cc378980?w=700&h=300&fit=crop&auto=format"
                  alt="FUTA student"
                  className="w-full h-full object-cover"
                  style={{ opacity: 0.85 }}
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(22,22,22,0.65) 0%, transparent 65%)' }} />
                <p className="absolute bottom-5 left-6 text-2xl font-black text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Student
                </p>
              </div>
              <div className="p-7">
                <p className="text-sm mb-7" style={{ color: '#737373', lineHeight: '1.7' }}>
                  Book rides at fixed fares, track your driver in real time, and review your complete trip history.
                </p>
                <div className="space-y-0 mb-7" style={{ borderTop: '1px solid #f0f0f0' }}>
                  {['Fixed-fare ride booking', 'Live driver identity reveal', 'Ride history & audit trail', '3-minute auto-expiry'].map(f => (
                    <div key={f} className="py-3 text-sm" style={{ borderBottom: '1px solid #f0f0f0', color: '#1a1a1a' }}>
                      {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => setView('student')}
                  className="w-full py-3 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: '#E6900E', color: '#fff' }}>
                 SignUp as a Rider
                </button>
              </div>
            </div>

            {/* Driver */}
            <div className="rounded-2xl overflow-hidden bg-white" style={{ border: '1px solid #e8e8e8' }}>
              <div className="h-52 overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1559897752-11f80cef5173?w=700&h=300&fit=crop&auto=format"
                  alt="Keke tricycle"
                  className="w-full h-full object-cover"
                  style={{ opacity: 0.85 }}
                />
                <div className="absolute inset-0" style={{
                  background: [
                    'linear-gradient(to top, rgba(22,22,22,0.82) 0%, rgba(22,22,22,0.15) 55%, transparent 75%)',
                    'linear-gradient(135deg, rgba(230,144,14,0.45) 0%, transparent 45%)',
                    'radial-gradient(ellipse 70% 60% at 90% 0%, rgba(245,196,30,0.2) 0%, transparent 60%)',
                  ].join(', ')
                }} />
                <p className="absolute bottom-5 left-6 text-2xl font-black text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Driver
                </p>
              </div>
              <div className="p-7">
                <p className="text-sm mb-7" style={{ color: '#737373', lineHeight: '1.7' }}>
                  Toggle online, receive ride alerts, accept with one tap, and track your daily earnings.
                </p>
                <div className="space-y-0 mb-7" style={{ borderTop: '1px solid #f0f0f0' }}>
                  {['Online/offline toggle', 'Incoming ride queue', 'One-tap acceptance', 'Daily earnings summary'].map(f => (
                    <div key={f} className="py-3 text-sm" style={{ borderBottom: '1px solid #f0f0f0', color: '#1a1a1a' }}>
                      {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => setView('driver')}
                  className="w-full py-3 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: '#1a1a1a', color: '#fff' }}>
                  SignUp as a Driver
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: '#0a0a0a', minHeight: '480px' }}>
        {/* Photo card strip — full bleed background */}
        <div className="absolute inset-0 flex gap-2 px-2 py-2" style={{ pointerEvents: 'none' }}>
          {[
            { src: 'https://images.unsplash.com/photo-1620829813573-7c9e1877706f?w=400&h=600&fit=crop&auto=format', label: 'Student', mobileHide: true },
            { src: 'https://images.unsplash.com/photo-1654762550505-7c58277e0fac?w=400&h=600&fit=crop&auto=format', label: 'Campus Ride', mobileHide: false },
            { src: 'https://images.unsplash.com/photo-1572816225927-d08fb138f2b2?w=400&h=600&fit=crop&auto=format', label: 'Keke', mobileHide: false },
            { src: 'https://images.unsplash.com/photo-1529171918672-ba6d0733a56c?w=400&h=600&fit=crop&auto=format', label: 'Driver', mobileHide: false },
            { src: 'https://images.unsplash.com/photo-1686213011624-8578b598ef0f?w=400&h=600&fit=crop&auto=format', label: 'Graduate', mobileHide: true },
          ].map(({ src, label, mobileHide }) => (
            <div key={label} className={`relative flex-1 rounded-xl overflow-hidden${mobileHide ? ' hidden md:block' : ''}`}>
              <img src={src} alt={label} className="w-full h-full object-cover" style={{ opacity: 0.7 }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)' }} />
              <span className="absolute bottom-3 left-4 text-xs font-medium text-white" style={{ opacity: 0.7 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Global dark overlay for text readability */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none'
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 md:px-6 py-20 md:py-28">
          <h2 className="text-3xl md:text-5xl font-black mb-4 md:mb-5 text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            No more roadside haggling.
          </h2>
          <p className="text-base mb-10 max-w-md" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: '1.7' }}>
            Free for FUTA students. Pay your locked fare in cash on arrival.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={() => setView('student')}
              className="px-7 py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all"
              style={{ background: '#E6900E', color: '#fff' }}>
              Book a Ride
            </button>
            <button onClick={() => setView('driver')}
              className="px-7 py-3.5 rounded-xl font-semibold text-sm transition-all hover:bg-white/10"
              style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
              I'm a Driver
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <footer style={{ background: '#0f0f0f' }}>
        <div className="max-w-5xl mx-auto px-4 md:px-14 pt-12 pb-8 md:pt-16 md:pb-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 md:gap-10">

          {/* Logo col */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <button onClick={handleLogoTap} className="select-none mb-4 block">
              <img src="/src/assets/logo-white.png" alt="FutaRide" className="h-7 w-auto" />
            </button>
            <p className="text-xs leading-relaxed" style={{ color: '#666', maxWidth: '180px' }}>
              Campus Keke dispatch for Federal University of Technology, Akure.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#fff' }}>Navigation</p>
            <ul className="space-y-3">
              {[
                { label: 'Book a Ride', action: () => setView('student') },
                { label: 'Driver Portal', action: () => setView('driver') },
              ].map(l => (
                <li key={l.label}>
                  <button onClick={l.action} className="text-sm transition-colors hover:text-white" style={{ color: '#666' }}>
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#fff' }}>Platform</p>
            <ul className="space-y-3">
              {['Fixed Fares', 'Live Dispatch', 'Verified Drivers', 'Ride History'].map(l => (
                <li key={l}>
                  <span className="text-sm" style={{ color: '#666' }}>{l}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#fff' }}>Legal</p>
            <ul className="space-y-3">
              {['Privacy Policy', 'Terms of Service', 'Security'].map(l => (
                <li key={l}>
                  <span className="text-sm" style={{ color: '#666' }}>{l}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#fff' }}>Contact</p>
            <ul className="space-y-3">
              <li className="text-sm leading-relaxed" style={{ color: '#666' }}>
                FUTA Campus, Akure,<br />Ondo State, Nigeria
              </li>
              <li>
                <span className="text-sm" style={{ color: '#666' }}>futaride@org.com</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="max-w-5xl mx-auto px-6 md:px-14 py-5" style={{ borderTop: '1px solid #1f1f1f' }}>
          <p className="text-xs" style={{ color: '#444' }}>
            © 2025 FutaRide. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
