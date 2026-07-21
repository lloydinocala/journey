import { useState, useEffect, useRef } from 'react'
import { supabase } from './utils/supabase'

// Shift-level clock. Records compensable "hours worked" — the legally
// defensible number (includes travel between jobs, shop time, waiting).
// One open shift = a time_clock_events row with clock_in set and clock_out null.
//
// Props:
//   userId, orgId  — whose clock and which org
//   variant        — 'mobile' | 'desktop' (styling only)
//   onChange       — optional callback after a clock action
export default function ClockWidget({ userId, orgId, variant = 'mobile', onChange }) {
  const [openShift, setOpenShift] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  const tick = useRef(null)

  useEffect(() => {
    if (userId) loadOpenShift()
    return () => { if (tick.current) clearInterval(tick.current) }
  }, [userId])

  // Refresh when another surface (e.g. the login popup) changes clock state.
  useEffect(() => {
    function onClockChanged() { if (userId) loadOpenShift() }
    window.addEventListener('clock-changed', onClockChanged)
    return () => window.removeEventListener('clock-changed', onClockChanged)
  }, [userId])

  // live elapsed timer while clocked in
  useEffect(() => {
    if (openShift) {
      tick.current = setInterval(() => setNow(Date.now()), 1000 * 30)
      return () => clearInterval(tick.current)
    }
  }, [openShift])

  async function loadOpenShift() {
    setLoading(true)
    const { data } = await supabase
      .from('time_clock_events')
      .select('*')
      .eq('user_id', userId)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
    setOpenShift(data && data.length > 0 ? data[0] : null)
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
    setBusy(true)
    const { error } = await supabase.from('time_clock_events')
      .update({ clock_out: new Date().toISOString() })
      .eq('id', openShift.id)
    setBusy(false)
    if (error) { alert('Could not clock out: ' + error.message); return }
    setOpenShift(null)
    if (onChange) onChange()
  }

  function elapsedLabel() {
    if (!openShift?.clock_in) return ''
    const mins = Math.max(0, Math.floor((now - new Date(openShift.clock_in).getTime()) / 60000))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  // Flag a shift that's been open a very long time (likely forgot to clock out).
  const longOpen = openShift?.clock_in && (now - new Date(openShift.clock_in).getTime()) > 16 * 3600 * 1000

  if (loading) return null

  if (variant === 'desktop') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {openShift ? (
          <>
            <span style={{ fontSize: 13, color: 'var(--mist)' }}>
              Clocked in · <strong>{elapsedLabel()}</strong>
              {longOpen && <span style={{ color: 'var(--alert-orange)', marginLeft: 6 }}>⚠ still open</span>}
            </span>
            <button className="logout-button" disabled={busy} onClick={clockOut}>Clock Out</button>
          </>
        ) : (
          <button className="auth-button" style={{ width: 'auto', padding: '6px 16px', margin: 0 }} disabled={busy} onClick={clockIn}>
            Clock In
          </button>
        )}
      </div>
    )
  }

  // mobile
  return (
    <div style={{ padding: '0 14px', marginBottom: 12 }}>
      {openShift ? (
        <button
          onClick={clockOut}
          disabled={busy}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: '#B00020', color: '#fff', fontWeight: 800, fontSize: 17,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>Clock Out</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {elapsedLabel()}{longOpen ? ' ⚠' : ''}
          </span>
        </button>
      ) : (
        <button
          onClick={clockIn}
          disabled={busy}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: '#1F7A43', color: '#fff', fontWeight: 800, fontSize: 17,
          }}
        >
          Clock In
        </button>
      )}
    </div>
  )
}
