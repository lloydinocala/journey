// Rewards-HVAC · Employee Scorecards — a configurable, quarterly performance
// record kept in each employee's permanent file. Office builds/edits the metric
// template, records values each quarter, and reviews Current vs Last Update with
// missed minimums flagged. Employees see their own read-only in the portal.
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { listEmployees, getSettings } from './hrData'
import {
  listMetrics, addMetric, updateMetric, seedDefaultMetrics, listEntries, upsertEntry,
  listReviews, upsertReview,
  CATEGORY_ORDER, UNITS, DIRECTIONS, fmtValue, fmtMinimum, isFail, currentQuarter,
} from './scorecardData'
import { useOrgSelector, OrgBar } from './shared'

function orderedByCategory(metrics) {
  const cats = [...new Set([...CATEGORY_ORDER, ...metrics.map((m) => m.category)])]
  return cats.map((c) => ({ category: c, items: metrics.filter((m) => m.category === c) })).filter((g) => g.items.length)
}
function priorQuarter(y, q) { return q > 1 ? { y, q: q - 1 } : { y: y - 1, q: 4 } }

// Shared presentational table — used here (editable) and in the portal (read-only).
export function ScorecardTable({ metrics, valueOf, curLabel, lastLabel, editing = false, draft = {}, onDraft }) {
  const groups = orderedByCategory(metrics)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ minWidth: 720 }}>
        {groups.map((g) => (
          <tbody key={g.category}>
            <tr style={{ background: '#0F172A' }}>
              <th style={{ color: '#fff' }}>{g.category}</th>
              <th style={{ color: '#fff' }}>Description</th>
              <th style={{ color: '#fff' }}>Minimal accepted</th>
              <th style={{ color: '#fff', textAlign: 'center' }}>{curLabel} (Current)</th>
              <th style={{ color: '#fff', textAlign: 'center' }}>{lastLabel} (Last)</th>
            </tr>
            {g.items.map((m) => {
              const cur = valueOf(m.id, curLabel)
              const last = valueOf(m.id, lastLabel)
              const fail = isFail(m, cur)
              return (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600, color: '#152238' }}>{m.name}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--mist)', maxWidth: 260 }}>{m.description}</td>
                  <td style={{ fontSize: 13 }}>{fmtMinimum(m)}</td>
                  <td style={{ textAlign: 'center', background: fail ? '#FBE0E0' : undefined }}>
                    {editing ? (
                      <input type="number" step="0.01" value={draft[m.id] ?? (cur ?? '')} onChange={(e) => onDraft(m.id, e.target.value)}
                        style={{ width: 90, textAlign: 'center', border: `1px solid ${fail ? '#DC2626' : 'var(--border)'}`, borderRadius: 6, padding: '4px 6px' }} />
                    ) : (
                      <span style={{ fontWeight: fail ? 700 : 400, color: fail ? '#B00020' : '#152238' }}>{fmtValue(m.unit, cur)}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--mist)' }}>{fmtValue(m.unit, last)}</td>
                </tr>
              )
            })}
          </tbody>
        ))}
      </table>
    </div>
  )
}

const blankMetric = { category: 'Customer experience', name: '', description: '', unit: 'percent', minimum: '', direction: 'higher' }

export default function HrScorecards({ profile }) {
  const org = useOrgSelector(profile)
  const [enabled, setEnabled] = useState(true)
  const [metrics, setMetrics] = useState([])
  const [employees, setEmployees] = useState([])
  const [empId, setEmpId] = useState('')
  const [entries, setEntries] = useState([])
  const [reviews, setReviews] = useState([])
  const [reviewDraft, setReviewDraft] = useState({ summary: '', goals: '' })
  const [savingReview, setSavingReview] = useState(false)
  const [reviewMsg, setReviewMsg] = useState('')
  const cq = currentQuarter()
  const [year, setYear] = useState(Number(cq.label.slice(0, 4)))
  const [quarter, setQuarter] = useState(Number(cq.label.slice(-1)))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [mForm, setMForm] = useState(blankMetric)

  async function loadBase() {
    if (!org.selectedOrg) return
    const [mx, emps, s] = await Promise.all([
      listMetrics(org.selectedOrg), listEmployees(org.selectedOrg), getSettings(org.selectedOrg),
    ])
    setMetrics(mx); setEmployees(emps); setEnabled(!!s?.scorecards_enabled)
    if (!empId && emps[0]) setEmpId(emps[0].id)
  }
  useEffect(() => { loadBase() }, [org.selectedOrg]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadEntries() {
    if (!org.selectedOrg || !empId) { setEntries([]); setReviews([]); return }
    const [en, rv] = await Promise.all([listEntries(org.selectedOrg, empId), listReviews(org.selectedOrg, empId)])
    setEntries(en); setReviews(rv)
  }
  useEffect(() => { loadEntries() }, [empId, org.selectedOrg]) // eslint-disable-line react-hooks/exhaustive-deps

  const curLabel = `${year}-Q${quarter}`
  const pq = priorQuarter(year, quarter)
  const lastLabel = `${pq.y}-Q${pq.q}`
  const curReview = reviews.find((r) => r.period_label === curLabel) || null
  useEffect(() => {
    setReviewDraft({ summary: curReview?.summary || '', goals: curReview?.goals || '' }); setReviewMsg('')
  }, [curLabel, empId, reviews.length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveReview() {
    setSavingReview(true); setReviewMsg('')
    const date = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01`
    await upsertReview(org.selectedOrg, { employee_id: empId, period_label: curLabel, period_date: date, summary: reviewDraft.summary, goals: reviewDraft.goals, reviewed_by: profile.id })
    setSavingReview(false); setReviewMsg('Saved.'); loadEntries()
  }
  const valueOf = useMemo(() => {
    const map = {}; entries.forEach((e) => { map[e.metric_id + '|' + e.period_label] = e.value })
    return (mid, label) => map[mid + '|' + label]
  }, [entries])

  function startEdit() {
    const d = {}; metrics.forEach((m) => { const v = valueOf(m.id, curLabel); if (v != null) d[m.id] = v })
    setDraft(d); setEditing(true)
  }
  async function saveEntries() {
    setSaving(true)
    const date = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01`
    for (const m of metrics) {
      const v = draft[m.id]
      if (v === undefined) continue
      await upsertEntry(org.selectedOrg, { employee_id: empId, metric_id: m.id, period_label: curLabel, period_date: date, value: v === '' ? null : Number(v) })
    }
    setSaving(false); setEditing(false); loadEntries()
  }

  async function addNewMetric(e) {
    e.preventDefault()
    if (!mForm.name.trim()) return
    await addMetric(org.selectedOrg, {
      category: mForm.category, name: mForm.name.trim(), description: mForm.description || null,
      unit: mForm.unit, minimum: mForm.direction === 'actual' || mForm.minimum === '' ? null : Number(mForm.minimum),
      direction: mForm.direction, sort: metrics.length,
    })
    setMForm(blankMetric); loadBase()
  }
  async function loadStarter() { await seedDefaultMetrics(org.selectedOrg); loadBase() }

  const empName = (id) => (employees.find((e) => e.id === id) || {}).full_name || ''

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Employee Scorecards</h2></div>
        <button className="logout-button" onClick={() => setShowSetup(!showSetup)}>{showSetup ? 'Done editing metrics' : 'Manage metrics'}</button>
      </div>
      <OrgBar {...org} />

      {!enabled && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', padding: '10px 14px', borderRadius: 10, marginBottom: 18, fontSize: 14 }}>
          Scorecards are turned off for this organization. Turn them on in <Link to="/rewards/settings" style={{ color: '#9A3412', fontWeight: 700 }}>HR Settings</Link> to use this feature.
        </div>
      )}

      {showSetup && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0 }}>Scorecard metrics</h3>
            {metrics.length === 0 && <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={loadStarter}>Load starter metrics</button>}
          </div>
          <form className="inline-form" onSubmit={addNewMetric} style={{ flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div className="field"><label>Category</label>
              <input list="sc-cats" value={mForm.category} onChange={(e) => setMForm({ ...mForm, category: e.target.value })} />
              <datalist id="sc-cats">{CATEGORY_ORDER.map((c) => <option key={c} value={c} />)}</datalist></div>
            <div className="field"><label>Metric</label><input value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} required /></div>
            <div className="field" style={{ minWidth: 200 }}><label>Description</label><input value={mForm.description} onChange={(e) => setMForm({ ...mForm, description: e.target.value })} /></div>
            <div className="field"><label>Unit</label><select value={mForm.unit} onChange={(e) => setMForm({ ...mForm, unit: e.target.value })}>{UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="field"><label>Goal direction</label><select value={mForm.direction} onChange={(e) => setMForm({ ...mForm, direction: e.target.value })}>{DIRECTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            {mForm.direction !== 'actual' && <div className="field" style={{ maxWidth: 110 }}><label>Minimum</label><input type="number" step="0.01" value={mForm.minimum} onChange={(e) => setMForm({ ...mForm, minimum: e.target.value })} /></div>}
            <button className="auth-button" type="submit" style={{ width: 'auto' }}>Add metric</button>
          </form>
          <table className="data-table">
            <thead><tr><th>Category</th><th>Metric</th><th>Minimum</th><th>Direction</th><th></th></tr></thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id}>
                  <td>{m.category}</td><td>{m.name}</td><td>{fmtMinimum(m)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{m.direction}</td>
                  <td style={{ textAlign: 'right' }}><button className="logout-button" onClick={() => { if (confirm(`Archive "${m.name}"?`)) updateMetric(m.id, { active: false }).then(loadBase) }}>Archive</button></td>
                </tr>
              ))}
              {metrics.length === 0 && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No metrics yet. Load the starter set or add your own.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}><label>Employee</label>
          <select value={empId} onChange={(e) => { setEditing(false); setEmpId(e.target.value) }}>
            <option value="">— select —</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Quarter</label>
          <select value={quarter} onChange={(e) => { setEditing(false); setQuarter(Number(e.target.value)) }}>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}</select></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Year</label>
          <select value={year} onChange={(e) => { setEditing(false); setYear(Number(e.target.value)) }}>{[year + 1, year, year - 1, year - 2].map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
        {empId && metrics.length > 0 && (
          editing
            ? <><button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={saving} onClick={saveEntries}>{saving ? 'Saving…' : `Save ${curLabel}`}</button>
                <button className="logout-button" onClick={() => setEditing(false)}>Cancel</button></>
            : <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={startEdit}>Record / edit {curLabel}</button>
        )}
      </div>

      {!empId ? (
        <p style={{ color: 'var(--mist)' }}>Select an employee to view their scorecard.</p>
      ) : metrics.length === 0 ? (
        <div>
          <p style={{ color: 'var(--mist)', marginBottom: 12 }}>No scorecard metrics defined yet.</p>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={loadStarter}>Load starter metrics</button>
          <span style={{ marginLeft: 12, color: 'var(--mist)', fontSize: 13 }}>drops in the standard 11 — or build your own with “Manage metrics” above.</span>
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{empName(empId)}</div>
          <ScorecardTable metrics={metrics} valueOf={valueOf} curLabel={curLabel} lastLabel={lastLabel} editing={editing} draft={draft} onDraft={(id, v) => setDraft((d) => ({ ...d, [id]: v }))} />
          <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 10 }}>Highlighted cells miss the minimum accepted rating. Every quarter is retained as a permanent record; use the quarter/year selectors to review history.</p>

          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginTop: 18, maxWidth: 820 }}>
            <h3 style={{ margin: '0 0 4px' }}>Manager notes &amp; goals — {curLabel}</h3>
            <div style={{ color: 'var(--mist)', fontSize: 12.5, marginBottom: 12 }}>The written half of the review. The employee sees this on their scorecard. Keep it factual and behavior-based.</div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 4 }}>Summary of this quarter</label>
            <textarea rows="3" value={reviewDraft.summary} onChange={(e) => setReviewDraft({ ...reviewDraft, summary: e.target.value })} style={{ width: '100%', marginBottom: 12 }} />
            <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 4 }}>Goals for next quarter</label>
            <textarea rows="3" value={reviewDraft.goals} onChange={(e) => setReviewDraft({ ...reviewDraft, goals: e.target.value })} style={{ width: '100%', marginBottom: 12 }} />
            <button className="auth-button" style={{ width: 'auto' }} disabled={savingReview} onClick={saveReview}>{savingReview ? 'Saving…' : 'Save notes & goals'}</button>
            {reviewMsg && <span style={{ marginLeft: 12, color: '#166534', fontSize: 13 }}>{reviewMsg}</span>}
          </div>
        </>
      )}
    </div>
  )
}
