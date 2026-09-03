import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

// Self-scheduling gateway. Availability, capacity (4/day), business hours, and the
// per-type minimum notice (repair same-day, estimate 4h, tune-up 2d, duct 3d) are
// all resolved server-side, so this screen only shows real, allowed openings.
const META = {
  repair:        { title: 'Service Call',           lead: 'Tell us what’s going on, then pick a time.',      note: 'Same-day service available for urgent issues.' },
  pm:            { title: 'Preventive Maintenance', lead: 'Pick a day and window for your tune-up.',          note: 'Please allow at least 2 days’ notice.' },
  duct_cleaning: { title: 'Duct Cleaning',          lead: 'Pick a day and window for your duct cleaning.',    note: 'Please allow at least 3 days’ notice.' },
  system_quote:  { title: 'Free Estimate',          lead: 'Pick a time for your free estimate.',              note: 'Available with about 4 hours’ notice.' },
}

function fmt(dstr) {
  const dt = new Date(dstr + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function CustomerBook({ properties }) {
  const nav = useNavigate()
  const { type } = useParams()

  // Duct cleaning first asks: cleaning, or an estimate for the cleaning?
  const [ductMode, setDuctMode] = useState(null) // 'clean' | 'estimate' | null
  const effectiveType = type === 'duct_cleaning'
    ? (ductMode === 'estimate' ? 'system_quote' : ductMode === 'clean' ? 'duct_cleaning' : null)
    : type
  const meta = META[effectiveType] || { title: 'Schedule a Visit', lead: 'Pick a day and window.', note: '' }

  const [propId, setPropId] = useState(properties[0]?.id || '')
  const [avail, setAvail] = useState(null) // null = loading
  const [day, setDay] = useState(null)
  const [win, setWin] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  useEffect(() => {
    if (!effectiveType) return
    let live = true
    setAvail(null); setDay(null); setWin('')
    supabase.rpc('get_booking_availability', { p_type: effectiveType, p_days: 30 }).then(({ data, error: err }) => {
      if (!live) return
      if (err) { setError(err.message); setAvail([]); return }
      setAvail(data || [])
    })
    return () => { live = false }
  }, [effectiveType])

  async function confirm() {
    if (!day || !win) { setError('Pick a day and a window first.'); return }
    if (effectiveType === 'repair' && !details.trim()) { setError('Please tell us what’s going on so we send the right tech.'); return }
    setBusy(true); setError('')
    const { data, error: err } = await supabase.rpc('book_appointment', {
      p_property_id: propId, p_type: effectiveType, p_date: day.d, p_window: win, p_details: details.trim() || null,
    })
    setBusy(false)
    if (err || !data) { setError((err?.message || 'Could not book that slot.') + ' Please try another time.'); return }
    setDone({ date: day.d, win })
  }

  // Duct cleaning: choose cleaning vs estimate before showing availability.
  if (type === 'duct_cleaning' && !ductMode) {
    return (
      <div className="cp-wrap">
        <button className="cp-back" onClick={() => nav('/portal/schedule')}>‹ Back</button>
        <h2 className="cp-h2">Duct Cleaning</h2>
        <p className="cp-lead">Are you booking the cleaning itself, or an estimate for it first?</p>
        <button className="cp-btn" onClick={() => setDuctMode('clean')}>Book the cleaning</button>
        <div style={{ height: 10 }} />
        <button className="cp-btn ghost" onClick={() => setDuctMode('estimate')}>Get an estimate first</button>
      </div>
    )
  }

  if (done) return (
    <div className="cp-wrap">
      <div className="cp-center">
        <div style={{ fontSize: 46 }}>✅</div>
        <h2 className="cp-h2">You’re booked</h2>
        <p className="cp-lead" style={{ maxWidth: 350 }}>
          {meta.title} on <b>{fmt(done.date)}</b>, {done.win === 'am' ? 'morning' : 'afternoon'}.
          We’ll confirm shortly, and your tech will arrive within that window.
        </p>
        <button className="cp-btn" style={{ maxWidth: 260 }} onClick={() => nav('/portal')}>Back to home</button>
      </div>
    </div>
  )

  const showQuestion = effectiveType !== 'system_quote'
  const qLabel = effectiveType === 'repair' ? 'What’s going on?'
    : effectiveType === 'pm' ? 'Is your equipment having any issues we should know about? (optional)'
    : 'Anything we should know? (optional)'
  const qPlaceholder = effectiveType === 'repair' ? 'e.g. AC is running but not cooling'
    : effectiveType === 'pm' ? 'e.g. weak airflow, an odd noise, higher bills…'
    : 'Gate codes, pets, access notes…'

  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => (type === 'duct_cleaning' ? setDuctMode(null) : nav('/portal/schedule'))}>‹ Back</button>
      <h2 className="cp-h2">{meta.title}</h2>
      <p className="cp-lead">{meta.lead}</p>

      {properties.length > 1 && (
        <>
          <div className="cp-label" style={{ marginTop: 0 }}>Property</div>
          <select className="cp-sel" value={propId} onChange={e => setPropId(e.target.value)}>
            {properties.map(p => (
              <option key={p.id} value={p.id}>
                {[p.street_address, p.unit].filter(Boolean).join(' ')}{p.city ? `, ${p.city}` : ''}
              </option>
            ))}
          </select>
        </>
      )}

      <div className="cp-label">Choose a day</div>
      {meta.note && <p className="cp-note" style={{ marginTop: 0 }}>{meta.note}</p>}
      {avail === null ? (
        <div className="cp-empty">Finding open times…</div>
      ) : avail.length === 0 ? (
        <div className="cp-card">
          <p style={{ margin: 0, fontSize: 14.5 }}>
            No open times in the next few weeks. Please call the office and we’ll fit you in.
          </p>
        </div>
      ) : (
        <div className="cp-chips">
          {avail.map(a => (
            <button key={a.d}
              className={`cp-chip ${day?.d === a.d ? 'on' : ''}`}
              onClick={() => { setDay(a); setWin(''); setError('') }}>
              {fmt(a.d)}
            </button>
          ))}
        </div>
      )}

      {day && (
        <>
          <div className="cp-label">Choose a window</div>
          <div className="cp-chips">
            {day.am_ok && (
              <button className={`cp-chip ${win === 'am' ? 'on' : ''}`} onClick={() => { setWin('am'); setError('') }}>Morning</button>
            )}
            {day.pm_ok && (
              <button className={`cp-chip ${win === 'pm' ? 'on' : ''}`} onClick={() => { setWin('pm'); setError('') }}>Afternoon</button>
            )}
          </div>

          {showQuestion && (
            <>
              <div className="cp-label">{qLabel}</div>
              <textarea className="cp-ta" value={details} onChange={e => setDetails(e.target.value)} placeholder={qPlaceholder} />
            </>
          )}
        </>
      )}

      {error && <div className="cp-err">{error}</div>}
      <div style={{ height: 12 }} />
      <button className="cp-btn" onClick={confirm} disabled={busy || !day || !win}>
        {busy ? 'Booking…' : 'Confirm booking'}
      </button>
      <p className="cp-note">We arrive within your chosen window. You can reschedule any time by calling the office.</p>
    </div>
  )
}
