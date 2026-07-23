// Rewards-HVAC · Discipline — progressive discipline record trail
import { useState, useEffect } from 'react'
import { listEmployees, listDiscipline, addDiscipline, DISCIPLINE_TYPES } from './hrData'
import { useOrgSelector, OrgBar } from './shared'

const TYPE_LABEL = { verbal: 'Verbal warning', written: 'Written warning', final: 'Final warning', suspension: 'Suspension', termination: 'Termination' }
const blank = { employee_id: '', type: 'verbal', incident_date: '', incident: '', description: '', improvement_plan: '', follow_up_date: '' }

export default function HrDiscipline({ profile }) {
  const org = useOrgSelector(profile)
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [filterEmp, setFilterEmp] = useState('')
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    const [emps, recs] = await Promise.all([
      listEmployees(org.selectedOrg, { includeInactive: true }),
      listDiscipline(org.selectedOrg, filterEmp || undefined),
    ])
    setEmployees(emps); setRows(recs)
  }
  useEffect(() => { load() }, [org.selectedOrg, filterEmp])

  const empName = (id) => (employees.find((e) => e.id === id) || {}).full_name || '—'

  async function submit(e) {
    e.preventDefault()
    if (!form.employee_id || !form.incident_date) return
    setSaving(true)
    await addDiscipline(org.selectedOrg, {
      employee_id: form.employee_id, type: form.type, incident_date: form.incident_date,
      incident: form.incident || null, description: form.description || null,
      improvement_plan: form.improvement_plan || null, follow_up_date: form.follow_up_date || null,
      issued_by: profile.id || null,
    })
    setSaving(false); setForm(blank); setShowForm(false); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Discipline</h2><span className="badge">{rows.length} records</span></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Record'}</button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form onSubmit={submit} style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div className="inline-form" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div className="field" style={{ minWidth: 200 }}><label>Employee</label>
              <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required>
                <option value="">— select —</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
            <div className="field"><label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {DISCIPLINE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></div>
            <div className="field"><label>Incident date</label><input type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} required /></div>
            <div className="field"><label>Follow-up date</label><input type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} /></div>
          </div>
          <div className="field" style={{ marginTop: 12 }}><label>Incident summary</label><input value={form.incident} onChange={(e) => setForm({ ...form, incident: e.target.value })} style={{ width: '100%' }} /></div>
          <div className="field" style={{ marginTop: 12 }}><label>Details</label><textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: '100%' }} /></div>
          <div className="field" style={{ marginTop: 12 }}><label>Improvement plan</label><textarea rows="2" value={form.improvement_plan} onChange={(e) => setForm({ ...form, improvement_plan: e.target.value })} style={{ width: '100%' }} /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto', marginTop: 14 }} disabled={saving}>{saving ? 'Saving…' : 'Add record'}</button>
        </form>
      )}

      <div className="field" style={{ maxWidth: 300, marginBottom: 12 }}>
        <label>Filter by employee</label>
        <select value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}>
          <option value="">All employees</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
      </div>

      <table className="data-table">
        <thead><tr><th>Date</th><th>Employee</th><th>Type</th><th>Incident</th><th>Follow-up</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.incident_date || '—'}</td>
              <td>{empName(r.employee_id)}</td>
              <td>{TYPE_LABEL[r.type] || r.type}</td>
              <td>{r.incident || r.description || '—'}</td>
              <td>{r.follow_up_date || '—'}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No discipline records.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
