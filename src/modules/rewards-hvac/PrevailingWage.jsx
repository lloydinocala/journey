// Rewards-HVAC · Prevailing Wage — wage determinations (classification × county → base + fringe).
import { useState, useEffect } from 'react'
import { listDeterminations, addDetermination, updateDetermination, deleteDetermination } from './r6Data'
import { useOrgSelector, OrgBar } from './shared'

const blank = { classification: '', county: '', base_rate: '', fringe_rate: '' }

export default function PrevailingWage({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() { if (org.selectedOrg) setRows(await listDeterminations(org.selectedOrg)) }
  useEffect(() => { load() }, [org.selectedOrg])

  async function submit(e) {
    e.preventDefault()
    if (!form.classification.trim()) return
    setSaving(true)
    await addDetermination(org.selectedOrg, {
      classification: form.classification.trim(), county: form.county || null,
      base_rate: parseFloat(form.base_rate) || 0, fringe_rate: parseFloat(form.fringe_rate) || 0,
    })
    setSaving(false); setForm(blank); setShowForm(false); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Prevailing Wage</h2><span className="badge">{rows.length} rates</span></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Rate'}</button>
      </div>
      <OrgBar {...org} />
      <p style={{ color: 'var(--mist)', maxWidth: 720 }}>
        Enter the base hourly rate and fringe from the applicable DOL wage determination for each work classification.
        Certified Payroll pulls these rates automatically.
      </p>

      {showForm && (
        <form className="inline-form" onSubmit={submit} style={{ margin: '12px 0 20px', flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ minWidth: 220 }}><label>Classification</label><input value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value })} placeholder="Sheet Metal Worker (HVAC)" required /></div>
          <div className="field"><label>County</label><input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} placeholder="(optional)" /></div>
          <div className="field"><label>Base rate $/hr</label><input type="number" step="0.01" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} required /></div>
          <div className="field"><label>Fringe $/hr</label><input type="number" step="0.01" value={form.fringe_rate} onChange={(e) => setForm({ ...form, fringe_rate: e.target.value })} /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>Add</button>
        </form>
      )}

      <table className="data-table">
        <thead><tr><th>Classification</th><th>County</th><th>Base rate</th><th>Fringe</th><th>Total pkg</th><th></th></tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td>{d.classification}</td><td>{d.county || 'any'}</td>
              <td>${Number(d.base_rate).toFixed(2)}</td><td>${Number(d.fringe_rate).toFixed(2)}</td>
              <td style={{ fontWeight: 700 }}>${(Number(d.base_rate) + Number(d.fringe_rate)).toFixed(2)}</td>
              <td><button className="logout-button" onClick={() => { if (confirm('Delete this rate?')) deleteDetermination(d.id).then(load) }}>Delete</button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No wage determinations yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
