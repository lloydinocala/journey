import { useState, useEffect, useRef } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// datetime <-> <input type="datetime-local"> (local time, no seconds)
function toLocalInput(d) {
  const dt = new Date(d)
  const off = dt.getTimezoneOffset() * 60000
  return new Date(dt - off).toISOString().slice(0, 16)
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
// Compact bar label, e.g. "10/2/26 7:00 AM"
function fmtShort(iso) {
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' })} ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}
function fmtLong(iso) {
  return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Distinct, readable bar colors (white text on all). Supervisor + tech in a
// period take two consecutive entries, so each period reads as a colored pair.
const PALETTE = ['#29A3C9', '#3FA84A', '#E08A46', '#C558A6', '#2E74C0', '#B5462F', '#C99A12', '#6A4FB6', '#0E8A6E', '#D0567F']

// Weeks (arrays of 7 Sun–Sat Dates) covering the given month.
function monthWeeks(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const start = new Date(first); start.setDate(1 - first.getDay()); start.setHours(0, 0, 0, 0)
  const weeks = []
  const cur = new Date(start)
  while (cur <= last || cur.getDay() !== 0) {
    const days = []
    for (let d = 0; d < 7; d++) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    weeks.push(days)
    if (weeks.length >= 6) break
  }
  return weeks
}
// Does a period cover any part of calendar day `d`?
function coversDay(p, d) {
  const ds = new Date(d); ds.setHours(0, 0, 0, 0)
  const de = new Date(ds); de.setDate(de.getDate() + 1)
  return new Date(p.period_start) < de && new Date(p.period_end) > ds
}

export default function OnCallSchedule({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [periods, setPeriods] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState('calendar')      // 'calendar' | 'map'
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [paper, setPaper] = useState('letter')       // 'letter' | 'legal'
  const [fitOne, setFitOne] = useState(true)
  const printRef = useRef(null)

  const [supId, setSupId] = useState('')
  const [techId, setTechId] = useState('')
  const [startVal, setStartVal] = useState('')
  const [endVal, setEndVal] = useState('')
  const [selectedId, setSelectedId] = useState(null)   // a period loaded into the form
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSuperAdmin) return
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
  }, [isSuperAdmin])

  useEffect(() => { if (selectedOrg) load() }, [selectedOrg])

  async function load() {
    setLoading(true)
    const [{ data: sched }, { data: us }] = await Promise.all([
      supabase.from('on_call_schedule').select('*').eq('org_id', selectedOrg).order('period_start'),
      supabase.from('users').select('id, full_name').eq('org_id', selectedOrg).eq('is_active', true).order('full_name'),
    ])
    setPeriods(sched || [])
    setUsers(us || [])
    resetForm(sched || [])
    setLoading(false)
  }

  function resetForm(sched) {
    const list = sched || periods
    const lastEnd = list.length ? list[list.length - 1].period_end : null
    const start = lastEnd ? toLocalInput(new Date(lastEnd)) : toLocalInput(next7am())
    setSelectedId(null); setSupId(''); setTechId('')
    setStartVal(start); setEndVal(addDays(start, 7)); setError('')
  }

  const nameOf = (id) => users.find((u) => u.id === id)?.full_name || '—'

  function selectPeriod(p) {
    setSelectedId(p.id)
    setSupId(p.supervisor_user_id || '')
    setTechId(p.tech_user_id || '')
    setStartVal(toLocalInput(new Date(p.period_start)))
    setEndVal(toLocalInput(new Date(p.period_end)))
    setError('')
  }

  function validate() {
    if (!supId) { setError('Choose an on-call supervisor.'); return false }
    if (!startVal || !endVal) { setError('Set a start and end.'); return false }
    if (new Date(endVal) <= new Date(startVal)) { setError('End must be after start.'); return false }
    return true
  }

  async function addPeriod(e) {
    if (e) e.preventDefault()
    setError('')
    if (!validate()) return
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
    load()
  }

  async function saveEdit() {
    setError('')
    if (!selectedId || !validate()) return
    setSaving(true)
    const { error: err } = await supabase.from('on_call_schedule').update({
      supervisor_user_id: supId,
      tech_user_id: techId || null,
      period_start: new Date(startVal).toISOString(),
      period_end: new Date(endVal).toISOString(),
    }).eq('id', selectedId)
    setSaving(false)
    if (err) { setError(err.message); return }
    load()
  }

  async function deletePeriod() {
    if (!selectedId) return
    if (!window.confirm('Delete this on-call period?')) return
    await supabase.from('on_call_schedule').delete().eq('id', selectedId)
    load()
  }

  // Gaps / overlaps between consecutive periods (nose-to-nose guardrail).
  const issues = []
  for (let i = 1; i < periods.length; i++) {
    const prevEnd = new Date(periods[i - 1].period_end).getTime()
    const thisStart = new Date(periods[i].period_start).getTime()
    if (thisStart > prevEnd) issues.push({ kind: 'gap', at: periods[i].period_start, prev: periods[i - 1].period_end })
    else if (thisStart < prevEnd) issues.push({ kind: 'overlap', at: periods[i].period_start, prev: periods[i - 1].period_end })
  }

  // Print: set the paper/orientation and (optionally) scale the calendar so
  // every row lands on a single page — no half-row spilling onto page 2.
  function doPrint() {
    const el = printRef.current
    if (!el) { window.print(); return }
    const MARGIN = 0.4 // inches
    const DPI = 96
    const dims = paper === 'legal' ? { w: 14, h: 8.5 } : { w: 11, h: 8.5 } // landscape
    const pageW = (dims.w - 2 * MARGIN) * DPI
    const pageH = (dims.h - 2 * MARGIN) * DPI

    // reset any prior transform, measure natural size
    el.style.transform = ''
    el.parentElement.style.height = ''
    const rect = el.getBoundingClientRect()
    const scale = fitOne ? Math.min(1, pageW / rect.width, pageH / rect.height) : 1
    el.style.transformOrigin = 'top left'
    el.style.transform = `scale(${scale})`
    el.parentElement.style.height = (rect.height * scale) + 'px'

    let style = document.getElementById('oc-page-style')
    if (!style) { style = document.createElement('style'); style.id = 'oc-page-style'; document.head.appendChild(style) }
    style.textContent = `@page { size: ${paper} landscape; margin: ${MARGIN}in; }`

    const cleanup = () => { el.style.transform = ''; el.parentElement.style.height = ''; window.removeEventListener('afterprint', cleanup) }
    window.addEventListener('afterprint', cleanup)
    window.print()
  }

  const colorFor = (i, role) => PALETTE[((i * 2) + (role === 'tech' ? 1 : 0)) % PALETTE.length]
  const nowMs = Date.now()
  const weeks = monthWeeks(cursor.getFullYear(), cursor.getMonth())
  const monthTitle = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
  const shiftMonth = (n) => { const d = new Date(cursor); d.setMonth(d.getMonth() + n); setCursor(d) }
  const gridCols = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }

  // One person's bar for a period, clipped to a single week row.
  const bar = (p, i, role, firstCol, lastCol, showLabel) => {
    const uid = role === 'tech' ? p.tech_user_id : p.supervisor_user_id
    if (role === 'tech' && !uid) return <div style={{ minHeight: 4 }} />
    return (
      <div style={{ ...gridCols, marginBottom: 3 }}>
        <div
          onClick={() => selectPeriod(p)}
          title={`${role === 'tech' ? 'On-Call Tech' : 'On-Call Supervisor'}: ${nameOf(uid)}  ·  ${fmtShort(p.period_start)} – ${fmtShort(p.period_end)}`}
          style={{
            gridColumn: `${firstCol + 1} / ${lastCol + 2}`,
            background: colorFor(i, role), color: '#fff',
            borderRadius: 5, padding: '3px 8px', fontSize: 11.5, fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            cursor: 'pointer', border: selectedId === p.id ? '2px solid #0b1f3a' : '2px solid transparent',
          }}>
          {nameOf(uid)}{showLabel ? `   ${fmtShort(p.period_start)} – ${fmtShort(p.period_end)}` : ''}
        </div>
      </div>
    )
  }

  const editing = !!selectedId

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 24px' }}>
      <div className="page-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>On-Call Schedule</h2>
        {isSuperAdmin && <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />}
      </div>
      <p style={{ color: 'var(--mist)', margin: '0 0 4px' }}>
        Set who's on call and when. Each period hands off nose-to-nose with the next &mdash; a new period's start defaults to the last one's end, so a coverage gap can't slip in by accident.
      </p>
      <p style={{ color: 'var(--mist)', margin: '0 0 16px', fontSize: 13 }}>
        The calendar is for visual scheduling only. It does not feed into Attendance or Payroll.
      </p>

      {isSuperAdmin && !selectedOrg ? (
        <p style={{ color: 'var(--mist)' }}>Pick an organization to view its on-call schedule.</p>
      ) : loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading&hellip;</p>
      ) : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* ---------------- LEFT: add / edit / delete form ---------------- */}
          <form onSubmit={addPeriod} className="oncall-no-print" style={{ flex: '0 0 320px', border: '1px solid var(--border)', borderRadius: 10, padding: 16, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h3 style={{ margin: '0 0 12px' }}>{editing ? 'Edit on-call period' : 'Add an on-call period'}</h3>
              {editing && <button type="button" onClick={() => resetForm()} style={{ border: 'none', background: 'none', color: '#176E7A', fontSize: 12.5, cursor: 'pointer', padding: 0 }}>+ New</button>}
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>On-Call Supervisor <span style={{ color: 'var(--mist)', fontWeight: 400 }}>(calls first)</span></label>
              <select value={supId} onChange={(e) => setSupId(e.target.value)} style={{ width: '100%' }}>
                <option value="">Choose&hellip;</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>On-Call Tech <span style={{ color: 'var(--mist)', fontWeight: 400 }}>(backup)</span></label>
              <select value={techId} onChange={(e) => setTechId(e.target.value)} style={{ width: '100%' }}>
                <option value="">Choose&hellip;</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 6 }}>
              <label>Starts</label>
              <input type="datetime-local" value={startVal} onChange={(e) => setStartVal(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 6, margin: '0 0 12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--mist)' }}>Length:</span>
              <button type="button" className="logout-button" onClick={() => setEndVal(addDays(startVal, 1))}>1 day</button>
              <button type="button" className="logout-button" onClick={() => setEndVal(addDays(startVal, 7))}>1 week</button>
              <button type="button" className="logout-button" onClick={() => { const d = new Date(startVal); d.setMonth(d.getMonth() + 1); setEndVal(toLocalInput(d)) }}>1 month</button>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Ends</label>
              <input type="datetime-local" value={endVal} onChange={(e) => setEndVal(e.target.value)} style={{ width: '100%' }} />
            </div>
            {error && <p style={{ color: 'var(--danger,#c0392b)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" className="auth-button" disabled={saving} onClick={saveEdit} style={{ width: '100%', margin: 0 }}>{saving ? 'Saving…' : 'Save changes'}</button>
                <button type="button" onClick={deletePeriod} style={{ width: '100%', border: '1px solid #E0B4AC', background: '#fff', color: '#B5462F', borderRadius: 8, padding: '9px 0', fontWeight: 600, cursor: 'pointer' }}>Delete period</button>
              </div>
            ) : (
              <button type="submit" className="auth-button" disabled={saving} style={{ width: '100%', margin: 0 }}>{saving ? 'Saving…' : 'Add period'}</button>
            )}
          </form>

          {/* ---------------- RIGHT: calendar / map ---------------- */}
          <div style={{ flex: '1 1 640px', minWidth: 0 }}>
            <div className="oncall-no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={() => shiftMonth(-1)} style={navBtn}>‹</button>
                <button type="button" onClick={() => setCursor(() => { const d = new Date(); d.setDate(1); return d })} style={{ ...navBtn, width: 'auto', padding: '0 14px', fontSize: 13 }}>Today</button>
                <button type="button" onClick={() => shiftMonth(1)} style={navBtn}>›</button>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>{monthTitle}</div>
              {view === 'calendar' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--mist)' }}>
                    Paper:
                    <select value={paper} onChange={(e) => setPaper(e.target.value)} style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <option value="letter">Letter</option>
                      <option value="legal">Legal</option>
                    </select>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--mist)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={fitOne} onChange={(e) => setFitOne(e.target.checked)} /> Fit all rows on one page
                  </label>
                  <button type="button" onClick={doPrint} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Print Calendar</button>
                </div>
              )}
              <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <button type="button" onClick={() => setView('calendar')} title="Calendar view" style={viewBtn(view === 'calendar')}>🗓</button>
                <button type="button" onClick={() => setView('map')} title="Map view" style={viewBtn(view === 'map')}>📍</button>
              </div>
            </div>

            {issues.length > 0 && view === 'calendar' && (
              <div className="oncall-no-print" style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {issues.map((it, k) => (
                  <div key={k} style={{ fontSize: 12.5, color: it.kind === 'gap' ? '#B5462F' : '#9C6A12' }}>
                    ⚠ Coverage {it.kind} between {fmtLong(it.prev)} and {fmtLong(it.at)}
                  </div>
                ))}
              </div>
            )}

            {view === 'map' ? (
              <div className="section-card" style={{ padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📍</div>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Map View — coming soon</div>
                <p style={{ margin: '0 auto', maxWidth: 460, color: 'var(--mist)', fontSize: 13.5 }}>
                  Planned: a map of your service area showing which on-call pair covers each zone for the selected date, so dispatch can see after-hours geographic coverage at a glance. Tell me if you'd rather it show something else.
                </p>
              </div>
            ) : (
              <div className="oncall-print-area">
               <div ref={printRef}>
                <div className="oncall-print-title" style={{ display: 'none' }}>On-Call Schedule — {monthTitle}</div>
                {/* weekday header */}
                <div style={{ ...gridCols, border: '1px solid var(--line-strong)', borderBottom: 'none', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
                  {WEEKDAYS.map((w) => (
                    <div key={w} style={{ background: 'var(--route-blue)', color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', padding: '7px 0', borderLeft: '1px solid rgba(255,255,255,.15)' }}>{w}</div>
                  ))}
                </div>
                {/* weeks */}
                <div style={{ border: '1px solid var(--line-strong)', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                  {weeks.map((week, wi) => {
                    const weekPeriods = periods.filter((p) => week.some((d) => coversDay(p, d)))
                    return (
                      <div key={wi} style={{ borderTop: wi ? '1px solid var(--line-strong)' : 'none', minHeight: 96 }}>
                        {/* day numbers */}
                        <div style={gridCols}>
                          {week.map((d, di) => {
                            const inMonth = d.getMonth() === cursor.getMonth()
                            const isToday = d.toDateString() === new Date().toDateString()
                            return (
                              <div key={di} style={{ padding: '4px 6px', borderLeft: di ? '1px solid var(--line)' : 'none', color: inMonth ? 'inherit' : 'var(--mist)', fontSize: 12.5 }}>
                                <span style={isToday ? { background: '#0B6E2E', color: '#fff', borderRadius: 10, padding: '1px 7px', fontWeight: 700 } : { fontWeight: inMonth ? 600 : 400 }}>{d.getDate()}</span>
                              </div>
                            )
                          })}
                        </div>
                        {/* bars */}
                        <div style={{ padding: '2px 4px 6px' }}>
                          {weekPeriods.map((p) => {
                            const gi = periods.findIndex((x) => x.id === p.id)
                            let firstCol = -1, lastCol = -1
                            week.forEach((d, di) => { if (coversDay(p, d)) { if (firstCol === -1) firstCol = di; lastCol = di } })
                            return (
                              <div key={p.id}>
                                {bar(p, gi, 'sup', firstCol, lastCol, true)}
                                {bar(p, gi, 'tech', firstCol, lastCol, true)}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
               </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const navBtn = { width: 34, height: 34, border: '1px solid var(--border)', background: '#fff', borderRadius: 8, fontSize: 18, lineHeight: 1, cursor: 'pointer' }
const viewBtn = (active) => ({ border: 'none', width: 40, height: 34, fontSize: 16, cursor: 'pointer', background: active ? '#176E7A' : '#fff', filter: active ? 'none' : 'grayscale(1)' })
