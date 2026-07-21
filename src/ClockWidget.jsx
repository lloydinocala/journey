import { useState, useEffect, useRef } from 'react'
import { supabase } from './utils/supabase'

// Shift-level clock with nested breaks (Option A). Records compensable
// "hours worked" — the legally defensible number. One open shift = a
// time_clock_events row with clock_in set and clock_out null. A lunch break
// is a clock_breaks row nested inside that shift; unpaid breaks are subtracted
// from paid hours later.
//
// Props: userId, orgId, variant ('mobile'|'desktop'), onChange
export default function ClockWidget({ userId, orgId, variant = 'mobile', onChange }) {
  const [openShift, setOpenShift] = useState(null)
  const [openBreak, setOpenBreak] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  const tick = useRef(null)

  useEffect(() => {
    if (userId) loadState()
    return () => { if (tick.current) clearInterval(tick.current) }
  }, [userId])

  useEffect(() => {
    function onClockChanged() { if (userId) loadState() }
    window.addEventListener('clock-changed', onClockChanged)
    return () => window.removeEventListener('clock-changed', onClockChanged)
  }, [userId])

  useEffect(() => {
    if (openShift) {
      tick.current = setInterval(() => setNow(Date.now()), 1000 * 30)
      return () => clearInterval(tick.current)
    }
  }, [openShift])

  async function loadState() {
    setLoading(true)
    const { data: shifts } = await supabase
      .from('time_clock_events')
      .select('*')
      .eq('user_id', userId)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
    const shift = shifts && shifts.length > 0 ? shifts[0] : null
    setOpenShift(shift)

    if (shift) {
      const { data: breaks } = await supabase
        .from('clock_breaks')
        .select('*')
        .eq('clock_event_id', shift.id)
        .is('break_end', null)
        .limit(1)
      setOpenBreak(breaks && breaks.length > 0 ? breaks[0] : null)
    } else {
      setOpenBreak(null)
    }
    setLoading(false)
  }

  async function clockIn() {
    if (!userId || !orgId) { alert('Missing user or organization.'); return }
    setBusy(true)
    const { data, error } = await supabase.from('time_clock_events').insert({
      org_id: orgId,
      user_id: userId,
      clock_in: new Date().toISOString(),
      source: variant === 'desktop' ? 'desktop' : 'mobile',
    }).select().single()
    setBusy(false)
    if (error) { alert('Could not clock in: ' + error.message); return }
    setOpenShift(data)
    if (onChange) onChange()
  }

  async function clockOut() {
    if (!openShift) return
    if (openBreak) await endBreak(true)
    setBusy(true)
    const { error } = await supabase.from('time_clock_events')
      .update({ clock_out: new Date().toISOString() })
      .eq('id', openShift.id)
    setBusy(false)
    if (error) { alert('Could not clock out: ' + error.message); return }
    setOpenShift(null)
    setOpenBreak(null)
    if (onChange) onChange()
  }

  async function startBreak() {
    if (!openShift) return
    setBusy(true)
    const { data, error } = await supabase.from('clock_breaks').insert({
      org_id: orgId,
      clock_event_id: openShift.id,
      break_start: new Date().toISOString(),
      is_paid: false,
    }).select().single()
    setBusy(false)
    if (error) { alert('Could not start break: ' + error.message); return }
    setOpenBreak(data)
    if (onChange) onChange()
  }

  async function endBreak(silent) {
    if (!openBreak) return
    if (!silent) setBusy(true)
    const { error } = await supabase.from('clock_breaks')
      .update({ break_end: new Date().toISOString() })
      .eq('id', openBreak.id)
    if (!silent) setBusy(false)
    if (error && !silent) { alert('Could not end break: ' + error.message); return }
    setOpenBreak(null)
    if (onChange && !silent) onChange()
  }

  function elapsed(fromIso) {
    if (!fromIso) return ''
    const mins = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  const longOpen = openShift?.clock_in && (now - new Date(openShift.clock_in).getTime()) > 16 * 3600 * 1000

  if (loading) return null

  if (variant === 'desktop') {
    if (!openShift) {
      return (
        <button className="auth-button" style={{ width: 'auto', padding: '6px 16px', margin: 0 }} disabled={busy} onClick={clockIn}>
          Clock In
        </button>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--mist)' }}>
          {openBreak ? <>On lunch · <strong>{elapsed(openBreak.break_start)}</strong></> : <>Clocked in · <strong>{elapsed(openShift.clock_in)}</strong></>}
          {longOpen && <span style={{ color: 'var(--alert-orange)', marginLeft: 6 }}>⚠</span>}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {openBreak ? (
            <button className="auth-button" style={{ width: 'auto', padding: '5px 12px', margin: 0 }} disabled={busy} onClick={() => endBreak(false)}>End Lunch</button>
          ) : (
            <button className="logout-button" disabled={busy} onClick={startBreak}>Start Lunch</button>
          )}
          <button className="logout-button" disabled={busy} onClick={clockOut}>Clock Out</button>
        </div>
      </div>
    )
  }

  if (!openShift) {
    return (
      <div style={{ padding: '0 14px', marginBottom: 12 }}>
        <button onClick={clockIn} disabled={busy}
          style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: '#1F7A43', color: '#fff', fontWeight: 800, fontSize: 17 }}>
          Clock In
        </button>
      </div>
    )
  }
  return (
    <div style={{ padding: '0 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {openBreak ? (
        <button onClick={() => endBreak(false)} disabled={busy}
          style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: '#B8860B', color: '#fff', fontWeight: 800, fontSize: 17, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>End Lunch</span><span style={{ fontWeight: 600, fontSize: 15 }}>{elapsed(openBreak.break_start)}</span>
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={startBreak} disabled={busy}
            style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: '#F0AD4E', color: '#fff', fontWeight: 800, fontSize: 16 }}>
            Start Lunch
          </button>
          <button onClick={clockOut} disabled={busy}
            style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: '#B00020', color: '#fff', fontWeight: 800, fontSize: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Clock Out</span><span style={{ fontWeight: 600, fontSize: 13 }}>{elapsed(openShift.clock_in)}{longOpen ? ' ⚠' : ''}</span>
          </button>
        </div>
      )}
    </div>
  )
}
