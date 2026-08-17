import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// datetime <-> <input type="datetime-local"> (local time, no seconds)
function toLocalInput(d) {
  const dt = new Date(d)
  const off = dt.getTimezoneOffset() * 60000
  return new Date(dt - off).toISOString().slice(0, 16)
}
function fmt(iso) {
  return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function next7am() {
  const d = new Date()
  d.setSeconds(0, 0); d.setMinutes(0); d.setHours(7)
  if (new Date(d) <= new Date()) d.setDate(d.getDate() + 1)
  return d
}
function addDays(localInput, days) {
  const d = new Date(localInput); d.setDate(d.getDate() + days); return toLocalInput(d)
}

export default function OnCallSchedule({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [periods, setPeriods] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const [supId, setSupId] = useState('')
  const [techId, setTechId] = useState('')
  const [startVal, setStartVal] = useState('')
  const [endVal, setEndVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSuperAdmin) return
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
  }, [isSuperAdmin])

  useEffect(() => {
    if (selectedOrg) load()
  }, [selectedOrg])

  async function load() {
    setLoading(true)
    const [{ data: sched }, { data: us }] = await Promise.all([
      supabase.from('on_call_schedule').select('*').eq('org_id', selectedOrg).order('period_start'),
      supabase.from('users').select('id, full_name').eq('org_id', selectedOrg).eq('is_active', true).order('full_name'),
    ])
    setPeriods(sched || [])
    setUsers(us || [])
    const lastEnd = sched && sched.length ? sched[sched.length - 1].period_end : null
    const start = lastEnd ? toLocalInput(new Date(lastEnd)) : toLocalInput(next7am())
    setStartVal(start)
    setEndVal(addDays(start, 7))
    setLoading(false)
  }

  const nameOf = (id) => users.find((u) => u.id === id)?.full_name || '—'

  async function addPeriod(e) {
    e.preventDefault()
    setError('')
    if (!supId) { setError('Choose an on-call supervisor.'); return }
    if (!startVal || !endVal) { setError('Set a start and end.'); return }
    if (new Date(endVal) <= new Date(startVal)) { setError('End must be after start.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('on_call_schedule').insert({
      org_id: selectedOrg,
      period_start: new Date(startVal).toISOString(),
      period_end: new Date(endVal).toISOString(),
      supervisor_user_id: supId,
      tech_user_id: techId || null,
      created_by: profile.id,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setSupId(''); setTechId('')
    load()
  }

  async function removePeriod(id) {
    if (!window.confirm('Remove this on-call period?')) return
    await supabase.from('on_call_schedule').delete().eq('id', id)
    load()
  }

  function gapBefore(i) {
    if (i === 0) return null
    const prevEnd = new Date(periods[i - 1].period_end).getTime()
    const thisStart = new Date(periods[i].period_start).getTime()
    if (thisStart > prevEnd) return 'gap'
    if (thisStart < prevEnd) return 'overlap'
    return null
  }

  const nowMs = Date.now()

  return (
    <div className="page" style={{ maxWidth: 920 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h2 className="page-title" style={{ margin: 0 }}>On-Call Schedule</h2>
        {isSuperAdmin && <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />}
      </div>
      <p style={{ color: 'var(--mist)', marginTop: 8 }}>
        Set who's on call and when. Each period hands off nose-to-nose with the next &mdash; a new period's start defaults to the last one's end, so a coverage gap can't slip in by accident.
      </p>

      {isSuperAdmin && !selectedOrg ? (
        <p style={{ color: 'var(--mist)' }}>Pick an organization to view its on-call schedule.</p>
      ) : loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading&hellip;</p>
      ) : (
        <>
          {periods.length === 0 && <p style={{ color: 'var(--mist)' }}>No on-call periods scheduled yet &mdash; add the first one below.</p>}
          {periods.length > 0 && (
            <table className="data-table" style={{ marginBottom: 24 }}>
              <thead>
                <tr><th>Coverage</th><th>From</th><th>To</th><th>On-Call Supervisor</th><th>On-Call Tech</th><th></th></tr>
              </thead>
              <tbody>
                {periods.map((p, i) => {
                  const g = gapBefore(i)
                  const active = nowMs >= new Date(p.period_start).getTime() && nowMs < new Date(p.period_end).getTime()
                  return (
                    <tr key={p.id} style={active ? { background: 'var(--surface-2, #eaf5ec)' } : undefined}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {active && <span style={{ color: '#0B6E2E', fontWeight: 600 }}>&#9679; On now</span>}
                        {!active && g === 'gap' && <span style={{ color: 'var(--danger,#c0392b)' }}>&#9888; gap before</span>}
                        {!active && g === 'overlap' && <span style={{ color: 'var(--danger,#c0392b)' }}>&#9888; overlap</span>}
                        {!active && !g && <span style={{ color: 'var(--mist)' }}>&#10003;</span>}
                      </td>
                      <td>{fmt(p.period_start)}</td>
                      <td>{fmt(p.period_end)}</td>
                      <td>{nameOf(p.supervisor_user_id)}</td>
                      <td>{nameOf(p.tech_user_id)}</td>
                      <td><button className="logout-button" type="button" onClick={() => removePeriod(p.id)}>Remove</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <form onSubmit={addPeriod} style={{ border: '0.5px solid var(--border,#d0d0d0)', borderRadius: 10, padding: 16, maxWidth: 660 }}>
            <h3 style={{ marginTop: 0 }}>Add an on-call period</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 240px' }}>
                <label>On-Call Supervisor <span style={{ color: 'var(--mist)', fontWeight: 400 }}>(calls first)</span></label>
                <select value={supId} onChange={(e) => setSupId(e.target.value)}>
                  <option value="">Choose&hellip;</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: '1 1 240px' }}>
                <label>On-Call Tech <span style={{ color: 'var(--mist)', fontWeight: 400 }}>(backup)</span></label>
                <select value={techId} onChange={(e) => setTechId(e.target.value)}>
                  <option value="">Choose&hellip;</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 240px' }}>
                <label>Starts</label>
                <input type="datetime-local" value={startVal} onChange={(e) => setStartVal(e.target.value)} />
              </div>
              <div className="field" style={{ flex: '1 1 240px' }}>
                <label>Ends</label>
                <input type="datetime-local" value={endVal} onChange={(e) => setEndVal(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, margin: '2px 0 4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--mist)', alignSelf: 'center' }}>Length:</span>
              <button type="button" className="logout-button" onClick={() => setEndVal(addDays(startVal, 1))}>1 day</button>
              <button type="button" className="logout-button" onClick={() => setEndVal(addDays(startVal, 7))}>1 week</button>
              <button type="button" className="logout-button" onClick={() => { const d = new Date(startVal); d.setMonth(d.getMonth() + 1); setEndVal(toLocalInput(d)) }}>1 month</button>
            </div>
            {error && <p style={{ color: 'var(--danger,#c0392b)', fontSize: 13 }}>{error}</p>}
            <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto', marginTop: 10, padding: '8px 22px' }}>
              {saving ? 'Saving\u2026' : 'Add period'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
