// Rewards-HVAC · Employees — HR master (extends the shared `employees` table)
import { useState, useEffect } from 'react'
import {
  listEmployees, addEmployee, updateEmployee, listUsers,
  getEmployeeHr, upsertEmployeeHr, seedOnboarding,
} from './hrData'
import { useOrgSelector, OrgBar } from './shared'

const blankNew = { full_name: '', role: '', pay_type: 'hourly', hourly_rate: '', annual_salary: '', hire_date: '', user_id: '' }

export default function HrEmployees({ profile }) {
  const org = useOrgSelector(profile)
  const [employees, setEmployees] = useState([])
  const [users, setUsers] = useState([])
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)   // { emp, hr }

  async function load() {
    if (!org.selectedOrg) return
    const [emps, us] = await Promise.all([
      listEmployees(org.selectedOrg, { includeInactive: showInactive }),
      listUsers(org.selectedOrg),
    ])
    setEmployees(emps); setUsers(us)
  }
  useEffect(() => { load() }, [org.selectedOrg, showInactive])

  async function handleAdd(e) {
    e.preventDefault(); setError('')
    if (!form.full_name.trim()) return
    setSaving(true)
    const { data: emp, error: err } = await addEmployee(org.selectedOrg, {
      full_name: form.full_name.trim(),
      role: form.role || null,
      pay_type: form.pay_type,
      hourly_rate: form.pay_type === 'hourly' ? parseFloat(form.hourly_rate) || null : null,
      annual_salary: form.pay_type === 'salary' ? parseFloat(form.annual_salary) || null : null,
      hire_date: form.hire_date || null,
      user_id: form.user_id || null,
      is_active: true,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    await seedOnboarding(org.selectedOrg, emp.id)
    setForm(blankNew); setShowForm(false); load()
  }

  async function openDetail(emp) {
    const hr = await getEmployeeHr(org.selectedOrg, emp.id)
    setSelected({ emp: { ...emp }, hr: hr || {} })
  }

  async function saveDetail() {
    const { emp, hr } = selected
    setSaving(true)
    await updateEmployee(emp.id, {
      full_name: emp.full_name, role: emp.role, pay_type: emp.pay_type,
      hourly_rate: emp.hourly_rate, annual_salary: emp.annual_salary,
      hire_date: emp.hire_date, is_active: emp.is_active,
    })
    await upsertEmployeeHr(org.selectedOrg, emp.id, {
      dob: hr.dob || null, ssn_last4: hr.ssn_last4 || null, filing_status: hr.filing_status || null,
      worker_type: hr.worker_type || 'w2', i9_status: hr.i9_status || 'pending',
      i9_completed_at: hr.i9_completed_at || null, i9_reverify_due: hr.i9_reverify_due || null,
      home_address: hr.home_address || null, emergency_contact: hr.emergency_contact || null,
    })
    setSaving(false); setSelected(null); load()
  }

  const setEmp = (patch) => setSelected((s) => ({ ...s, emp: { ...s.emp, ...patch } }))
  const setHr = (patch) => setSelected((s) => ({ ...s, hr: { ...s.hr, ...patch } }))

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Employees</h2>
          <span className="badge">{employees.length} shown</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Employee'}
        </button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="field"><label>Full name</label>
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
          <div className="field"><label>Role / title</label>
            <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Service Tech" /></div>
          <div className="field"><label>Pay type</label>
            <select value={form.pay_type} onChange={(e) => setForm({ ...form, pay_type: e.target.value })}>
              <option value="hourly">Hourly</option><option value="salary">Salary</option>
            </select></div>
          {form.pay_type === 'hourly' ? (
            <div className="field"><label>Hourly rate</label>
              <input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} /></div>
          ) : (
            <div className="field"><label>Annual salary</label>
              <input type="number" step="1" value={form.annual_salary} onChange={(e) => setForm({ ...form, annual_salary: e.target.value })} /></div>
          )}
          <div className="field"><label>Hire date</label>
            <input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
          <div className="field" style={{ minWidth: 200 }}><label>Login (optional)</label>
            <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
              <option value="">— none —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select></div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Adding…' : 'Add'}</button>
        </form>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <label className="nav-link" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 12 }}>
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ marginRight: 6 }} />
        Show inactive
      </label>

      <table className="data-table">
        <thead><tr><th>Name</th><th>Role</th><th>Pay</th><th>Hire date</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id}>
              <td>{e.full_name}</td>
              <td>{e.role || '—'}</td>
              <td>{e.pay_type === 'salary' ? `$${e.annual_salary || 0}/yr` : `$${e.hourly_rate || 0}/hr`}</td>
              <td>{e.hire_date || '—'}</td>
              <td>{e.is_active ? 'Active' : 'Inactive'}</td>
              <td><button className="logout-button" onClick={() => openDetail(e)}>Edit</button></td>
            </tr>
          ))}
          {employees.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No employees yet. Add your team to begin.</td></tr>}
        </tbody>
      </table>

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 }} onClick={() => setSelected(null)}>
          <div style={{ width: 'min(560px, 100%)', background: '#fff', height: '100%', overflowY: 'auto', padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div className="page-header-bar"><h2 style={{ fontSize: 20 }}>{selected.emp.full_name}</h2>
              <button className="logout-button" onClick={() => setSelected(null)}>Close</button></div>

            <h3 style={{ marginTop: 8 }}>Employment</h3>
            <div className="inline-form" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div className="field"><label>Full name</label><input value={selected.emp.full_name || ''} onChange={(e) => setEmp({ full_name: e.target.value })} /></div>
              <div className="field"><label>Role</label><input value={selected.emp.role || ''} onChange={(e) => setEmp({ role: e.target.value })} /></div>
              <div className="field"><label>Pay type</label>
                <select value={selected.emp.pay_type || 'hourly'} onChange={(e) => setEmp({ pay_type: e.target.value })}>
                  <option value="hourly">Hourly</option><option value="salary">Salary</option></select></div>
              <div className="field"><label>Hourly rate</label><input type="number" step="0.01" value={selected.emp.hourly_rate || ''} onChange={(e) => setEmp({ hourly_rate: parseFloat(e.target.value) || null })} /></div>
              <div className="field"><label>Annual salary</label><input type="number" value={selected.emp.annual_salary || ''} onChange={(e) => setEmp({ annual_salary: parseFloat(e.target.value) || null })} /></div>
              <div className="field"><label>Hire date</label><input type="date" value={selected.emp.hire_date || ''} onChange={(e) => setEmp({ hire_date: e.target.value })} /></div>
              <div className="field"><label>Active</label>
                <select value={selected.emp.is_active ? '1' : '0'} onChange={(e) => setEmp({ is_active: e.target.value === '1' })}>
                  <option value="1">Active</option><option value="0">Inactive</option></select></div>
            </div>

            <h3 style={{ marginTop: 18 }}>HR &amp; tax profile</h3>
            <div className="inline-form" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div className="field"><label>Worker type</label>
                <select value={selected.hr.worker_type || 'w2'} onChange={(e) => setHr({ worker_type: e.target.value })}>
                  <option value="w2">W-2 employee</option><option value="1099">1099 contractor</option></select></div>
              <div className="field"><label>Filing status</label>
                <select value={selected.hr.filing_status || ''} onChange={(e) => setHr({ filing_status: e.target.value })}>
                  <option value="">—</option><option value="single">Single</option><option value="married">Married</option><option value="hoh">Head of household</option></select></div>
              <div className="field"><label>SSN (last 4)</label><input maxLength="4" value={selected.hr.ssn_last4 || ''} onChange={(e) => setHr({ ssn_last4: e.target.value.replace(/\D/g, '') })} /></div>
              <div className="field"><label>Date of birth</label><input type="date" value={selected.hr.dob || ''} onChange={(e) => setHr({ dob: e.target.value })} /></div>
              <div className="field"><label>I-9 status</label>
                <select value={selected.hr.i9_status || 'pending'} onChange={(e) => setHr({ i9_status: e.target.value })}>
                  <option value="pending">Pending</option><option value="section1">Section 1 done</option><option value="verified">Verified</option><option value="reverify_due">Reverify due</option></select></div>
              <div className="field"><label>I-9 reverify due</label><input type="date" value={selected.hr.i9_reverify_due || ''} onChange={(e) => setHr({ i9_reverify_due: e.target.value })} /></div>
            </div>
            <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 8 }}>
              Full SSN and bank details are captured in a later (encrypted) phase — store only the last four here for now.
            </p>

            <button className="auth-button" style={{ width: 'auto', marginTop: 16 }} disabled={saving} onClick={saveDetail}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
