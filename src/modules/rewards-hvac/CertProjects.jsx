// Rewards-HVAC · Projects — public-works jobs subject to prevailing wage.
import { useState, useEffect } from 'react'
import { listProjects, addProject, updateProject } from './r6Data'
import { useOrgSelector, OrgBar } from './shared'

const blank = { name: '', contract_number: '', agency: '', funding_type: 'federal', county: '', state: 'FL', wage_determination_ref: '' }

export default function CertProjects({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() { if (org.selectedOrg) setRows(await listProjects(org.selectedOrg, { includeInactive: true })) }
  useEffect(() => { load() }, [org.selectedOrg])

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await addProject(org.selectedOrg, { ...form, name: form.name.trim(), state: (form.state || '').toUpperCase() })
    setSaving(false); setForm(blank); setShowForm(false); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Projects</h2><span className="badge">{rows.length}</span></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Project'}</button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form onSubmit={submit} style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div className="inline-form" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div className="field"><label>Project name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Contract #</label><input value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })} /></div>
            <div className="field"><label>Agency</label><input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} placeholder="e.g. USACE" /></div>
            <div className="field"><label>Funding</label>
              <select value={form.funding_type} onChange={(e) => setForm({ ...form, funding_type: e.target.value })}>
                <option value="federal">Federal (Davis-Bacon)</option><option value="state">State</option><option value="local">Local</option></select></div>
            <div className="field"><label>County</label><input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} /></div>
            <div className="field"><label>State</label><input maxLength="2" style={{ textTransform: 'uppercase' }} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} /></div>
            <div className="field"><label>WD number</label><input value={form.wage_determination_ref} onChange={(e) => setForm({ ...form, wage_determination_ref: e.target.value })} placeholder="FL20240012" /></div>
          </div>
          <button className="auth-button" type="submit" style={{ width: 'auto', marginTop: 12 }} disabled={saving}>Add project</button>
        </form>
      )}

      <table className="data-table">
        <thead><tr><th>Project</th><th>Contract #</th><th>Agency</th><th>Funding</th><th>County</th><th>WD #</th><th></th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} style={p.active ? undefined : { opacity: 0.5 }}>
              <td>{p.name}</td><td>{p.contract_number || '—'}</td><td>{p.agency || '—'}</td>
              <td style={{ textTransform: 'capitalize' }}>{p.funding_type}</td><td>{p.county || '—'}{p.state ? `, ${p.state}` : ''}</td><td>{p.wage_determination_ref || '—'}</td>
              <td><button className="logout-button" onClick={() => updateProject(p.id, { active: !p.active }).then(load)}>{p.active ? 'Archive' : 'Restore'}</button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>No projects yet. Add a public-works project to run certified payroll.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
