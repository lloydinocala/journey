import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

// Convert a timestamp to the value a datetime-local input expects (local time).
function toLocalInput(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 16)
}

function hoursBetween(a, b) {
  if (!a || !b) return null
  const ms = new Date(b).getTime() - new Date(a).getTime()
  if (ms <= 0) return null
  return +(ms / 3600000).toFixed(2)
}

export default function TimeClock({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [employees, setEmployees] = useState([])
  const [editing, setEditing] = useState(null)      // event id being edited
  const [editIn, setEditIn] = useState('')
  const [editOut, setEditOut] = useState('')
  const [editNote, setEditNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [rangeDays, setRangeDays] = useState(14)

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [isSuperAdmin])

  useEffect(() => {
    if (selectedOrg) load()
  }, [selectedOrg, rangeDays])

  async function load() {
    setLoading(true)
    const since = new Date(Date.now() - rangeDays * 86400000).toISOString()
    const [evRes, empRes] = await Promise.all([
      supabase.from('time_clock_events').select('*').eq('org_id', selectedOrg).gte('clock_in', since).order('clock_in', { ascending: false }),
      supabase.from('users').select('id, full_name').eq('org_id', selectedOrg),
    ])
    setEvents(evRes.data || [])
    setEmployees(empRes.data || [])
    setLoading(false)
  }

  function empName(id) {
    const e = employees.find((x) => x.id === id)
    return e ? e.full_name : 'Employee'
  }

  const openShifts = events.filter((e) => !e.clock_out)
  const now = Date.now()
  // "Needs attention": open and clocked in more than 16 hours ago.
  const needsAttention = openShifts.filter((e) => now - new Date(e.clock_in).getTime() > 16 * 3600 * 1000)

  function startEdit(ev) {
    setEditing(ev.id)
    setEditIn(toLocalInput(ev.clock_in))
    setEditOut(toLocalInput(ev.clock_out))
    setEditNote('')
  }

  async function saveEdit(ev) {
    setBusy(true)
    // Preserve the originals the first time this row is corrected, so the
    // legal trail shows what was changed, by whom, and when.
    const patch = {
      clock_in: editIn ? new Date(editIn).toISOString() : null,
      clock_out: editOut ? new Date(editOut).toISOString() : null,
      edited_by: profile.id,
      edited_at: new Date().toISOString(),
      source: 'manual',
    }
    if (ev.original_clock_in == null && ev.original_clock_out == null) {
      patch.original_clock_in = ev.clock_in
      patch.original_clock_out = ev.clock_out
    }
    if (editNote.trim()) {
      patch.notes = (ev.notes ? ev.notes + ' | ' : '') + editNote.trim()
    }
    const { error } = await supabase.from('time_clock_events').update(patch).eq('id', ev.id)
    setBusy(false)
    if (error) { alert('Could not save: ' + error.message); return }
    setEditing(null)
    load()
  }

  async function forceClockOut(ev) {
    // Quick action for the open-shifts list: set clock_out to now (or let the
    // office edit it precisely afterward). Preserves original if first edit.
    if (!window.confirm(`Clock out ${empName(ev.user_id)} now? You can correct the exact time afterward.`)) return
    setBusy(true)
    const patch = {
      clock_out: new Date().toISOString(),
      edited_by: profile.id,
      edited_at: new Date().toISOString(),
      source: 'manual',
    }
    if (ev.original_clock_in == null && ev.original_clock_out == null) {
      patch.original_clock_in = ev.clock_in
      patch.original_clock_out = ev.clock_out
    }
    await supabase.from('time_clock_events').update(patch).eq('id', ev.id)
    setBusy(false)
    load()
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Time Clock</h1>
        {isSuperAdmin && <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />}
      </div>
      <p style={{ color: 'var(--mist)', marginTop: 4 }}>
        Review and correct clock entries. Corrections preserve the original times as a permanent record.
      </p>

      {/* NEEDS ATTENTION */}
      {needsAttention.length > 0 && (
        <div className="section-card" style={{ padding: 16, marginBottom: 16, borderLeft: '4px solid var(--alert-orange)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--alert-orange)' }}>⚠ Open shifts needing attention ({needsAttention.length})</h3>
          <p style={{ fontSize: 13, color: 'var(--mist)', marginTop: 0 }}>
            These employees clocked in more than 16 hours ago and never clocked out — likely forgotten.
          </p>
          {needsAttention.map((ev) => (
            <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <strong style={{ flex: 1, minWidth: 140 }}>{empName(ev.user_id)}</strong>
              <span style={{ fontSize: 13 }}>In: {fmt(ev.clock_in)}</span>
              <button className="logout-button" disabled={busy} onClick={() => forceClockOut(ev)}>Clock out now</button>
              <button className="logout-button" disabled={busy} onClick={() => startEdit(ev)}>Edit</button>
            </div>
          ))}
        </div>
      )}

      {/* CURRENTLY CLOCKED IN */}
      <div className="section-card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Currently clocked in ({openShifts.length})</h3>
        {openShifts.length === 0 ? (
          <p style={{ color: 'var(--mist)', margin: 0 }}>Nobody is clocked in right now.</p>
        ) : openShifts.map((ev) => (
          <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', flexWrap: 'wrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: '#1F7A43' }} />
            <strong style={{ flex: 1, minWidth: 140 }}>{empName(ev.user_id)}</strong>
            <span style={{ fontSize: 13, color: 'var(--mist)' }}>Since {fmt(ev.clock_in)}</span>
            <button className="logout-button" disabled={busy} onClick={() => forceClockOut(ev)}>Clock out</button>
          </div>
        ))}
      </div>

      {/* ALL ENTRIES */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>All entries</h3>
        <select value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? <p>Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {events.map((ev) => {
            const isEd = editing === ev.id
            const wasEdited = ev.edited_at != null
            const hrs = hoursBetween(ev.clock_in, ev.clock_out)
            return (
              <div key={ev.id} className="section-card" style={{ padding: 12 }}>
                {!isEd ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <strong style={{ flex: 1, minWidth: 140 }}>{empName(ev.user_id)}</strong>
                    <span style={{ fontSize: 13 }}>In: {fmt(ev.clock_in)}</span>
                    <span style={{ fontSize: 13 }}>Out: {fmt(ev.clock_out)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 60 }}>{hrs != null ? hrs + ' h' : '—'}</span>
                    <button className="logout-button" onClick={() => startEdit(ev)}>Edit</button>
                    {wasEdited && (
                      <span style={{ fontSize: 11, color: 'var(--alert-orange)', width: '100%' }}>
                        Corrected {fmt(ev.edited_at)} by {empName(ev.edited_by)} · original In {fmt(ev.original_clock_in)} / Out {fmt(ev.original_clock_out)}
                        {ev.notes ? ` · ${ev.notes}` : ''}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <strong>{empName(ev.user_id)}</strong>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <label>Clock in<br /><input type="datetime-local" value={editIn} onChange={(e) => setEditIn(e.target.value)} /></label>
                      <label>Clock out<br /><input type="datetime-local" value={editOut} onChange={(e) => setEditOut(e.target.value)} /></label>
                    </div>
                    <label>Reason for correction (recorded)<br />
                      <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="e.g. forgot to clock out; actual end 5pm" style={{ width: '100%', maxWidth: 400 }} />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="auth-button" style={{ width: 'auto', padding: '6px 16px', margin: 0 }} disabled={busy} onClick={() => saveEdit(ev)}>Save correction</button>
                      <button className="logout-button" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                    {(ev.original_clock_in != null || ev.original_clock_out != null) && (
                      <span style={{ fontSize: 11, color: 'var(--mist)' }}>
                        Original (already preserved): In {fmt(ev.original_clock_in)} / Out {fmt(ev.original_clock_out)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {events.length === 0 && <p style={{ color: 'var(--mist)' }}>No clock entries in this range.</p>}
        </div>
      )}
    </div>
  )
}

