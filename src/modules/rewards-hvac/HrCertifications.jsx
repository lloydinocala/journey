// Rewards-HVAC · Certifications & Licenses — with expiry status (EPA 608, NATE, licenses…)
import { useState, useEffect } from 'react'
import { listEmployees, listCertifications, addCertification, updateCertification, deleteCertification, CERT_TYPES, certLabel } from './hrData'
import { useOrgSelector, OrgBar, FlagChip, daysUntil } from './shared'

const blank = { employee_id: '', cert_type: 'epa_608', identifier: '', issued_date: '', expires_date: '' }

function statusFor(expires) {
  const d = daysUntil(expires)
  if (d === null) return { label: 'No expiry', tone: 'ok' }
  if (d < 0) return { label: `Expired ${Math.abs(d)}d ago`, tone: 'red' }
  if (d <= 60) return { label: `Expires in ${d}d`, tone: 'amber' }
  return { label: `Valid (${d}d)`, tone: 'ok' }
}

export default function HrCertifications({ profile }) {
  const org = useOrgSelector(profile)
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [filterEmp, setFilterEmp] = useState('')
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    const [emps, certs] = await Promise.all([
      listEmployees(org.selectedOrg, { includeInactive: true }),
      listCertifications(org.selectedOrg, { employeeId: filterEmp || undefined }),
    ])
    setEmployees(emps); setRows(certs)
  }
  useEffect(() => { load() }, [org.selectedOrg, filterEmp])

  const empName = (id) => (employees.find((e) => e.id === id) || {}).full_name || '—'

  async function submit(e) {
    e.preventDefault()
    if (!form.employee_id || !form.cert_type) return
    setSaving(true)
    await addCertification(org.selectedOrg, {
      employee_id: form.employee_id, cert_type: form.cert_type, identifier: form.identifier || null,
      issued_date: form.issued_date || null, expires_date: form.expires_date || null,
    })
    setSaving(false); setForm(blank); setShowForm(false); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Certifications &amp; Licenses</h2><span className="badge">{rows.length} shown</span></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Cert'}</button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form className="inline-form" onSubmit={submit} style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ minWidth: 200 }}><label>Employee</label>
            <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required>
              <option value="">— select —</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
          <div className="field"><label>Type</label>
            <select value={form.cert_type} onChange={(e) => setForm({ ...form, cert_type: e.target.value })}>
              {CERT_TYPES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
          <div className="field"><label>Identifier / #</label><input value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} /></div>
          <div className="field"><label>Issued</label><input type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} /></div>
          <div className="field"><label>Expires</label><input type="date" value={form.expires_date} onChange={(e) => setForm({ ...form, expires_date: e.target.value })} /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>{saving ? 'Saving…' : 'Add'}</button>
        </form>
      )}

      <div className="field" style={{ maxWidth: 300, marginBottom: 12 }}>
        <label>Filter by employee</label>
        <select value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}>
          <option value="">All employees</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
      </div>

      <table className="data-table">
        <thead><tr><th>Employee</th><th>Certification</th><th>Identifier</th><th>Expires</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const st = statusFor(r.expires_date)
            return (
              <tr key={r.id}>
                <td>{empName(r.employee_id)}</td>
                <td>{certLabel(r.cert_type)}</td>
                <td>{r.identifier || '—'}</td>
                <td>{r.expires_date || '—'}</td>
                <td>{st.tone === 'ok' ? <span style={{ color: '#166534' }}>{st.label}</span> : <FlagChip severity={st.tone}>{st.label}</FlagChip>}</td>
                <td><button className="logout-button" onClick={() => { if (confirm('Delete this certification?')) deleteCertification(r.id).then(load) }}>Delete</button></td>
              </tr>
            )
          })}
          {rows.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No certifications tracked yet. Add EPA 608, licenses, DOT medical cards, etc.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
