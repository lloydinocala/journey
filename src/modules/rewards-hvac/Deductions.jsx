// Rewards-HVAC · Benefits & Deductions — recurring per-employee deductions that
// flow into Prepare Payroll's net-pay calc with correct pre-tax treatment.
import { useState, useEffect } from 'react'
import { listEmployees } from './hrData'
import { listEmployeeDeductions, addDeduction, updateDeduction, deleteDeduction, DEDUCTION_PRESETS } from './r4Data'
import { useOrgSelector, OrgBar } from './shared'

const PRESET_LABEL = {
  '401k': '401(k) — pre-tax (reduces income tax)',
  'roth401k': 'Roth 401(k) — post-tax',
  'health125': 'Health insurance (Sec 125) — pre-tax (reduces income tax + FICA)',
  'hsa': 'HSA — pre-tax (reduces income tax + FICA)',
  'garnishment': 'Garnishment / child support — post-tax',
  'other_posttax': 'Other — post-tax',
}
const blank = { label: '', preset: 'health125', calc_type: 'flat', amount: '', garnishment_cap_pct: '' }

export default function Deductions({ profile }) {
  const org = useOrgSelector(profile)
  const [employees, setEmployees] = useState([])
  const [empId, setEmpId] = useState('')
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!org.selectedOrg) return
    listEmployees(org.selectedOrg).then((e) => { setEmployees(e); if (!empId && e[0]) setEmpId(e[0].id) })
  }, [org.selectedOrg])

  async function load() {
    if (!org.selectedOrg || !empId) { setRows([]); return }
    setRows(await listEmployeeDeductions(org.selectedOrg, empId))
  }
  useEffect(() => { load() }, [empId])

  async function submit(e) {
    e.preventDefault()
    if (!form.label.trim() || !empId) return
    setSaving(true)
    const preset = DEDUCTION_PRESETS[form.preset]
    const emp = employees.find((x) => x.id === empId)
    await addDeduction(org.selectedOrg, {
      employee_id: empId, user_id: emp?.user_id || null, label: form.label.trim(),
      ...preset, calc_type: form.calc_type, amount: parseFloat(form.amount) || 0,
      garnishment_cap_pct: form.preset === 'garnishment' ? (parseFloat(form.garnishment_cap_pct) || 25) : null,
    })
    setSaving(false); setForm(blank); setShowForm(false); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Benefits &amp; Deductions</h2></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={!empId} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Deduction'}</button>
      </div>
      <OrgBar {...org} />

      <div className="field" style={{ maxWidth: 340, marginBottom: 16 }}>
        <label>Employee</label>
        <select value={empId} onChange={(e) => setEmpId(e.target.value)}>
          <option value="">— select —</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={submit} style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ minWidth: 300 }}><label>Type</label>
            <select value={form.preset} onChange={(e) => setForm({ ...form, preset: e.target.value })}>
              {Object.keys(PRESET_LABEL).map((k) => <option key={k} value={k}>{PRESET_LABEL[k]}</option>)}
            </select></div>
          <div className="field"><label>Label</label><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. BCBS PPO" required /></div>
          <div className="field"><label>Calc</label>
            <select value={form.calc_type} onChange={(e) => setForm({ ...form, calc_type: e.target.value })}>
              <option value="flat">Flat $/paycheck</option><option value="percent">% of gross</option>
            </select></div>
          <div className="field"><label>{form.calc_type === 'percent' ? 'Percent' : 'Amount'}</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
          {form.preset === 'garnishment' && (
            <div className="field"><label>Cap % of disposable</label><input type="number" value={form.garnishment_cap_pct} onChange={(e) => setForm({ ...form, garnishment_cap_pct: e.target.value })} placeholder="25" /></div>
          )}
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>{saving ? 'Saving…' : 'Add'}</button>
        </form>
      )}

      <table className="data-table">
        <thead><tr><th>Deduction</th><th>Amount</th><th>Tax treatment</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td>{d.label} <span style={{ color: 'var(--mist)', fontSize: 12 }}>({d.category})</span></td>
              <td>{d.calc_type === 'percent' ? `${d.amount}% of gross` : `$${Number(d.amount).toFixed(2)}`}{d.category === 'garnishment' && d.garnishment_cap_pct ? ` (cap ${d.garnishment_cap_pct}%)` : ''}</td>
              <td style={{ fontSize: 13 }}>{d.pre_tax ? `Pre-tax${d.reduces_fica ? ' (income + FICA)' : ' (income only)'}` : 'Post-tax'}</td>
              <td><input type="checkbox" checked={d.active} onChange={() => updateDeduction(d.id, { active: !d.active }).then(load)} /></td>
              <td><button className="logout-button" onClick={() => { if (confirm('Delete this deduction?')) deleteDeduction(d.id).then(load) }}>Delete</button></td>
            </tr>
          ))}
          {rows.length === 0 && empId && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No deductions for this employee.</td></tr>}
        </tbody>
      </table>
      <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 10, maxWidth: 720 }}>
        Deductions flow into <strong>Prepare Payroll</strong> automatically. Pre-tax items reduce the wages used for
        withholding (401k reduces income tax; Section-125 health/HSA reduce income tax and FICA). Garnishments are capped at
        a percent of disposable earnings.
      </p>
    </div>
  )
}
