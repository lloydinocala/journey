// Rewards-HVAC · Separations — the offboarding / termination record.
// Deliberately constrained: the official, printable record shows only the
// separation type, dates, rehire eligibility, and generic BEHAVIOR reason
// codes. It intentionally offers NO competency reason (which would support an
// unemployment claim) and NO accusatory reason such as theft without an arrest
// (lawsuit exposure). The confidential note is internal only and never printed.
import { useState, useEffect } from 'react'
import { listEmployees, updateEmployee, listSeparations, addSeparation, SEPARATION_REASONS, separationReasonLabel } from './hrData'
import { useOrgSelector, OrgBar } from './shared'

const TYPE_LABEL = { voluntary: 'Voluntary', involuntary: 'Involuntary', layoff: 'Layoff' }
const blank = {
  employee_id: '', separation_type: 'involuntary', effective_date: '', last_day_worked: '',
  rehire_eligible: 'yes', reasons: [], confidential_note: '', mark_inactive: true,
}

export default function HrSeparations({ profile }) {
  const org = useOrgSelector(profile)
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const [emps, seps] = await Promise.all([
      listEmployees(org.selectedOrg, { includeInactive: true }),
      listSeparations(org.selectedOrg),
    ])
    setEmployees(emps); setRows(seps)
  }
  useEffect(() => { load() }, [org.selectedOrg]) // eslint-disable-line react-hooks/exhaustive-deps

  const empName = (id) => (employees.find((e) => e.id === id) || {}).full_name || '—'

  function toggleReason(key) {
    setForm((f) => ({ ...f, reasons: f.reasons.includes(key) ? f.reasons.filter((r) => r !== key) : [...f.reasons, key] }))
  }

  async function submit(e) {
    e.preventDefault(); setError('')
    if (!form.employee_id || !form.effective_date) { setError('Employee and effective date are required.'); return }
    setSaving(true)
    const { error: err } = await addSeparation(org.selectedOrg, {
      employee_id: form.employee_id,
      separation_type: form.separation_type,
      effective_date: form.effective_date,
      last_day_worked: form.last_day_worked || null,
      rehire_eligible: form.rehire_eligible === 'yes',
      reasons: form.reasons,
      confidential_note: form.confidential_note || null,
      created_by: profile.id || null,
    })
    if (!err && form.mark_inactive) await updateEmployee(form.employee_id, { is_active: false })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(blank); setShowForm(false); load()
  }

  function printRecord(r) {
    const w = window.open('', '_blank', 'width=760,height=900'); if (!w) return
    const reasons = (r.reasons || []).map(separationReasonLabel).join(', ') || '—'
    w.document.write(`<html><head><title>Separation Record — ${empName(r.employee_id)}</title>
      <style>body{font-family:Arial,sans-serif;padding:36px;color:#111;max-width:640px}
      h1{font-size:20px;margin:0 0 4px}.sub{color:#666;font-size:13px;margin-bottom:24px}
      table{border-collapse:collapse;width:100%}td{padding:8px 6px;border-bottom:1px solid #e5e5e5;font-size:14px;vertical-align:top}
      td.l{color:#555;width:200px}.foot{margin-top:28px;color:#888;font-size:11px}</style></head><body>
      <h1>Separation Record</h1><div class="sub">${empName(r.employee_id)}</div>
      <table><tbody>
      <tr><td class="l">Separation type</td><td>${TYPE_LABEL[r.separation_type] || r.separation_type}</td></tr>
      <tr><td class="l">Effective date</td><td>${r.effective_date || '—'}</td></tr>
      <tr><td class="l">Last day worked</td><td>${r.last_day_worked || '—'}</td></tr>
      <tr><td class="l">Eligible for rehire</td><td><strong>${r.rehire_eligible ? 'Eligible for Rehire' : 'Not Eligible for Rehire'}</strong></td></tr>
      <tr><td class="l">Reason(s)</td><td>${reasons}</td></tr>
      </tbody></table>
      <div class="foot">This record is limited to separation status and general reasons. It does not describe job performance or make any accusation.</div>
      </body></html>`)
    w.document.close(); w.focus(); w.print()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Separations</h2><span className="badge">{rows.length} on file</span></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Separation'}</button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form onSubmit={submit} style={{ marginBottom: 22, border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div className="inline-form" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div className="field" style={{ minWidth: 220 }}><label>Employee</label>
              <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required>
                <option value="">— select —</option>{employees.filter((e) => e.is_active).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
            <div className="field"><label>Type</label>
              <select value={form.separation_type} onChange={(e) => setForm({ ...form, separation_type: e.target.value })}>
                <option value="involuntary">Involuntary</option><option value="voluntary">Voluntary</option><option value="layoff">Layoff</option></select></div>
            <div className="field"><label>Effective date</label><input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} required /></div>
            <div className="field"><label>Last day worked</label><input type="date" value={form.last_day_worked} onChange={(e) => setForm({ ...form, last_day_worked: e.target.value })} /></div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Eligible for rehire</label>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ cursor: 'pointer' }}><input type="radio" name="rehire" checked={form.rehire_eligible === 'yes'} onChange={() => setForm({ ...form, rehire_eligible: 'yes' })} /> Eligible for Rehire</label>
              <label style={{ cursor: 'pointer' }}><input type="radio" name="rehire" checked={form.rehire_eligible === 'no'} onChange={() => setForm({ ...form, rehire_eligible: 'no' })} /> Not Eligible for Rehire</label>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Reason(s) — general behavior only</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {SEPARATION_REASONS.map((r) => (
                <label key={r.key} style={{ cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, background: form.reasons.includes(r.key) ? '#EEF4FF' : '#fff' }}>
                  <input type="checkbox" checked={form.reasons.includes(r.key)} onChange={() => toggleReason(r.key)} style={{ marginRight: 6 }} />{r.label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px' }}>
            <label style={{ display: 'block', fontSize: 13, color: '#9A3412', fontWeight: 700, marginBottom: 4 }}>Confidential internal note — never printed or shared</label>
            <textarea rows="2" value={form.confidential_note} onChange={(e) => setForm({ ...form, confidential_note: e.target.value })} style={{ width: '100%' }} placeholder="Optional. Do not record performance/competency judgments or unproven accusations." />
            <div style={{ fontSize: 11.5, color: '#9A3412', marginTop: 4 }}>
              Keep the official record to behavior and eligibility only. Competency reasons can support an unemployment claim; unproven accusations (e.g. theft without an arrest) create lawsuit exposure.
            </div>
          </div>

          <label style={{ display: 'inline-block', marginTop: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.mark_inactive} onChange={(e) => setForm({ ...form, mark_inactive: e.target.checked })} style={{ marginRight: 6 }} />
            Also mark this employee inactive
          </label>

          {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
          <div><button className="auth-button" type="submit" style={{ width: 'auto', marginTop: 14 }} disabled={saving}>{saving ? 'Saving…' : 'Record separation'}</button></div>
        </form>
      )}

      <table className="data-table">
        <thead><tr><th>Employee</th><th>Type</th><th>Effective</th><th>Rehire</th><th>Reason(s)</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{empName(r.employee_id)}</td>
              <td>{TYPE_LABEL[r.separation_type] || r.separation_type}</td>
              <td>{r.effective_date || '—'}</td>
              <td style={{ color: r.rehire_eligible ? '#166534' : '#B00020', fontWeight: 600 }}>{r.rehire_eligible ? 'Eligible' : 'Not eligible'}</td>
              <td>{(r.reasons || []).map(separationReasonLabel).join(', ') || '—'}</td>
              <td style={{ textAlign: 'right' }}><button className="logout-button" onClick={() => printRecord(r)}>🖨 Print record</button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No separations on file.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
