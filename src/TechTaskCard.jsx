import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { IconChevronLeft, IconPin, IconNavigation, IconList } from './MobileIcons'

const INCOMPLETE_REASONS = [
  'Destination closed or unavailable',
  'Item / parts not ready',
  'Ran out of time',
  'Weather or road conditions',
  'Redirected to an emergency',
  'Wrong or incomplete address',
  'Other',
]

function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) }
function taskMapsUrl(addr) { if (!addr) return null; const q = encodeURIComponent(addr); return isIOS() ? `https://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}` }
function taskGoogleUrl(addr) { if (!addr) return null; return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}` }
function taskStreetView(addr) { const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY; if (!addr || !key) return null; return `https://maps.googleapis.com/maps/api/streetview?size=640x300&location=${encodeURIComponent(addr)}&fov=80&pitch=0&key=${key}` }
function fmtDateTime(t) {
  if (!t) return { date: '', time: '' }
  const d = new Date(t); if (isNaN(d)) return { date: '', time: '' }
  return {
    date: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  }
}
function haversineMeters(a, b) {
  const R = 6371000, toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
// One-shot best-effort GPS read, used to stamp each button press.
function getPos() {
  return new Promise((res) => {
    if (!('geolocation' in navigator)) return res(null)
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  })
}
// Keyless US Census geocoder (CORS-enabled) — same primary path the job card uses.
async function geocodeAddress(address) {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`
    const r = await fetch(url)
    if (r.ok) {
      const j = await r.json()
      const c = j?.result?.addressMatches?.[0]?.coordinates
      if (c && typeof c.y === 'number' && typeof c.x === 'number') return { lat: c.y, lng: c.x }
    }
  } catch { /* ignore */ }
  return null
}

export default function TechTaskCard({ profile }) {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const geoWatchRef = useRef(null)
  const geoCleanupRef = useRef(null)

  const [task, setTask] = useState(null)
  const [part, setPart] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dark] = useState(() => { try { return localStorage.getItem('jc-theme') === 'dark' } catch { return false } })

  const [arrivalState, setArrivalState] = useState('armed') // 'armed' | 'off'
  const [arrivalDist, setArrivalDist] = useState(null)
  const [geoNote, setGeoNote] = useState('')

  const [showStop, setShowStop] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const [stopError, setStopError] = useState('')
  const [lockFlash, setLockFlash] = useState(false)

  async function loadTask() {
    setLoading(true)
    const { data } = await supabase.from('field_tasks').select('*').eq('id', taskId).single()
    setTask(data)
    if (data?.parts_order_id) {
      const { data: po } = await supabase
        .from('parts_orders')
        .select('id, part_description, part_number, po_number, delivery_verified, jobs ( job_number ), vendors ( name )')
        .eq('id', data.parts_order_id)
        .single()
      setPart(po || null)
    } else {
      setPart(null)
    }
    setLoading(false)
  }
  useEffect(() => { loadTask() }, [taskId])

  const status = task?.status || 'scheduled'

  async function updateStatus(newStatus, extra = {}) {
    if (!task) return
    setSaving(true)
    const now = new Date().toISOString()
    const patch = { status: newStatus, ...extra }
    if (newStatus === 'on_my_way') patch.on_my_way_at = now
    if (newStatus === 'in_progress') patch.started_at = now
    if (newStatus === 'completed' || newStatus === 'incomplete') patch.stopped_at = now
    const { error } = await supabase.from('field_tasks').update(patch).eq('id', taskId)
    if (!error) setTask((p) => ({ ...p, ...patch }))
    setSaving(false)
  }

  async function pressOnMyWay() {
    const c = await getPos()
    updateStatus('on_my_way', c ? { on_my_way_lat: c.lat, on_my_way_lng: c.lng } : {})
  }
  async function pressStart() {
    const c = await getPos()
    updateStatus('in_progress', c ? { started_lat: c.lat, started_lng: c.lng } : {})
  }

  // ---- GPS auto-start (best effort, same approach as the job card) ----
  const autoStartArmed = status === 'on_my_way'
  useEffect(() => {
    if (!autoStartArmed || !task) return
    let cancelled = false
    async function arm() {
      setArrivalState('armed'); setArrivalDist(null); setGeoNote('')
      const addr = task.address
      if (!addr || !('geolocation' in navigator)) { setArrivalState('off'); return }
      const dest = await geocodeAddress(addr)
      if (cancelled) return
      if (!dest) { setArrivalState('off'); return }
      const RING = 150
      const onFix = (pos, canFire) => {
        if (cancelled) return
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const d = haversineMeters(here, dest)
        const acc = pos.coords.accuracy || 0
        setArrivalDist(Math.round(d)); setGeoNote('')
        if (canFire && acc <= 500 && d <= RING + Math.min(acc, 250)) {
          updateStatus('in_progress', { started_lat: here.lat, started_lng: here.lng }); clearGeoWatch()
        }
      }
      const onErr = (err) => {
        if (err && err.code === 1) { setArrivalState('off'); return }
        setGeoNote(err && err.code === 2 ? 'waiting for GPS signal' : 'still locating')
      }
      const opts = { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
      const checkNow = () => navigator.geolocation.getCurrentPosition((pos) => onFix(pos, true), onErr, opts)
      const startWatch = () => { clearGeoWatch(); geoWatchRef.current = navigator.geolocation.watchPosition((pos) => onFix(pos, true), onErr, opts) }
      navigator.geolocation.getCurrentPosition((pos) => onFix(pos, false), () => {}, { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 })
      checkNow()
      startWatch()
      // Re-check + restart the watch when the app returns to the foreground (iOS
      // suspends it while backgrounded during the drive).
      const onVisible = () => { if (!cancelled && document.visibilityState === 'visible') { checkNow(); startWatch() } }
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('focus', onVisible)
      window.addEventListener('pageshow', onVisible)
      geoCleanupRef.current = () => {
        document.removeEventListener('visibilitychange', onVisible)
        window.removeEventListener('focus', onVisible)
        window.removeEventListener('pageshow', onVisible)
      }
    }
    arm()
    return () => { cancelled = true; clearGeoWatch(); if (geoCleanupRef.current) { geoCleanupRef.current(); geoCleanupRef.current = null } }
  }, [autoStartArmed, task?.id])
  function clearGeoWatch() { if (geoWatchRef.current != null) { navigator.geolocation.clearWatch(geoWatchRef.current); geoWatchRef.current = null } }

  function handleBack() {
    if (status === 'in_progress') { setLockFlash(true); setTimeout(() => setLockFlash(false), 2200); return }
    navigate('/tech')
  }

  function onStopMyTime() { setReason(''); setReasonNote(''); setStopError(''); setShowStop(true) }

  async function finishComplete() {
    const c = await getPos()
    await updateStatus('completed', c ? { stopped_lat: c.lat, stopped_lng: c.lng } : {})
    // A completed parts-pickup task marks the linked part Delivery Verified —
    // the pickup is done. The job itself is intentionally left unchanged.
    if (task.parts_order_id) {
      await supabase.from('parts_orders').update({ delivery_verified: true }).eq('id', task.parts_order_id)
      setPart((p) => (p ? { ...p, delivery_verified: true } : p))
    }
    setShowStop(false)
    clearGeoWatch()
  }
  async function finishIncomplete() {
    if (!reason) { setStopError('Please choose a reason so the office knows what happened.'); return }
    const full = reason === 'Other' ? (reasonNote.trim() || 'Other') : (reasonNote.trim() ? `${reason} — ${reasonNote.trim()}` : reason)
    const c = await getPos()
    await updateStatus('incomplete', { incomplete_reason: full, ...(c ? { stopped_lat: c.lat, stopped_lng: c.lng } : {}) })
    setShowStop(false)
    clearGeoWatch()
  }

  if (loading || !task) {
    return (
      <div className={`mobile-shell job-card-v2${dark ? ' jc-dark' : ''}`}>
        <div className="jc-header"><button className="jc-back" onClick={() => navigate('/tech')}><IconChevronLeft /></button></div>
        <div className="jc-body"><p className="jc-muted-note">Loading…</p></div>
      </div>
    )
  }

  const { date, time } = fmtDateTime(task.scheduled_at)
  const addr = task.address
  const mapImg = taskStreetView(addr)
  const dmaps = taskMapsUrl(addr)
  const gmaps = taskGoogleUrl(addr)

  const started = status === 'in_progress'
  const enRoute = status === 'on_my_way'
  const done = status === 'completed'
  const ended = status === 'completed' || status === 'incomplete'
  const omwClass = enRoute || started || ended ? 'blue' : 'red'
  const startClass = started || ended ? 'blue' : enRoute ? 'red' : 'idle'
  const stopClass = ended ? 'blue' : started ? 'red' : 'idle'
  const headStatus = done ? 'Complete' : status === 'incomplete' ? 'Incomplete' : 'Task'

  return (
    <div className={`mobile-shell job-card-v2${dark ? ' jc-dark' : ''}`}>
      <div className={`jc-header${done ? ' is-complete' : ''}`}>
        <button className="jc-back" onClick={handleBack}><IconChevronLeft /></button>
        <div className="jc-header-text">
          <div className="jc-title">{task.destination_name}</div>
          <div className="jc-sub">Task · {date}, {time}</div>
        </div>
        <span className={`jc-status ${done ? 'done' : ''}`}>{headStatus}</span>
      </div>

      <div className="jc-body">
        <a className="jc-property" href={dmaps || undefined} target="_blank" rel="noreferrer" style={{ pointerEvents: dmaps ? 'auto' : 'none' }}>
          {mapImg ? <img src={mapImg} alt="Destination" className="jc-property-img" /> : <div className="jc-property-fallback"><IconPin /> Destination</div>}
        </a>

        {/* Flow buttons */}
        <div className="jc-actions">
          <button className={`jc-flow-btn ${omwClass}`} disabled={status !== 'scheduled' || saving} onClick={pressOnMyWay}>On My Way</button>
          <button className={`jc-flow-btn ${startClass}`} disabled={status !== 'on_my_way' || saving} onClick={pressStart}>Start My Time</button>
          <button className={`jc-flow-btn ${stopClass}`} disabled={!started || saving} onClick={onStopMyTime}>Stop My Time</button>
        </div>
        {enRoute && (
          <div className={`jc-arrival ${arrivalState}`}>
            <span className="jc-arrival-dot" />
            {arrivalState === 'off'
              ? 'On the way — tap Start My Time when you arrive'
              : `On the way — starts automatically on arrival${arrivalDist != null ? ` · ${arrivalDist} m away` : geoNote ? ` · ${geoNote}` : ' · locating…'}`}
          </div>
        )}
        {lockFlash && <div className="jc-arrival off"><span className="jc-arrival-dot" />Press Stop My Time before leaving this task.</div>}

        {/* Destination */}
        <div className="jc-task">
          <div className="jc-task-head blue"><IconPin /><span className="jc-th-title">Destination</span></div>
          <div className="jc-task-body">
            <div className="jc-tenant-name">{task.destination_name}</div>
            {addr && (
              <div className="jc-address">
                <div className="jc-address-text">{addr}</div>
                <div className="jc-map-icons">
                  {dmaps && <a href={dmaps} target="_blank" rel="noreferrer" title="Device maps"><IconPin /></a>}
                  {gmaps && <a className="alt" href={gmaps} target="_blank" rel="noreferrer" title="Google Maps"><IconNavigation /></a>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Parts pickup (if this task is linked to a parts order) */}
        {part && (
          <div className="jc-task">
            <div className={`jc-task-head ${part.delivery_verified ? 'blue' : 'red'}`}>
              <IconList /><span className="jc-th-title">Parts Pickup{part.delivery_verified ? ' — Verified' : ''}</span>
            </div>
            <div className="jc-task-body">
              <div style={{ fontSize: 15, fontWeight: 600 }}>{part.part_description}{part.part_number ? ` (#${part.part_number})` : ''}</div>
              <div style={{ fontSize: 14, color: 'var(--jc-muted, #667)', marginTop: 2 }}>
                {[part.vendors?.name ? `From ${part.vendors.name}` : '', part.po_number ? `PO ${part.po_number}` : '', part.jobs?.job_number ? `Job ${part.jobs.job_number}` : ''].filter(Boolean).join(' · ')}
              </div>
              <div style={{ fontSize: 13, marginTop: 8, color: 'var(--jc-muted, #667)' }}>
                Completing this task marks the part picked up (Delivery Verified). It does not close the job.
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div className="jc-task">
            <div className="jc-task-head blue"><IconList /><span className="jc-th-title">Details</span></div>
            <div className="jc-task-body">
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.4 }}>{task.description}</div>
            </div>
          </div>
        )}

        {status === 'incomplete' && task.incomplete_reason && (
          <div className="jc-task">
            <div className="jc-task-head red"><IconList /><span className="jc-th-title">Reported Incomplete</span></div>
            <div className="jc-task-body"><div style={{ fontSize: 15 }}>{task.incomplete_reason}</div></div>
          </div>
        )}
      </div>

      {showStop && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1500 }} onClick={() => !saving && setShowStop(false)}>
          <div className="jc-stop-sheet" style={{ background: 'var(--jc-card, #fff)', width: '100%', maxWidth: 460, borderRadius: '16px 16px 0 0', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px' }}>Stopping this task</h3>
            <p style={{ margin: '0 0 14px', color: 'var(--jc-muted, #667)', fontSize: 14 }}>Did you finish, or is there an issue the office should know about?</p>
            <button className="jc-flow-btn blue" style={{ width: '100%', marginBottom: 12 }} disabled={saving} onClick={finishComplete}>Completed — no issues</button>
            <div style={{ borderTop: '1px solid var(--jc-line, #e5e7eb)', paddingTop: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Report an issue (marks Incomplete, alerts the office)</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%', padding: 10, marginBottom: 8 }}>
                <option value="">Select a reason…</option>
                {INCOMPLETE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input type="text" value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} placeholder="Add a note (optional)" style={{ width: '100%', padding: 10, marginBottom: 8, boxSizing: 'border-box' }} />
              {stopError && <div style={{ color: '#C0392B', fontSize: 13, marginBottom: 8 }}>{stopError}</div>}
              <button className="jc-flow-btn red" style={{ width: '100%' }} disabled={saving} onClick={finishIncomplete}>Stop &amp; Mark Incomplete</button>
            </div>
            <button className="jc-th-action" style={{ width: '100%', marginTop: 14 }} onClick={() => setShowStop(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
