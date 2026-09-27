// Rewards-HVAC · Job Descriptions library
import { useState, useEffect } from 'react'
import { listJobDescriptions, addJobDescription, updateJobDescription } from './hrData'
import { useOrgSelector, OrgBar } from './shared'
import AiAssist from '../../AiAssist'

const blank = { title: '', classification: '', flsa_status: 'non_exempt', pay_range_low: '', pay_range_high: '', summary: '', duties: '', requirements: '' }

// AI drafts a job description from the role details already typed in. It returns
// three clearly-marked sections so we can drop each into its own field. Nothing
// is saved until the user reviews and clicks Add/Update — this only fills the form.
const JD_SYS = `You are an HR writer for an HVAC contracting company. Write a clear, professional job description from the role details given. Ground it in real HVAC field-service work (installs, service, maintenance, EPA 608 where relevant, safety, customer interaction). Do NOT invent a pay rate, benefits, or an FLSA status — use only what is given. Keep it honest and specific, not inflated. Return EXACTLY three sections in this format, nothing else:
### SUMMARY
<2-3 sentence overview of the role>
### DUTIES
<6-9 bullet lines, each starting with "- ", action-first>
### REQUIREMENTS
<5-8 bullet lines, each starting with "- ": skills, certifications, experience, physical/licensing requirements>`

// Split the AI's marked-up draft back into the three form fields. If the markers
// are missing for any reason, fall back to putting everything in Summary.
function parseJd(text) {
  const t = (text || '').replace(/\r/g, '')
  const grab = (label, next) => {
    const re = new RegExp(`###\\s*${label}\\s*\\n([\\s\\S]*?)(?=\\n###\\s*(?:${next})|$)`, 'i')
    const m = t.match(re)
    return m ? m[1].trim() : ''
  }
  const summary = grab('SUMMARY', 'DUTIES|REQUIREMENTS')
  const duties = grab('DUTIES', 'REQUIREMENTS')
  const requirements = grab('REQUIREMENTS', 'SUMMARY')
  if (!summary && !duties && !requirements) return { summary: t.trim(), duties: '', requirements: '' }
  return { summary, duties, requirements }
}

const flsaLabel = (s) => (s === 'exempt' ? 'Exempt (no overtime)' : 'Non-exempt (overtime eligible)')

export default function HrJobDescriptions({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [showInactive, setShowInactive] = useState(false)
  const [form, setForm] = useState(blank)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setRows(await listJobDescriptions(org.selectedOrg, { includeInactive: showInactive }))
  }
  useEffect(() => { load() }, [org.selectedOrg, showInactive])

  function edit(r) {
    setEditingId(r.id)
    setForm({ title: r.title, classification: r.classification || '', flsa_status: r.flsa_status || 'non_exempt',
      pay_range_low: r.pay_range_low ?? '', pay_range_high: r.pay_range_high ?? '', summary: r.summary || '', duties: r.duties || '', requirements: r.requirements || '' })
    setShowForm(true)
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title: form.title.trim(), classification: form.classification || null, flsa_status: form.flsa_status,
      pay_range_low: parseFloat(form.pay_range_low) || null, pay_range_high: parseFloat(form.pay_range_high) || null,
      summary: form.summary || null, duties: form.duties || null, requirements: form.requirements || null,
    }
    if (editingId) await updateJobDescription(editingId, payload)
    else await addJobDescription(org.selectedOrg, payload)
    setSaving(false); setForm(blank); setEditingId(null); setShowForm(false); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Job Descriptions</h2><span className="badge">{rows.length} shown</span></div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => { setForm(blank); setEditingId(null); setShowForm(!showForm) }}>
          {showForm ? 'Cancel' : '+ New Description'}
        </button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form onSubmit={submit} style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div className="inline-form" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="field"><label>Classification</label><input value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value })} placeholder="HVAC Installer" /></div>
            <div className="field"><label>FLSA status</label>
              <select value={form.flsa_status} onChange={(e) => setForm({ ...form, flsa_status: e.target.value })}>
                <option value="non_exempt">Non-exempt (OT eligible)</option><option value="exempt">Exempt</option></select></div>
            <div className="field"><label>Pay range low</label><input type="number" value={form.pay_range_low} onChange={(e) => setForm({ ...form, pay_range_low: e.target.value })} /></div>
            <div className="field"><label>Pay range high</label><input type="number" value={form.pay_range_high} onChange={(e) => setForm({ ...form, pay_range_high: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {form.title.trim() ? (
              <AiAssist inline title={`Draft: ${form.title.trim()}`} label="✦ Draft with AI"
                insertLabel="Fill Summary / Duties / Requirements"
                system={JD_SYS}
                prompt="Write the job description for this role using only the details provided."
                context={{
                  title: form.title.trim(),
                  classification: form.classification || null,
                  flsa_status: flsaLabel(form.flsa_status),
                  pay_range: (form.pay_range_low || form.pay_range_high) ? `$${form.pay_range_low || '?'}–$${form.pay_range_high || '?'}` : null,
                }}
                onInsert={(text) => { const p = parseJd(text); setForm((f) => ({ ...f, summary: p.summary || f.summary, duties: p.duties || f.duties, requirements: p.requirements || f.requirements })) }} />
            ) : (
              <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>Enter a title above, then draft the description with AI.</span>
            )}
            <span style={{ fontSize: 12, color: 'var(--mist)' }}>Fills the three fields below — review and edit before saving.</span>
          </div>
          <div className="field" style={{ marginTop: 12 }}><label>Summary</label><textarea rows="2" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} style={{ width: '100%' }} /></div>
          <div className="field" style={{ marginTop: 12 }}><label>Duties</label><textarea rows="3" value={form.duties} onChange={(e) => setForm({ ...form, duties: e.target.value })} style={{ width: '100%' }} /></div>
          <div className="field" style={{ marginTop: 12 }}><label>Requirements</label><textarea rows="3" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} style={{ width: '100%' }} /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto', marginTop: 14 }} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update' : 'Add'}</button>
        </form>
      )}

      <label className="nav-link" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 12 }}>
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ marginRight: 6 }} /> Show archived
      </label>

      <table className="data-table">
        <thead><tr><th>Title</th><th>Classification</th><th>FLSA</th><th>Pay range</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.title}</td>
              <td>{r.classification || '—'}</td>
              <td style={{ textTransform: 'capitalize' }}>{(r.flsa_status || '').replace('_', '-')}</td>
              <td>{r.pay_range_low || r.pay_range_high ? `$${r.pay_range_low || '?'} – $${r.pay_range_high || '?'}` : '—'}</td>
              <td style={{ display: 'flex', gap: 6 }}>
                <button className="logout-button" onClick={() => edit(r)}>Edit</button>
                <button className="logout-button" onClick={() => { updateJobDescription(r.id, { is_active: !r.is_active }).then(load) }}>{r.is_active ? 'Archive' : 'Restore'}</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No job descriptions yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
