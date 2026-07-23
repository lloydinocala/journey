// Rewards-HVAC · Certified Payroll — weekly per-worker hours by classification,
// auto-priced from wage determinations, with WH-347 + Statement of Compliance output.
import { useState, useEffect } from 'react'
import { listEmployees, getSettings } from './hrData'
import { listProjects, listDeterminations, listCertPayroll, upsertCertLine, deleteCertLine, computeCertLine, findDetermination, money } from './r6Data'
import { useOrgSelector, OrgBar } from './shared'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const emptyHours = () => [0, 0, 0, 0, 0, 0, 0]

function friday() {
  const d = new Date(); const add = (5 - d.getDay() + 7) % 7
  d.setDate(d.getDate() + add); const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

export default function CertifiedPayroll({ profile }) {
  const org = useOrgSelector(profile)
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [weekEnding, setWeekEnding] = useState(friday())
  const [dets, setDets] = useState([])
  const [employees, setEmployees] = useState([])
  const [lines, setLines] = useState([])
  const [orgName, setOrgName] = useState('')
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!org.selectedOrg) return
    Promise.all([listProjects(org.selectedOrg), listDeterminations(org.selectedOrg), listEmployees(org.selectedOrg), getSettings(org.selectedOrg)])
      .then(([p, d, e, s]) => { setProjects(p); setDets(d); setEmployees(e); setSettings(s); if (!projectId && p[0]) setProjectId(p[0].id) })
  }, [org.selectedOrg])

  async function loadLines() {
    if (!org.selectedOrg || !projectId) { setLines([]); return }
    const data = await listCertPayroll(org.selectedOrg, projectId, weekEnding)
    setLines(data.map((l) => ({ ...l, daily_st: l.daily_st || emptyHours(), daily_ot: l.daily_ot || emptyHours() })))
  }
  useEffect(() => { loadLines() }, [projectId, weekEnding, org.selectedOrg])

  function addWorker() {
    setLines((ls) => [...ls, {
      _temp: Math.random().toString(36).slice(2), project_id: projectId, week_ending: weekEnding,
      worker_name: '', ssn_last4: '', classification: '', base_rate: 0, fringe_rate: 0, fringe_mode: 'cash',
      daily_st: emptyHours(), daily_ot: emptyHours(), fed_wh: '', state_wh: 0, other_deductions: 0,
    }])
  }
  function updateLine(idx, patch) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  function pickClassification(idx, classification) {
    const proj = projects.find((p) => p.id === projectId)
    const d = findDetermination(dets, classification, proj?.county)
    updateLine(idx, { classification, base_rate: d ? Number(d.base_rate) : 0, fringe_rate: d ? Number(d.fringe_rate) : 0, wage_determination_id: d?.id || null })
  }
  function pickEmployee(idx, empId) {
    const e = employees.find((x) => x.id === empId)
    updateLine(idx, { employee_id: empId || null, user_id: e?.user_id || null, worker_name: e?.full_name || '' })
  }
  function setHour(idx, kind, day, value) {
    setLines((ls) => ls.map((l, i) => {
      if (i !== idx) return l
      const arr = [...(l[kind] || emptyHours())]; arr[day] = parseFloat(value) || 0
      return { ...l, [kind]: arr }
    }))
  }

  async function saveLine(idx) {
    const l = lines[idx]
    const c = computeCertLine(l)
    setSaving(true); setMsg('')
    const row = {
      id: l._temp ? undefined : l.id, project_id: projectId, week_ending: weekEnding,
      employee_id: l.employee_id || null, user_id: l.user_id || null, worker_name: l.worker_name || null, ssn_last4: l.ssn_last4 || null,
      classification: l.classification || null, wage_determination_id: l.wage_determination_id || null,
      base_rate: Number(l.base_rate) || 0, fringe_rate: Number(l.fringe_rate) || 0, fringe_mode: l.fringe_mode || 'cash',
      daily_st: l.daily_st, daily_ot: l.daily_ot, total_st: c.total_st, total_ot: c.total_ot, gross: c.gross,
      fed_wh: c.fed_wh, fica: c.fica, state_wh: Number(l.state_wh) || 0, other_deductions: Number(l.other_deductions) || 0, net: c.net,
    }
    const { error } = await upsertCertLine(org.selectedOrg, row)
    setSaving(false); setMsg(error ? error.message : `Saved ${l.worker_name || 'worker'}.`)
    loadLines()
  }
  async function removeLine(idx) {
    const l = lines[idx]
    if (l._temp) { setLines((ls) => ls.filter((_, i) => i !== idx)); return }
    if (confirm('Delete this worker line?')) { await deleteCertLine(l.id); loadLines() }
  }

  const project = projects.find((p) => p.id === projectId)

  return (
    <div>
      <div className="page-header-bar"><h2>Certified Payroll</h2></div>
      <OrgBar {...org} />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="field" style={{ minWidth: 240, margin: 0 }}><label>Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— select —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="field" style={{ margin: 0 }}><label>Week ending</label><input type="date" value={weekEnding} onChange={(e) => setWeekEnding(e.target.value)} /></div>
        {projectId && <button className="logout-button" style={{ marginTop: 18 }} onClick={addWorker}>+ Add worker</button>}
        {lines.length > 0 && <button className="auth-button" style={{ width: 'auto', margin: '18px 0 0' }} onClick={() => printWH347(project, weekEnding, lines, orgName || (project?.name || 'Contractor'), settings)}>🖨 Generate WH-347</button>}
      </div>
      {msg && <div style={{ marginBottom: 12, color: msg.startsWith('Saved') ? '#166534' : '#B00020' }}>{msg}</div>}

      {!projectId ? <p style={{ color: 'var(--mist)' }}>Select a project. Add one in <strong>Projects</strong> and its rates in <strong>Prevailing Wage</strong> first.</p>
        : lines.length === 0 ? <p style={{ color: 'var(--mist)' }}>No workers yet for this week. Click “+ Add worker”.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {lines.map((l, idx) => {
            const c = computeCertLine(l)
            return (
              <div key={l.id || l._temp} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                <div className="inline-form" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                  <div className="field"><label>Employee</label>
                    <select value={l.employee_id || ''} onChange={(e) => pickEmployee(idx, e.target.value)}>
                      <option value="">— manual —</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
                  <div className="field"><label>Name</label><input value={l.worker_name || ''} onChange={(e) => updateLine(idx, { worker_name: e.target.value })} /></div>
                  <div className="field" style={{ width: 70 }}><label>SSN·4</label><input maxLength="4" value={l.ssn_last4 || ''} onChange={(e) => updateLine(idx, { ssn_last4: e.target.value.replace(/\D/g, '') })} /></div>
                  <div className="field" style={{ minWidth: 200 }}><label>Classification</label>
                    <select value={l.classification || ''} onChange={(e) => pickClassification(idx, e.target.value)}>
                      <option value="">— select —</option>
                      {[...new Set(dets.map((d) => d.classification))].map((cl) => <option key={cl} value={cl}>{cl}</option>)}</select></div>
                  <div className="field" style={{ width: 90 }}><label>Base $/hr</label><input type="number" step="0.01" value={l.base_rate || ''} onChange={(e) => updateLine(idx, { base_rate: e.target.value })} /></div>
                  <div className="field" style={{ width: 90 }}><label>Fringe $/hr</label><input type="number" step="0.01" value={l.fringe_rate || ''} onChange={(e) => updateLine(idx, { fringe_rate: e.target.value })} /></div>
                  <div className="field"><label>Fringe</label>
                    <select value={l.fringe_mode || 'cash'} onChange={(e) => updateLine(idx, { fringe_mode: e.target.value })}>
                      <option value="cash">Cash</option><option value="plan">Plan</option></select></div>
                </div>

                <table style={{ fontSize: 13, marginBottom: 8 }}>
                  <thead><tr><th style={{ textAlign: 'left', paddingRight: 8 }}></th>{DAYS.map((d) => <th key={d} style={{ width: 46 }}>{d}</th>)}<th style={{ paddingLeft: 8 }}>Tot</th></tr></thead>
                  <tbody>
                    <tr><td style={{ color: 'var(--mist)' }}>ST</td>{DAYS.map((d, di) => <td key={d}><input type="number" step="0.25" style={{ width: 44 }} value={l.daily_st[di] || ''} onChange={(e) => setHour(idx, 'daily_st', di, e.target.value)} /></td>)}<td style={{ textAlign: 'right', fontWeight: 700 }}>{c.total_st}</td></tr>
                    <tr><td style={{ color: 'var(--mist)' }}>OT</td>{DAYS.map((d, di) => <td key={d}><input type="number" step="0.25" style={{ width: 44 }} value={l.daily_ot[di] || ''} onChange={(e) => setHour(idx, 'daily_ot', di, e.target.value)} /></td>)}<td style={{ textAlign: 'right', fontWeight: 700 }}>{c.total_ot}</td></tr>
                  </tbody>
                </table>

                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>Gross <strong>{money(c.gross)}</strong></span>
                  <span style={{ color: 'var(--mist)' }}>FICA {money(c.fica)}</span>
                  <span>Fed WH <input type="number" step="0.01" style={{ width: 80 }} value={l.fed_wh === '' || l.fed_wh == null ? '' : l.fed_wh} placeholder={String(c.fed_wh)} onChange={(e) => updateLine(idx, { fed_wh: e.target.value })} /></span>
                  <span>Other <input type="number" step="0.01" style={{ width: 70 }} value={l.other_deductions || ''} onChange={(e) => updateLine(idx, { other_deductions: e.target.value })} /></span>
                  <span>Net <strong>{money(c.net)}</strong></span>
                  <button className="auth-button" style={{ width: 'auto', padding: '4px 14px', margin: 0, marginLeft: 'auto' }} disabled={saving} onClick={() => saveLine(idx)}>Save</button>
                  <button className="logout-button" onClick={() => removeLine(idx)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function printWH347(project, weekEnding, lines, contractor, settings) {
  const w = window.open('', '_blank', 'width=1100,height=800')
  if (!w) return
  const m = (n) => '$' + (Number(n) || 0).toFixed(2)
  const DAYSH = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const body = lines.map((l) => {
    const c = { total_st: (l.daily_st || []).reduce((s, x) => s + (+x || 0), 0), total_ot: (l.daily_ot || []).reduce((s, x) => s + (+x || 0), 0) }
    const gross = (Number(l.gross) || 0)
    const cells = (l.daily_st || []).map((st, i) => `${st || ''}${(l.daily_ot && l.daily_ot[i]) ? '/' + l.daily_ot[i] : ''}`).join('</td><td>')
    return `<tr><td>${l.worker_name || ''}<br><span class="s">…${l.ssn_last4 || ''}</span></td><td>${l.classification || ''}</td><td>${cells}</td>
      <td>${(c.total_st + c.total_ot).toFixed(1)}</td><td>${m(l.base_rate)}${l.fringe_rate ? '+' + m(l.fringe_rate) + 'f' : ''}</td>
      <td>${m(gross)}</td><td>${m(l.fica)}<br>${m(l.fed_wh)}<br>${m(l.other_deductions)}</td><td>${m(l.net)}</td></tr>`
  }).join('')
  w.document.write(`<html><head><title>WH-347 — ${project?.name || ''} — w/e ${weekEnding}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:12px}h1{font-size:15px;margin:0}h2{font-size:12px;color:#555;margin:2px 0 12px;font-weight:400}
    table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #999;padding:4px 5px;font-size:11px;text-align:left;vertical-align:top}.s{color:#666;font-size:10px}
    .compliance{margin-top:20px;font-size:11px;line-height:1.5}</style></head><body>
    <h1>PAYROLL (Form WH-347) — Certified Payroll</h1>
    <h2>Contractor: ${contractor} &nbsp;·&nbsp; Project: ${project?.name || ''} ${project?.wage_determination_ref ? '(WD ' + project.wage_determination_ref + ')' : ''} &nbsp;·&nbsp; Week ending: ${weekEnding}</h2>
    <table><thead><tr><th>Name / SSN</th><th>Class</th><th colspan="7">Day hours ST/OT (${DAYSH.join(' ')})</th><th>Tot</th><th>Rate</th><th>Gross</th><th>FICA / FWT / Other</th><th>Net</th></tr></thead>
    <tbody>${body}</tbody></table>
    <div class="compliance">
      <strong>Statement of Compliance.</strong> I, the undersigned, certify that the above payroll for the week ending ${weekEnding} is correct and complete;
      that each laborer/mechanic has been paid the full weekly wages earned, not less than the applicable wage rates and fringe benefits for the classification of work performed,
      and that no deductions have been made other than those permitted. Fringe benefits were paid ${lines.some((l) => l.fringe_mode === 'cash') ? 'in cash and/or' : ''} to approved plans/funds as indicated.
      <br><br>Signature: ______________________________  Title: ______________  Date: __________
    </div>
    <p style="margin-top:14px;color:#666;font-size:10px">Generated by Rewards-HVAC. Review against the official DOL Form WH-347 before submitting to the contracting agency.</p>
    </body></html>`)
  w.document.close(); w.focus(); w.print()
}
