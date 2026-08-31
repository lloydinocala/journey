// Rewards-HVAC · Documents — record store with a retention clock
import { useState, useEffect } from 'react'
import { listEmployees, listDocuments, addDocument, uploadHrFile, signedHrUrl } from './hrData'
import { useOrgSelector, OrgBar, daysUntil } from './shared'

async function openFile(path) { const u = await signedHrUrl(path); if (u) window.open(u, '_blank') }

const CATEGORIES = [
  { key: 'i9', label: 'Form I-9', anchor: 'termination', note: '3 yrs after hire OR 1 yr after termination, whichever is later' },
  { key: 'w4', label: 'Form W-4', anchor: 'termination', note: 'Keep with employment tax records (≥4 yrs)' },
  { key: 'payroll', label: 'Payroll record', anchor: 'tax_due', note: '3 yrs (FLSA)' },
  { key: 'tax', label: 'Tax filing', anchor: 'tax_due', note: '≥4 yrs after tax due/paid (IRS)' },
  { key: 'certified_payroll', label: 'Certified payroll', anchor: 'project', note: '3 yrs after project completion (Davis-Bacon)' },
  { key: 'policy', label: 'Policy / handbook', anchor: 'none', note: 'Retain current + superseded' },
  { key: 'other', label: 'Other', anchor: 'none', note: '' },
]
const blank = { title: '', category: 'i9', employee_id: '', retain_until: '' }

export default function HrDocuments({ profile }) {
  const org = useOrgSelector(profile)
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(blank)
  const [file, setFile] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    const [emps, docs] = await Promise.all([listEmployees(org.selectedOrg, { includeInactive: true }), listDocuments(org.selectedOrg)])
    setEmployees(emps); setRows(docs)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const empName = (id) => id ? ((employees.find((e) => e.id === id) || {}).full_name || '—') : 'Org-level'
  const cat = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1]

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const c = cat(form.category)
    let storage_path = null, file_name = null
    if (file) {
      const up = await uploadHrFile(org.selectedOrg, form.employee_id || 'org', file)
      if (up.error) { setSaving(false); alert('Upload failed: ' + up.error.message); return }
      storage_path = up.path; file_name = up.name
    }
    await addDocument(org.selectedOrg, {
      title: form.title.trim(), category: form.category, employee_id: form.employee_id || null,
      retention_anchor: c.anchor, retain_until: form.retain_until || null, storage_path, file_name,
    })
    setSaving(false); setForm(blank); setFile(null); setShowForm(false); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Documents</h2><span className="badge">{rows.length} records</span></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Document'}</button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form className="inline-form" onSubmit={submit} style={{ marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ minWidth: 220 }}><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="field"><label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
          <div className="field" style={{ minWidth: 200 }}><label>Employee (optional)</label>
            <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">— org-level —</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
          <div className="field"><label>Retain until</label><input type="date" value={form.retain_until} onChange={(e) => setForm({ ...form, retain_until: e.target.value })} /></div>
          <div className="field"><label>Attach scan / photo (optional)</label><input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>{saving ? 'Saving…' : 'Add'}</button>
        </form>
      )}
      <p style={{ color: 'var(--mist)', fontSize: 12, marginBottom: 16 }}>
        Retention guide — {cat(form.category).note || 'see federal/state rules'}. Attach the actual scan or photo when adding a
        document; it is stored securely and openable with View. Employees can view their own documents in their portal.
      </p>

      <table className="data-table">
        <thead><tr><th>Title</th><th>Category</th><th>Belongs to</th><th>Retain until</th><th>Status</th><th>File</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const d = daysUntil(r.retain_until)
            const purgeable = d !== null && d < 0
            return (
              <tr key={r.id}>
                <td>{r.title || '—'}</td>
                <td>{cat(r.category).label}</td>
                <td>{empName(r.employee_id)}</td>
                <td>{r.retain_until || '—'}</td>
                <td style={{ color: purgeable ? '#166534' : 'var(--mist)' }}>{r.retain_until ? (purgeable ? 'Safe to purge' : 'Must retain') : '—'}</td>
                <td>{r.storage_path ? <button className="logout-button" onClick={() => openFile(r.storage_path)}>View</button> : '—'}</td>
              </tr>
            )
          })}
          {rows.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No documents tracked yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
