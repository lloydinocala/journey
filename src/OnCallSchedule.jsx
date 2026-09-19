import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { useViewOrg } from './utils/viewOrg'

// datetime <-> <input type="datetime-local"> (local time, no seconds)
function toLocalInput(d) {
  const dt = new Date(d)
  const off = dt.getTimezoneOffset() * 60000
  return new Date(dt - off).toISOString().slice(0, 16)
}
function fmt(iso) {
  return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function shortDate(d) {
  return new Date(d).toLocaleDateString([], { month: 'numeric', day: 'numeric' })
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
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const PERIOD_COLORS = ['#2563EB', '#16A34A', '#EA580C', '#7C3AED', '#DB2777', '#CA8A04', '#0D9488', '#DC2626', '#0891B2', '#65A30D']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function OnCallSchedule({ profile }) {
  const { viewOrgId: selectedOrg } = useViewOrg()
  const [periods, setPeriods] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d })

  const [supId, setSupId] = useState('')
  const [techId, setTechId] = useState('')
  const [startVal, setStartVal] = useState('')
  const [endVal, setEndVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editSup, setEditSup] = useState('')
  const [editTech, setEditTech] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')

  useEffect(() => { if (selectedOrg) load() }, [selectedOrg]) // eslint-disable-line

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

  function startEdit(p) {
    setEditingId(p.id)
    setEditSup(p.supervisor_user_id || '')
    setEditTech(p.tech_user_id || '')
    setEditStart(toLocalInput(new Date(p.period_start)))
    setEditEnd(toLocalInput(new Date(p.period_end)))
    setError('')
  }
  function cancelEdit() { setEditingId(null); setError('') }

  async function saveEdit(id) {
    setError('')
    if (!editSup) { setError('Choose an on-call supervisor.'); return }
    if (!editStart || !editEnd) { setError('Set a start and end.'); return }
    if (new Date(editEnd) <= new Date(editStart)) { setError('End must be after start.'); return }
    const { error: err } = await supabase.from('on_call_schedule').update({
      supervisor_user_id: editSup,
      tech_user_id: editTech || null,
      period_start: new Date(editStart).toISOString(),
      period_end: new Date(editEnd).toISOString(),
    }).eq('id', id)
    if (err) { setError(err.message); return }
    setEditingId(null)
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
  const colorFor = (i) => PERIOD_COLORS[i % PERIOD_COLORS.length]

  // ---- Monthly calendar -------------------------------------------------
  function monthWeeks(monthDate) {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const gridStart = new Date(first); gridStart.setDate(1 - first.getDay())
    const weeks = []
    for (let w = 0; w < 6; w++) {
      const days = []
      for (let d = 0; d < 7; d++) { const dt = new Date(gridStart); dt.setDate(gridStart.getDate() + w * 7 + d); days.push(dt) }
      weeks.push(days)
    }
    // trim a trailing all-next-month week
    if (weeks[5].every((d) => d.getMonth() !== monthDate.getMonth())) weeks.pop()
    return weeks
  }
  function barsForWeek(weekDays) {
    const wkStart = startOfDay(weekDays[0]).getTime()
    const wkEnd = startOfDay(weekDays[6]).getTime() + 86400000 - 1
    const bars = []
    periods.forEach((p, idx) => {
      const ps = new Date(p.period_start).getTime(), pe = new Date(p.period_end).getTime()
      if (pe < wkStart || ps > wkEnd) return
      const startDay = Math.max(0, Math.floor((startOfDay(new Date(Math.max(ps, wkStart))).getTime() - wkStart) / 86400000))
      const endDay = Math.min(6, Math.floor((startOfDay(new Date(Math.min(pe, wkEnd))).getTime() - wkStart) / 86400000))
      bars.push({ idx, startDay, span: Math.max(1, endDay - startDay + 1), sup: nameOf(p.supervisor_user_id), tech: nameOf(p.tech_user_id), color: colorFor(idx), ps: p.period_start, pe: p.period_end })
    })
    return bars
  }
  const monthLabel = calMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })
  const weeks = monthWeeks(calMonth)

  function printCalendar() {
    const w = window.open('', '_blank', 'width=1000,height=800')
    if (!w) return
    const head = WEEKDAYS.map((d) => `<th style="border:1px solid #ccc;padding:4px;font-size:12px">${d}</th>`).join('')
    const body = weeks.map((week) => {
      const nums = week.map((d) => `<td style="border:1px solid #ccc;vertical-align:top;height:70px;width:14%;padding:3px;font-size:11px;color:${d.getMonth() === calMonth.getMonth() ? '#111' : '#bbb'}">${d.getDate()}</td>`).join('')
      const bars = barsForWeek(week).map((b) => `<tr><td colspan="7" style="padding:1px 3px"><div style="background:${b.color};color:#fff;font-size:10px;border-radius:4px;padding:1px 6px;margin-left:${(b.startDay / 7) * 100}%;width:${(b.span / 7) * 100}%;box-sizing:border-box;white-space:nowrap;overflow:hidden">${b.sup} ${shortDate(b.ps)}–${shortDate(b.pe)}${b.tech !== '—' ? ' / ' + b.tech : ''}</div></td></tr>`).join('')
      return `<tr>${nums}</tr>${bars}`
    }).join('')
    w.document.write(`<html><head><title>On-Call — ${monthLabel}</title></head><body style="font-family:system-ui,Arial,sans-serif;padding:20px"><h2>On-Call Schedule — ${monthLabel}</h2><table style="border-collapse:collapse;width:100%"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300)
  }

  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <h2 className="page-title" style={{ margin: 0 }}>On-Call Schedule</h2>
      <p style={{ color: 'var(--mist)', marginTop: 8, marginBottom: 4 }}>
        Set who's on call and when. Each period hands off nose-to-nose with the next &mdash; a new period's start defaults to the last one's end, so a coverage gap can't slip in by accident.
      </p>
      <p style={{ color: 'var(--mist)', marginTop: 0, fontStyle: 'italic', fontSize: 13 }}>
        Calendar is for visual scheduling only. It does not feed into Attendance or Payroll functions.
      </p>

      {!selectedOrg ? (
        <p style={{ color: 'var(--mist)' }}>Pick an organization to view its on-call schedule.</p>
      ) : loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading&hellip;</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Add-period form (left) */}
            <form onSubmit={addPeriod} style={{ border: '0.5px solid var(--border,#d0d0d0)', borderRadius: 10, padding: 16, flex: '0 0 300px', maxWidth: 320 }}>
              <h3 style={{ marginTop: 0 }}>Add an on-call period</h3>
              <div className="field">
                <label>On-Call Supervisor <span style={{ color: 'var(--mist)', fontWeight: 400 }}>(calls first)</span></label>
                <select value={supId} onChange={(e) => setSupId(e.target.value)}>
                  <option value="">Choose&hellip;</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>On-Call Tech <span style={{ color: 'var(--mist)', fontWeight: 400 }}>(backup)</span></label>
                <select value={techId} onChange={(e) => setTechId(e.target.value)}>
                  <option value="">Choose&hellip;</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Starts</label>
                <input type="datetime-local" value={startVal} onChange={(e) => setStartVal(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 6, margin: '2px 0 10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--mist)', alignSelf: 'center' }}>Length:</span>
                <button type="button" className="logout-button" onClick={() => setEndVal(addDays(startVal, 1))}>1 day</button>
                <button type="button" className="logout-button" onClick={() => setEndVal(addDays(startVal, 7))}>1 week</button>
                <button type="button" className="logout-button" onClick={() => { const d = new Date(startVal); d.setMonth(d.getMonth() + 1); setEndVal(toLocalInput(d)) }}>1 month</button>
              </div>
              <div className="field">
                <label>Ends</label>
                <input type="datetime-local" value={endVal} onChange={(e) => setEndVal(e.target.value)} />
              </div>
              {error && <p style={{ color: 'var(--danger,#c0392b)', fontSize: 13 }}>{error}</p>}
              <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto', marginTop: 4, padding: '8px 22px' }}>
                {saving ? 'Saving…' : 'Add period'}
              </button>
            </form>

            {/* Month calendar (right) */}
            <div style={{ flex: '1 1 560px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="logout-button" onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
                  <button className="logout-button" onClick={() => { const d = new Date(); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1)) }}>Month</button>
                  <button className="logout-button" onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
                  <strong style={{ fontSize: 18, marginLeft: 6 }}>{monthLabel}</strong>
                </div>
                <button className="logout-button" onClick={printCalendar}>🖨 Print Calendar</button>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--surface-2,#f6f7f9)', borderBottom: '1px solid var(--border)' }}>
                  {WEEKDAYS.map((d) => <div key={d} style={{ padding: '6px 8px', fontSize: 12, fontWeight: 700, color: 'var(--mist)', textAlign: 'left' }}>{d}</div>)}
                </div>
                {weeks.map((week, wi) => {
                  const bars = barsForWeek(week)
                  return (
                    <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: 'minmax(20px, auto)', borderBottom: wi < weeks.length - 1 ? '1px solid var(--border)' : 'none', rowGap: 2, paddingBottom: 4, position: 'relative' }}>
                      {week.map((d, di) => {
                        const inMonth = d.getMonth() === calMonth.getMonth()
                        const isToday = startOfDay(d).getTime() === startOfDay(new Date()).getTime()
                        return (
                          <div key={di} style={{ gridColumn: `${di + 1} / span 1`, gridRow: 1, minHeight: 26, padding: '3px 6px', borderLeft: di ? '1px solid var(--border)' : 'none', fontSize: 12, fontWeight: isToday ? 800 : 500, color: inMonth ? (isToday ? 'var(--sky,#2F5DE3)' : '#111826') : '#c2c8d0' }}>
                            {d.getDate()}
                          </div>
                        )
                      })}
                      {bars.map((b, bi) => (
                        <div key={'s' + bi} title={`${b.sup} · ${shortDate(b.ps)}–${shortDate(b.pe)}`}
                          style={{ gridColumn: `${b.startDay + 1} / span ${b.span}`, gridRow: 2, background: b.color, color: '#fff', fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 5, margin: '0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {b.sup} {shortDate(b.ps)}–{shortDate(b.pe)}
                        </div>
                      ))}
                      {bars.filter((b) => b.tech !== '—').map((b, bi) => (
                        <div key={'t' + bi} title={`Backup: ${b.tech}`}
                          style={{ gridColumn: `${b.startDay + 1} / span ${b.span}`, gridRow: 3, background: b.color + '99', color: '#fff', fontSize: 10.5, padding: '2px 7px', borderRadius: 5, margin: '0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {b.tech}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Editable list of periods */}
          <h3 style={{ marginTop: 26, marginBottom: 8 }}>All periods</h3>
          {periods.length === 0 ? (
            <p style={{ color: 'var(--mist)' }}>No on-call periods scheduled yet &mdash; add the first one on the left.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th></th><th>Coverage</th><th>From</th><th>To</th><th>On-Call Supervisor</th><th>On-Call Tech</th><th></th></tr>
              </thead>
              <tbody>
                {periods.map((p, i) => {
                  const g = gapBefore(i)
                  const active = nowMs >= new Date(p.period_start).getTime() && nowMs < new Date(p.period_end).getTime()
                  const editing = editingId === p.id
                  if (editing) {
                    return (
                      <tr key={p.id}>
                        <td><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: colorFor(i) }} /></td>
                        <td style={{ color: 'var(--mist)' }}>Editing</td>
                        <td><input type="datetime-local" value={editStart} onChange={(e) => setEditStart(e.target.value)} style={{ width: '100%' }} /></td>
                        <td><input type="datetime-local" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} style={{ width: '100%' }} /></td>
                        <td>
                          <select value={editSup} onChange={(e) => setEditSup(e.target.value)} style={{ width: '100%' }}>
                            <option value="">Choose&hellip;</option>
                            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={editTech} onChange={(e) => setEditTech(e.target.value)} style={{ width: '100%' }}>
                            <option value="">Choose&hellip;</option>
                            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                          </select>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="auth-button" type="button" onClick={() => saveEdit(p.id)} style={{ width: 'auto', padding: '4px 12px', marginRight: 6 }}>Save</button>
                          <button className="logout-button" type="button" onClick={cancelEdit}>Cancel</button>
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={p.id} style={active ? { background: 'var(--surface-2, #eaf5ec)' } : undefined}>
                      <td><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: colorFor(i) }} /></td>
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
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="logout-button" type="button" onClick={() => startEdit(p)} style={{ marginRight: 6 }}>Edit</button>
                        <button className="logout-button" type="button" onClick={() => removePeriod(p.id)}>Remove</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
