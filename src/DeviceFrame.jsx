import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './deviceframe.css'

// On a desktop computer, the Field App (/tech/*) is shown inside a real phone- or tablet-sized
// screen so it looks exactly as it does on the device. The app runs in an iframe of that exact
// size, so the phone layout, fixed bars and screen-size rules all behave as they do on a phone.
// The toolbar switches Phone / Tablet / Full Screen; the choice is remembered on this computer.
const MODES = {
  phone: { w: 390, h: 844, bezel: 12, radius: 46, label: 'Phone' },
  tablet: { w: 820, h: 1180, bezel: 16, radius: 30, label: 'Tablet' },
}
const KEY = 'journey_field_view'
try { if (window.self !== window.top) document.documentElement.classList.add('df-inner') } catch { /* ignore */ }

// Only frame on a real desktop browser, and never inside the frame itself.
export function shouldFrame() {
  try {
    if (window.self !== window.top) return false
    const ua = navigator.userAgent || ''
    if (/Mobi|Android|iPhone|iPod|iPad|Windows Phone/i.test(ua)) return false
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return false // iPad in desktop mode
    return window.innerWidth >= 900
  } catch { return false }
}

function readMode() {
  try { const v = localStorage.getItem(KEY); return v === 'tablet' || v === 'full' ? v : 'phone' } catch { return 'phone' }
}

export default function DeviceFrame({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setModeState] = useState(readMode)
  const [landscape, setLandscape] = useState(false)
  const [scale, setScale] = useState(1)
  const stageRef = useRef(null)
  const frameRef = useRef(null)
  // The page the frame opens on. Fixed once per mount so later route syncing doesn't reload the frame.
  const [src, setSrc] = useState(() => location.pathname + location.search + location.hash)

  function setMode(m) {
    const here = window.location.pathname + window.location.search + window.location.hash
    if (mode === 'full' && m !== 'full') setSrc(here)
    // The frame may have moved to another screen; bring the full-screen view to the same one.
    if (m === 'full' && mode !== 'full' && here !== location.pathname + location.search + location.hash) navigate(here, { replace: true })
    setModeState(m)
    try { localStorage.setItem(KEY, m) } catch { /* private mode */ }
  }

  const spec = MODES[mode]
  const w = spec ? (landscape && mode === 'tablet' ? spec.h : spec.w) : 0
  const h = spec ? (landscape && mode === 'tablet' ? spec.w : spec.h) : 0

  // Shrink the device to fit the window (the screen inside keeps its true size).
  useLayoutEffect(() => {
    if (!spec) return
    const fit = () => {
      const el = stageRef.current
      if (!el) return
      const availW = el.clientWidth - 32
      const availH = el.clientHeight - 32
      const outerW = w + spec.bezel * 2
      const outerH = h + spec.bezel * 2
      setScale(Math.min(1, availW / outerW, availH / outerH))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [mode, landscape, w, h]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the address bar in step with the screen inside, and leave the frame when the
  // app inside goes to the office (desktop) side.
  useEffect(() => {
    if (!spec) return
    let last = ''
    const t = setInterval(() => {
      try {
        const loc = frameRef.current?.contentWindow?.location
        if (!loc || loc.href === 'about:blank') return
        const path = loc.pathname + loc.search + loc.hash
        if (path === last) return
        last = path
        if (!(loc.pathname === '/tech' || loc.pathname.startsWith('/tech/'))) { window.location.assign(path); return }
        if (path !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, '', path)
      } catch { /* not readable yet */ }
    }, 400)
    return () => clearInterval(t)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const bar = (
    <div className="df-bar">
      <div className="df-seg" role="tablist" aria-label="Field App view">
        {[['phone', 'Phone'], ['tablet', 'Tablet'], ['full', 'Full Screen']].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>
      {mode === 'tablet' && <button type="button" className="df-btn" onClick={() => setLandscape((v) => !v)}>{landscape ? '↻ Portrait' : '↻ Landscape'}</button>}
      {spec && <button type="button" className="df-btn" onClick={() => { try { frameRef.current?.contentWindow?.location.reload() } catch { /* ignore */ } }}>⟳ Reload</button>}
      <a className="df-btn" href="/">← Desktop</a>
    </div>
  )

  if (!spec) {
    return (
      <>
        {children}
        <div className="df-float">{bar}</div>
      </>
    )
  }

  return (
    <div className="df-page">
      {bar}
      <div className="df-stage" ref={stageRef}>
        <div className="df-scaler" style={{ width: (w + spec.bezel * 2) * scale, height: (h + spec.bezel * 2) * scale }}>
          <div className={`df-device ${mode}`} style={{ padding: spec.bezel, borderRadius: spec.radius, transform: `scale(${scale})` }}>
            <iframe
              ref={frameRef}
              title="Field App"
              src={src}
              allow="microphone; camera; geolocation; clipboard-write"
              style={{ width: w, height: h, borderRadius: spec.radius - spec.bezel + 2 }}
            />
          </div>
        </div>
        <div className="df-size">{w} × {h}{scale < 1 ? ` · shown at ${Math.round(scale * 100)}%` : ''}</div>
      </div>
    </div>
  )
}
