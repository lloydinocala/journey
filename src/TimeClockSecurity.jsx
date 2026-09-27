// Time Clock · Security log surfacing + alerting.
// Shows device-binding events (new device, device switch, rapid switching,
// off-site punches) recorded server-side, most urgent first, with an alert banner
// for unacknowledged RED events (rapid device switching — the account-sharing
// signal). Office/admin can acknowledge each. Read-only on the events themselves.
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './utils/supabase'

const KIND = {
  new_device: { label: 'New device registered', hint: 'first time this device was used' },
  device_switch: { label: 'Switched devices', hint: 'moved to a different device' },
  rapid_switch: { label: 'Rapid device switching', hint: 'flipped between devices within 24h — possible account sharing' },
  offsite_punch: { label: 'Clocked in off-site', hint: 'punch outside a known job/shop location' },
  concurrent_blocked: { label: 'Blocked second device', hint: 'a second device was locked out' },
}
const fmt = (ts) => (ts ? new Date(ts).toLocaleString() : '—')

export default function TimeClockSecurity({ orgId, userId }) {
  const [events, setEvents] = useState([])
  const [names, setNames] = useState({})
  const [devices, setDevices] = useState({})
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [open, setOpen] = useState(true)

  async function load() {
    if (!orgId) return
    setLoading(true)
    const [ev, us, dv] = await Promise.all([
      supabase.from('timeclock_security_events').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(100),
      supabase.from('users').select('id, full_name').eq('org_id', orgId),
      supabase.from('user_devices').select('device_id, label').eq('org_id', orgId),
    ])
    setEvents(ev.data || [])
    setNames(Object.fromEntries((us.data || []).map((u) => [u.id, u.full_name])))
    setDevices(Object.fromEntries((dv.data || []).map((d) => [d.device_id, d.label])))
    setLoading(false)
  }
  useEffect(() => { load() }, [orgId])

  const openRed = useMemo(() => events.filter((e) => e.severity === 'red' && !e.acknowledged_at), [events])
  const devName = (id) => (id ? (devices[id] || (id.slice(0, 8) + '…')) : '—')

  async function acknowledge(ids) {
    setBusy(Array.isArray(ids) ? 'all' : ids)
    await supabase.from('timeclock_security_events')
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: userId || null })
      .in('id', Array.isArray(ids) ? ids : [ids])
    setBusy('')
    load()
  }

  if (!orgId) return null

  return (
    <div className="section-card" style={{ padding: 16, marginBottom: 16, borderLeft: `4px solid ${openRed.length ? '#B00020' : '#1B3A6B'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button className="logout-button" onClick={() => setOpen(!open)}>{open ? 'Hide device security' : '🔐 Device security log'}</button>
        <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 'auto', color: openRed.length ? '#B00020' : '#166534' }}>
          {openRed.length ? `⚠ ${openRed.length} security alert${openRed.length === 1 ? '' : 's'} to review` : 'No open alerts'}
        </span>
      </div>

      {openRed.length > 0 && (
        <div style={{ marginTop: 10, background: '#FBE7E7', border: '1px solid #E3B0B0', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ color: '#B00020', fontSize: 13.5 }}>
              Rapid device switching detected — {[...new Set(openRed.map((e) => names[e.user_id] || 'employee'))].join(', ')}
            </strong>
            <button className="auth-button" style={{ width: 'auto', margin: '0 0 0 auto', padding: '5px 12px' }} disabled={busy === 'all'}
              onClick={() => acknowledge(openRed.map((e) => e.id))}>{busy === 'all' ? 'Clearing…' : 'Acknowledge all'}</button>
          </div>
          <div style={{ fontSize: 12, color: '#7A1420', marginTop: 4 }}>Someone signed in on multiple devices back-and-forth. Confirm it's legitimate (new phone) or follow up.</div>
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12 }}>
          {loading ? <p style={{ color: 'var(--mist)', fontSize: 13, margin: 0 }}>Loading…</p> : events.length === 0 ? (
            <p style={{ color: 'var(--mist)', fontSize: 13, margin: 0 }}>No device-security events recorded.</p>
          ) : (
            <table className="data-table" style={{ fontSize: 12.5 }}>
              <thead><tr><th>When</th><th>Employee</th><th>Event</th><th>Device</th><th></th></tr></thead>
              <tbody>
                {events.slice(0, 40).map((e) => {
                  const k = KIND[e.kind] || { label: e.kind, hint: '' }
                  const red = e.severity === 'red'
                  const ackd = !!e.acknowledged_at
                  return (
                    <tr key={e.id} style={red && !ackd ? { background: '#FCF0F0' } : undefined}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--mist)' }}>{fmt(e.created_at)}</td>
                      <td style={{ fontWeight: 600, color: '#152238' }}>{names[e.user_id] || 'Employee'}</td>
                      <td>
                        <span style={{ fontWeight: red ? 700 : 400, color: red ? '#B00020' : '#334155' }}>{red ? '⚠ ' : ''}{k.label}</span>
                        <div style={{ fontSize: 11, color: 'var(--mist)' }}>{k.hint}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {e.detail?.from_device ? <span style={{ color: 'var(--mist)' }}>{devName(e.detail.from_device)} → </span> : null}
                        <strong>{devName(e.detail?.to_device || e.device_id)}</strong>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {ackd ? <span style={{ color: '#166534', fontSize: 11.5 }}>✓ acknowledged</span>
                          : <button className="logout-button" style={{ padding: '3px 10px', fontSize: 11.5 }} disabled={busy === e.id} onClick={() => acknowledge(e.id)}>{busy === e.id ? '…' : 'Acknowledge'}</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
