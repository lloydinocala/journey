// Rewards-HVAC · Certifications & Licenses — with expiry status (EPA 608, NATE, licenses…)
import { useState, useEffect, useMemo } from 'react'
import { listEmployees, listCertifications, addCertification, updateCertification, deleteCertification, CERT_TYPES, certLabel, uploadHrFile, signedHrUrl } from './hrData'
import { useOrgSelector, OrgBar, FlagChip, daysUntil, EmptyRoster } from './shared'
import AiAssist from '../../AiAssist'

async function openFile(path) { const u = await signedHrUrl(path); if (u) window.open(u, '_blank') }

// Turns the expiring/expired credential list into a prioritized renewal plan.
// EPA 608 is called out because a lapsed 608 legally bars a tech from buying or
// handling refrigerant — that's not just a reminder, it's "can't work" risk.
const CERT_WATCH_SYS = `You are a compliance assistant for an HVAC contractor. You are given credentials that are expired or expiring soon (employee, credential, days until expiry — negative means already expired). Write a short, prioritized renewal plan: who needs to renew what and by when, MOST urgent first. Call out EPA 608 specifically — a lapsed EPA 608 legally bars that tech from purchasing or handling refrigerant, so treat expired/expiring 608s as top priority ("cannot legally do refrigerant work"). Also flag driver's licenses and DOT medical cards as work-blocking if present. Then add one short, friendly reminder line the office could send each affected tech. Use ONLY the data given; do not invent people or dates. Under 14 lines, no headers.`

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
  const [file, setFile] = useState(null)
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

  // Expired, or expiring within 90 days — the renewal-watch working set.
  const atRisk = useMemo(() => rows
    .map((r) => ({ r, d: daysUntil(r.expires_date) }))
    .filter((x) => x.d !== null && x.d <= 90)
    .sort((a, b) => a.d - b.d)
    .map(({ r, d }) => ({ employee: empName(r.employee_id), credential: certLabel(r.cert_type), cert_type: r.cert_type, expires: r.expires_date, days_until: d })),
    [rows, employees])

  async function submit(e) {
    e.preventDefault()
    if (!form.employee_id || !form.cert_type) return
    setSaving(true)
    let storage_path = null, file_name = null
    if (file) {
      const up = await uploadHrFile(org.selectedOrg, form.employee_id, file)
      if (up.error) { setSaving(false); alert('Upload failed: ' + up.error.message); return }
      storage_path = up.path; file_name = up.name
    }
    await addCertification(org.selectedOrg, {
      employee_id: form.employee_id, cert_type: form.cert_type, identifier: form.identifier || null,
      issued_date: form.issued_date || null, expires_date: form.expires_date || null, storage_path, file_name,
    })
    setSaving(false); setForm(blank); setFile(null); setShowForm(false); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Certifications &amp; Licenses</h2><span className="badge">{rows.length} shown</span></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Cert'}</button>
      </div>
      <OrgBar {...org} />
      <EmptyRoster count={employees.length} />

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
          <div className="field"><label>Card scan / photo (optional)</label><input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>{saving ? 'Saving…' : 'Add'}</button>
        </form>
      )}

      {atRisk.length > 0 && (
        <div style={{ marginBottom: 14, border: '1px solid #F1D9B8', background: '#FFF9F0', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ color: '#9A3412', fontSize: 13.5 }}>{atRisk.length} credential{atRisk.length === 1 ? '' : 's'} expired or expiring ≤ 90 days</strong>
            <AiAssist inline title="Renewal watch" label="✦ Draft renewal plan"
              system={CERT_WATCH_SYS}
              prompt="Draft the prioritized renewal plan and a reminder line per tech, most urgent first."
              context={{ at_risk: atRisk }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--mist)' }}>Sends only names, credential types, and dates. EPA 608 lapses are treated as work-blocking.</span>
        </div>
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
                <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {r.storage_path && <button className="logout-button" onClick={() => openFile(r.storage_path)}>View</button>}
                  <button className="logout-button" onClick={() => { if (confirm('Delete this certification?')) deleteCertification(r.id).then(load) }}>Delete</button>
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No certifications tracked yet. Add EPA 608, licenses, DOT medical cards, etc.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
