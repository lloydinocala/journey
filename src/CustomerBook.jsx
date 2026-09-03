import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

// Self-scheduling. Availability, capacity, business hours, per-type weekday rules
// (repair Mon-Sat, others Mon-Fri) and per-type notice (repair same-day, estimate
// 4h, tune-up 2 business days, duct 3 business days) are all resolved server-side.
const META = {
  repair:        { title: 'Service Call',           lead: 'Tell us what’s going on, then pick a time.', note: 'Same-day service Mon–Sat. For Sunday emergencies, please call the office.' },
  pm:            { title: 'Preventive Maintenance', lead: 'Pick a day and window for your tune-up.',     note: 'Weekdays, with at least 2 business days’ notice.' },
  duct_cleaning: { title: 'Duct Cleaning',          lead: 'Pick a day for your duct cleaning.',          note: 'Weekdays. Duct cleanings begin at 9:00 AM.' },
  system_quote:  { title: 'Free Estimate',          lead: 'Pick a time for your free estimate.',         note: 'Weekdays, with about 4 hours’ notice.' },
}

function dparts(dstr) {
  const d = new Date(dstr + 'T00:00:00')
  return {
    dow: d.toLocaleDateString('en-US', { weekday: 'short' }),
    num: d.getDate(),
    mon: d.toLocaleDateString('en-US', { month: 'short' }),
  }
}
function fmtLong(dstr) {
  return new Date(dstr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
const AfternoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 18a5 5 0 00-10 0" /><path d="M12 2v7M4.9 10.9l1.4 1.4M19.1 10.9l-1.4 1.4M2 18h20M3 22h18" />
  </svg>
)

export default function CustomerBook({ properties }) {
  const nav = useNavigate()
  const { type } = useParams()

  const [ductMode, setDuctMode] = useState(null) // 'clean' | 'estimate' | null
  const effectiveType = type === 'duct_cleaning'
    ? (ductMode === 'estimate' ? 'system_quote' : ductMode === 'clean' ? 'duct_cleaning' : null)
    : type
  const meta = META[effectiveType] || { title: 'Schedule a Visit', lead: 'Pick a day and window.', note: '' }
  const amOnly = effectiveType === 'duct_cleaning'

  const [propId, setPropId] = useState(properties[0]?.id || '')
  const [avail, setAvail] = useState(null)
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

  function pickDay(a) {
    setDay(a)
    setWin(amOnly ? 'am' : '')
    setError('')
  }

  async function confirm() {
    if (!day) { setError('Pick a day first.'); return }
    if (!win) { setError('Pick a window first.'); return }
    if (effectiveType === 'repair' && !details.trim()) { setError('Please tell us what’s going on so we send the right tech.'); return }
    setBusy(true); setError('')
    const { data, error: err } = await supabase.rpc('book_appointment', {
      p_property_id: propId, p_type: effectiveType, p_date: day.d, p_window: win, p_details: details.trim() || null,
    })
    setBusy(false)
    if (err || !data) { setError((err?.message || 'Could not book that slot.') + ' Please try another time.'); return }
    setDone({ date: day.d, win })
  }

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
        <p className="cp-lead" style={{ maxWidth: 360 }}>
          {meta.title} on <b>{fmtLong(done.date)}</b>
          {amOnly ? <> at <b>9:00 AM</b>.</> : <>, {done.win === 'am' ? 'morning' : 'afternoon'}.</>}
          {' '}Our office will confirm the exact date and time with you.
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
          <p style={{ margin: 0, fontSize: 14.5 }}>No open times coming up. Please call the office and we’ll fit you in.</p>
        </div>
      ) : (
        <div className="cp-daygrid">
          {avail.map(a => {
            const dp = dparts(a.d)
            return (
              <button key={a.d} className={'cp-daycard' + (day?.d === a.d ? ' on' : '')} onClick={() => pickDay(a)}>
                <span className="dow">{dp.dow}</span>
                <span className="num">{dp.num}</span>
                <span className="mon">{dp.mon}</span>
              </button>
            )
          })}
        </div>
      )}

      {day && (
        <>
          {amOnly ? (
            <div className="cp-fixednote">
              <b>Morning appointment — 9:00 AM.</b><br />
              Duct cleanings begin at 9:00 AM. Our office will confirm the exact date and time with you.
            </div>
          ) : (
            <>
              <div className="cp-label">Choose a window</div>
              <div className="cp-winrow">
                {day.am_ok && (
                  <button className={'cp-wincard' + (win === 'am' ? ' on' : '')} onClick={() => { setWin('am'); setError('') }}>
                    <SunIcon /><span className="wlabel">Morning</span><span className="wsub">Before noon</span>
                  </button>
                )}
                {day.pm_ok && (
                  <button className={'cp-wincard' + (win === 'pm' ? ' on' : '')} onClick={() => { setWin('pm'); setError('') }}>
                    <AfternoonIcon /><span className="wlabel">Afternoon</span><span className="wsub">After noon</span>
                  </button>
                )}
              </div>
            </>
          )}

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

