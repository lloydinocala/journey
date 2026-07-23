// Rewards-HVAC · Workers' Comp — class codes + rates, per-employee assignment,
// and estimated premium from actual payroll (premium = wages × rate ÷ 100).
import { useState, useEffect } from 'react'
import { listEmployees } from './hrData'
import { listWcClasses, addWcClass, updateWcClass, listEmployeeWc, setEmployeeWc } from './r4Data'
import { loadCalcs, money } from './taxCenterData'
import { useOrgSelector, OrgBar } from './shared'

const blank = { code: '', description: '', rate_per_100: '' }

export default function WorkersComp({ profile }) {
  const org = useOrgSelector(profile)
  const [classes, setClasses] = useState([])
  const [employees, setEmployees] = useState([])
  const [empWc, setEmpWc] = useState({})
  const [calcs, setCalcs] = useState([])
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const year = new Date().getFullYear()

  async function load() {
    if (!org.selectedOrg) return
    const [cls, emps, ewc, cs] = await Promise.all([
      listWcClasses(org.selectedOrg), listEmployees(org.selectedOrg), listEmployeeWc(org.selectedOrg),
      loadCalcs(org.selectedOrg, { from: `${year}-01-01`, to: `${year}-12-31` }),
    ])
    setClasses(cls); setEmployees(emps); setEmpWc(ewc); setCalcs(cs)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  async function submit(e) {
    e.preventDefault()
    if (!form.code.trim()) return
    setSaving(true)
    await addWcClass(org.selectedOrg, { code: form.code.trim(), description: form.description || null, rate_per_100: parseFloat(form.rate_per_100) || 0 })
    setSaving(false); setForm(blank); setShowForm(false); load()
  }

  // Gross YTD by user, then by employee's WC class.
  const grossByUser = {}
  calcs.forEach((c) => { grossByUser[c.user_id] = (grossByUser[c.user_id] || 0) + (Number(c.gross_pay) || 0) })
  const userToEmp = {}; employees.forEach((e) => { if (e.user_id) userToEmp[e.user_id] = e.id })
  const grossByClass = {}
  Object.keys(grossByUser).forEach((uid) => {
    const empId = userToEmp[uid]; const clsId = empWc[empId]
    if (!clsId) { grossByClass['_unassigned'] = (grossByClass['_unassigned'] || 0) + grossByUser[uid]; return }
    grossByClass[clsId] = (grossByClass[clsId] || 0) + grossByUser[uid]
  })
  const totalPremium = classes.reduce((s, c) => s + (grossByClass[c.id] || 0) * (Number(c.rate_per_100) || 0) / 100, 0)

  return (
    <div>
      <div className="page-header-bar">
        <h2>Workers' Comp</h2>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Class Code'}</button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form className="inline-form" onSubmit={submit} style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="field"><label>Class code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="5537" required /></div>
          <div className="field" style={{ minWidth: 240 }}><label>Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="HVAC install/service" /></div>
          <div className="field"><label>Rate per $100 payroll</label><input type="number" step="0.01" value={form.rate_per_100} onChange={(e) => setForm({ ...form, rate_per_100: e.target.value })} placeholder="4.50" /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>Add</button>
        </form>
      )}

      <h3>Class codes &amp; estimated {year} premium</h3>
      <table className="data-table" style={{ marginBottom: 24 }}>
        <thead><tr><th>Code</th><th>Description</th><th>Rate / $100</th><th>{year} payroll</th><th>Est. premium</th></tr></thead>
        <tbody>
          {classes.map((c) => {
            const g = grossByClass[c.id] || 0
            return (
              <tr key={c.id}>
                <td>{c.code}</td><td>{c.description || '—'}</td>
                <td>${Number(c.rate_per_100).toFixed(2)}</td>
                <td>{money(g)}</td>
                <td style={{ fontWeight: 700 }}>{money(g * (Number(c.rate_per_100) || 0) / 100)}</td>
              </tr>
            )
          })}
          {grossByClass['_unassigned'] > 0 && (
            <tr><td colSpan="3" style={{ color: '#B8720A' }}>Unassigned wages (assign a class below)</td><td>{money(grossByClass['_unassigned'])}</td><td>—</td></tr>
          )}
          {classes.length === 0 && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No class codes yet. Common HVAC: 5537 (sheet metal/HVAC), 8810 (clerical).</td></tr>}
        </tbody>
      </table>
      {classes.length > 0 && <div style={{ fontWeight: 800, marginBottom: 24 }}>Estimated total {year} premium: {money(totalPremium)}</div>}

      <h3>Assign class per employee</h3>
      <table className="data-table">
        <thead><tr><th>Employee</th><th>Workers' comp class</th></tr></thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id}>
              <td>{e.full_name}</td>
              <td>
                <select value={empWc[e.id] || ''} onChange={(ev) => setEmployeeWc(org.selectedOrg, e.id, ev.target.value).then(load)}>
                  <option value="">— unassigned —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.description || ''}</option>)}
                </select>
              </td>
            </tr>
          ))}
          {employees.length === 0 && <tr><td colSpan="2" style={{ color: 'var(--mist)' }}>No employees yet.</td></tr>}
        </tbody>
      </table>
      <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 10, maxWidth: 720 }}>
        Premium is estimated from actual gross wages this year. Construction class codes carry high rates — this keeps your
        pay-as-you-go workers'-comp accrual honest and helps job-cost labor correctly.
      </p>
    </div>
  )
}
