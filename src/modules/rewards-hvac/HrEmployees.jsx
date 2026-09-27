// Rewards-HVAC · Employees — HR master (extends the shared `employees` table)
import { useState, useEffect } from 'react'
import {
  listEmployees, addEmployee, updateEmployee, listUsers,
  getEmployeeHr, upsertEmployeeHr, seedOnboarding,
  setEmployeeSsn, setEmployeeBank, revealEmployeeSsn, getSettings,
} from './hrData'
import { useOrgSelector, OrgBar } from './shared'
import HrOnboardingCompleteness from './HrOnboardingCompleteness'

const blankNew = { full_name: '', role: '', pay_type: 'hourly', hourly_rate: '', annual_salary: '', hire_date: '', user_id: '', manager_id: '', department: '' }
const ROLE_LABEL = { super_admin: 'Super Admin', org_admin: 'Owner / Admin', csr: 'Office', tech: 'Field Tech' }

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
  const [reveal, setReveal] = useState('')
  const [structureOn, setStructureOn] = useState(false)
  const [showImport, setShowImport] = useState(false)   // "add from login accounts" picker
  const [pickUsers, setPickUsers] = useState([])
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const [emps, us, settings] = await Promise.all([
      listEmployees(org.selectedOrg, { includeInactive: showInactive }),
      listUsers(org.selectedOrg),
      getSettings(org.selectedOrg),
    ])
    setEmployees(emps); setUsers(us); setStructureOn(!!settings?.structure_enabled)
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
      manager_id: form.manager_id || null,
      department: form.department || null,
      is_active: true,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    await seedOnboarding(org.selectedOrg, emp.id)
    setForm(blankNew); setShowForm(false); load()
  }

  // Create employee records in bulk from existing login accounts. Each becomes an
  // active employee linked to that login, with pay/role left blank to fill in later.
  async function addFromLogins() {
    const ids = pickUsers.filter((id) => !linkedUserIds.has(id))
    if (ids.length === 0) return
    setImporting(true); setImportMsg('')
    let added = 0, failed = 0
    for (const id of ids) {
      const u = users.find((x) => x.id === id)
      if (!u) continue
      const { data: emp, error: err } = await addEmployee(org.selectedOrg, {
        full_name: (u.full_name || '').trim() || 'Unnamed', pay_type: 'hourly', user_id: u.id, is_active: true,
      })
      if (err || !emp) { failed++; continue }
      try { await seedOnboarding(org.selectedOrg, emp.id) } catch { /* onboarding seed is non-fatal */ }
      added++
    }
    setImporting(false); setPickUsers([])
    setImportMsg(`Added ${added} employee${added === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}. Click Edit on each to fill in pay, role, and hire date.`)
    load()
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
      manager_id: emp.manager_id || null, department: emp.department || null,
    })
    await upsertEmployeeHr(org.selectedOrg, emp.id, {
      dob: hr.dob || null, ssn_last4: hr.ssn_last4 || null, filing_status: hr.filing_status || null,
      worker_type: hr.worker_type || 'w2', i9_status: hr.i9_status || 'pending',
      i9_completed_at: hr.i9_completed_at || null, i9_reverify_due: hr.i9_reverify_due || null,
      home_address: hr.home_address || null, emergency_contact: hr.emergency_contact || null,
      work_state: hr.work_state ? hr.work_state.toUpperCase() : null,
    })
    if (hr._newSsn) await setEmployeeSsn(emp.id, hr._newSsn)
    if (hr._newRouting && hr._newAccount) await setEmployeeBank(emp.id, hr._newRouting, hr._newAccount)
    setSaving(false); setSelected(null); setReveal(''); load()
  }

  const setEmp = (patch) => setSelected((s) => ({ ...s, emp: { ...s.emp, ...patch } }))
  const setHr = (patch) => setSelected((s) => ({ ...s, hr: { ...s.hr, ...patch } }))
  const linkedUserIds = new Set(employees.map((e) => e.user_id).filter(Boolean))

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Employees</h2>
          <span className="badge">{employees.length} shown</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0, background: '#1F7A43' }} onClick={() => { setShowImport((v) => !v); setImportMsg('') }}>
          {showImport ? 'Close' : '+ From login accounts'}
        </button>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Employee'}
        </button>
      </div>
      <OrgBar {...org} />

      {showImport && (
        <div className="section-card" style={{ padding: 16, marginBottom: 16, borderLeft: '4px solid #1F7A43' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Add employees from login accounts</div>
          <div style={{ fontSize: 12.5, color: 'var(--mist)', marginBottom: 12 }}>
            Pick the sign-in accounts to turn into employee records. Each becomes an active employee linked to that login; fill in pay, role, and hire date afterward with Edit. Accounts already linked to an employee are greyed out.
          </div>
          {users.length === 0 ? (
            <p style={{ color: 'var(--mist)', fontSize: 13, margin: 0 }}>No login accounts in this organization.</p>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                {users.map((u) => {
                  const linked = linkedUserIds.has(u.id)
                  return (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: linked ? 0.5 : 1, cursor: linked ? 'default' : 'pointer' }}>
                      <input type="checkbox" disabled={linked} checked={linked || pickUsers.includes(u.id)}
                        onChange={(e) => setPickUsers((p) => e.target.checked ? [...p, u.id] : p.filter((x) => x !== u.id))} />
                      <span style={{ fontWeight: 600 }}>{u.full_name || '(no name)'}</span>
                      <span style={{ fontSize: 12, color: 'var(--mist)' }}>{ROLE_LABEL[u.role] || u.role}</span>
                      {linked && <span style={{ fontSize: 11.5, color: '#166534', marginLeft: 'auto' }}>already an employee</span>}
                    </label>
                  )
                })}
              </div>
              <button className="auth-button" style={{ width: 'auto' }} disabled={importing || pickUsers.length === 0} onClick={addFromLogins}>
                {importing ? 'Adding…' : `Add selected (${pickUsers.length})`}
              </button>
              {importMsg && <div style={{ fontSize: 12.5, color: '#166534', marginTop: 8, fontWeight: 600 }}>{importMsg}</div>}
            </>
          )}
        </div>
      )}

      <HrOnboardingCompleteness orgId={org.selectedOrg} />

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
          {structureOn && (
            <>
              <div className="field" style={{ minWidth: 180 }}><label>Reports to</label>
                <select value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                  <option value="">— none —</option>
                  {employees.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select></div>
              <div className="field"><label>Department / crew</label>
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Service" /></div>
            </>
          )}
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
              {structureOn && (
                <>
                  <div className="field"><label>Reports to</label>
                    <select value={selected.emp.manager_id || ''} onChange={(e) => setEmp({ manager_id: e.target.value })}>
                      <option value="">— none —</option>
                      {employees.filter((m) => m.id !== selected.emp.id).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select></div>
                  <div className="field"><label>Department / crew</label>
                    <input value={selected.emp.department || ''} onChange={(e) => setEmp({ department: e.target.value })} /></div>
                </>
              )}
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
              <div className="field"><label>Work state</label><input maxLength="2" style={{ textTransform: 'uppercase' }} value={selected.hr.work_state || ''} onChange={(e) => setHr({ work_state: e.target.value.toUpperCase() })} placeholder="FL" /></div>
              <div className="field"><label>Date of birth</label><input type="date" value={selected.hr.dob || ''} onChange={(e) => setHr({ dob: e.target.value })} /></div>
              <div className="field"><label>I-9 status</label>
                <select value={selected.hr.i9_status || 'pending'} onChange={(e) => setHr({ i9_status: e.target.value })}>
                  <option value="pending">Pending</option><option value="section1">Section 1 done</option><option value="verified">Verified</option><option value="reverify_due">Reverify due</option></select></div>
              <div className="field"><label>I-9 reverify due</label><input type="date" value={selected.hr.i9_reverify_due || ''} onChange={(e) => setHr({ i9_reverify_due: e.target.value })} /></div>
            </div>
            <h3 style={{ marginTop: 18 }}>Secure info (encrypted)</h3>
            <div className="inline-form" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div className="field"><label>Full SSN{selected.hr.ssn_enc ? ' (on file)' : ''}</label>
                <input value={selected.hr._newSsn || ''} placeholder={selected.hr.ssn_enc ? '••• stored •••' : 'XXX-XX-XXXX'} onChange={(e) => setHr({ _newSsn: e.target.value })} /></div>
              <div className="field"><label>DD routing #</label><input value={selected.hr._newRouting || ''} onChange={(e) => setHr({ _newRouting: e.target.value })} /></div>
              <div className="field"><label>DD account #{selected.hr.bank_enc?.account_last4 ? ` (…${selected.hr.bank_enc.account_last4})` : ''}</label>
                <input value={selected.hr._newAccount || ''} onChange={(e) => setHr({ _newAccount: e.target.value })} /></div>
              {selected.hr.ssn_enc && (
                <button type="button" className="logout-button" style={{ marginTop: 18 }} onClick={async () => { const { data, error } = await revealEmployeeSsn(selected.emp.id); setReveal(error ? error.message : (data || '—')) }}>Reveal SSN</button>
              )}
            </div>
            {reveal && <div style={{ marginTop: 8, fontWeight: 700 }}>SSN: {reveal}</div>}
            <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 6 }}>
              Stored encrypted (pgcrypto, key in Supabase Vault). Only office roles can save or reveal; employees never see it.
              Leave blank to keep the current value.
            </p>

            <button className="auth-button" style={{ width: 'auto', marginTop: 16 }} disabled={saving} onClick={saveDetail}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
