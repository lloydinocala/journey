// Rewards-HVAC · Documents — record store with a retention clock
import { useState, useEffect } from 'react'
import { listEmployees, listDocuments, addDocument, uploadHrFile, signedHrUrl, updateEmployee } from './hrData'
import { useOrgSelector, OrgBar, daysUntil } from './shared'
import AiAssist from '../../AiAssist'
import { supabase } from '../../utils/supabase'
import { DOC_CATEGORIES, catLabel } from './complianceDocs'
import DocsCompliance from './DocsCompliance'
import DocsPolicies from './DocsPolicies'
import { listSignedForms, listAckDocs, printCertificate } from './signing'
import { orgName as getOrgName } from './hrRecords'

async function openFile(path) { const u = await signedHrUrl(path); if (u) window.open(u, '_blank') }

// "Find the right document by asking, not filing." Searches over the record
// METADATA only (title, category, who it belongs to, dates) — never the file
// contents, so no SSN or scanned PII is ever sent to the model.
const DOC_SEARCH_SYS = `You are a document-finding assistant for an HVAC contractor's HR document store. You are given a list of stored records (title, category, which employee it belongs to, retention date, upload date) and a question. Answer which record(s) best match and where to look, naming the titles and categories. If more than one could match, list them. If nothing matches, say so plainly. Use ONLY the metadata provided — you do NOT have the document contents, so never quote or infer what a document says. Be concise.`

// Suggests the filing category from the title (metadata only, no contents).
const DOC_CLASSIFY_SYS = `You classify an HR document into exactly one category from an allowed list, using only its title. Reply with ONLY the category key (lowercase, exactly as listed) and nothing else.`

const blank = { title: '', category: 'personnel', employee_id: '', retain_until: '', manual: false }
const TABS = [['required', 'Required documents'], ['documents', 'All documents'], ['policies', 'Policies to sign'], ['signed', 'Signed forms']]

export default function HrDocuments({ profile }) {
  const org = useOrgSelector(profile)
  const [tab, setTab] = useState('required')
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(blank)
  const [file, setFile] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [queryText, setQueryText] = useState('')
  const [view, setView] = useState('current')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [signed, setSigned] = useState([])
  const [ackDocs, setAckDocs] = useState([])
  const [holdPick, setHoldPick] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const [emps, docs, sf, ad] = await Promise.all([listEmployees(org.selectedOrg, { includeInactive: true }), listDocuments(org.selectedOrg), listSignedForms(org.selectedOrg), listAckDocs(org.selectedOrg, { includeInactive: true })])
    setEmployees(emps); setRows(docs); setSigned(sf); setAckDocs(ad)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const empName = (id) => id ? ((employees.find((e) => e.id === id) || {}).full_name || '—') : 'Company-wide'
  const empOf = (id) => employees.find((e) => e.id === id)
  const cat = (key) => DOC_CATEGORIES.find((c) => c.key === key) || DOC_CATEGORIES[DOC_CATEGORIES.length - 1]

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    let storage_path = null, file_name = null
    if (file) {
      const up = await uploadHrFile(org.selectedOrg, form.employee_id || 'org', file)
      if (up.error) { setSaving(false); alert('Upload failed: ' + up.error.message); return }
      storage_path = up.path; file_name = up.name
    }
    await addDocument(org.selectedOrg, {
      title: form.title.trim(), category: form.category, employee_id: form.employee_id || null,
      retention_anchor: 'computed', retain_until: form.manual ? (form.retain_until || null) : null, retain_until_manual: !!form.manual,
      storage_path, file_name, employee_visible: form.category !== 'medical',
    })
    await supabase.rpc('rewards_recompute_retention', { p_org: org.selectedOrg })
    setSaving(false); setForm(blank); setFile(null); setShowForm(false); load()
  }
  async function patchDoc(r, patch) { await supabase.from('rewards_documents').update(patch).eq('id', r.id); load() }
  async function setHold(empId, on) {
    const reason = on ? (window.prompt('Reason for the legal hold (e.g. "EEOC charge filed 10/2026"):') || '') : null
    if (on && !reason) return
    await updateEmployee(empId, { legal_hold: on, legal_hold_reason: reason }); setHoldPick(''); load()
  }

  const q = search.trim().toLowerCase()
  const shown = rows.filter((r) => (view === 'all' || (view === 'archived' ? !!r.archived_at : !r.archived_at))
    && (!catFilter || r.category === catFilter)
    && (!q || (r.title || '').toLowerCase().includes(q) || empName(r.employee_id).toLowerCase().includes(q)))
  const soon = rows.filter((r) => { const d = daysUntil(r.retain_until); return d !== null && d >= 0 && d <= 30 && !empOf(r.employee_id)?.legal_hold && !['policy', 'benefits'].includes(r.category) })
  const holds = employees.filter((e) => e.legal_hold)

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Documents</h2><span className="badge">{rows.length} records</span></div>
        {tab === 'documents' && <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Document'}</button>}
      </div>
      <OrgBar {...org} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 14px', borderRadius: 999, border: '1px solid ' + (tab === k ? '#1F3A5F' : 'var(--border)'), background: tab === k ? '#1F3A5F' : '#fff', color: tab === k ? '#fff' : '#334155', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{l}</button>)}
      </div>

      {tab === 'required' && <DocsCompliance orgId={org.selectedOrg} employees={employees} docs={rows} onChanged={load} />}
      {tab === 'policies' && <DocsPolicies orgId={org.selectedOrg} employees={employees} profile={profile} />}
      {tab === 'signed' && (
        <table className="data-table">
          <thead><tr><th>Employee</th><th>Form</th><th>Signed</th><th>IP</th><th></th></tr></thead>
          <tbody>
            {signed.map((s) => (
              <tr key={s.id}><td>{empName(s.employee_id)}</td><td>{s.form_type === 'w4' ? 'Form W-4' : (s.data?.title || 'Acknowledgment')} <span style={{ fontSize: 11.5, color: 'var(--mist)' }}>{s.form_version}</span></td>
                <td>{new Date(s.signed_at).toLocaleString()}</td><td style={{ fontSize: 12 }}>{s.ip || '—'}</td>
                <td style={{ textAlign: 'right' }}><button className="logout-button" onClick={async () => printCertificate({ orgName: await getOrgName(org.selectedOrg), employeeName: empName(s.employee_id), form: s, ackDoc: ackDocs.find((d) => d.id === s.ack_document_id) })}>🖨 Certificate</button></td></tr>
            ))}
            {!signed.length && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No electronically signed forms yet.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'documents' && (<>
        {showForm && (
          <form className="inline-form" onSubmit={submit} style={{ marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
            <div className="field" style={{ minWidth: 220 }}><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="field"><label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {DOC_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
              {form.title.trim() && (
                <AiAssist compact iconOnly title="Suggest category" label="Suggest category from title"
                  system={DOC_CLASSIFY_SYS}
                  prompt={`Title: "${form.title.trim()}". Allowed category keys: ${DOC_CATEGORIES.map((c) => `${c.key} (${c.label})`).join(', ')}. Reply with only the best category key.`}
                  context={{ title: form.title.trim(), allowed_keys: DOC_CATEGORIES.map((c) => c.key) }}
                  onInsert={(text) => { const k = (text || '').trim().toLowerCase().replace(/[^a-z_]/g, ''); if (DOC_CATEGORIES.some((c) => c.key === k)) setForm((f) => ({ ...f, category: k })) }}
                  insertLabel="Use category" />
              )}</div>
            <div className="field" style={{ minWidth: 200 }}><label>Employee (optional)</label>
              <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">— company-wide —</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
            <div className="field"><label><input type="checkbox" checked={form.manual} onChange={(e) => setForm({ ...form, manual: e.target.checked })} /> Set the keep-until date myself</label>
              {form.manual && <input type="date" value={form.retain_until} onChange={(e) => setForm({ ...form, retain_until: e.target.value })} />}</div>
            <div className="field"><label>Attach scan / photo (optional)</label><input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
            <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>{saving ? 'Saving…' : 'Add'}</button>
          </form>
        )}
        {showForm && <p style={{ color: 'var(--mist)', fontSize: 12, marginBottom: 16 }}>Keep-until rule for {cat(form.category).label}: {cat(form.category).rule}. Journey works out the date from the employee's hire and separation dates.</p>}

        {soon.length > 0 && (
          <div style={{ border: '1px solid #FED7AA', background: '#FFF7ED', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13 }}>
            <b>Scheduled for permanent deletion in the next 30 days ({soon.length})</b> — retention period ending. Place a legal hold on the employee if a claim or charge is pending.
            <ul style={{ margin: '6px 0 0' }}>{soon.map((r) => <li key={r.id}>{r.title} — {empName(r.employee_id)} — {r.retain_until}</li>)}</ul>
          </div>
        )}

        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 14, fontSize: 13 }}>
          <b>Legal holds</b> <span style={{ color: 'var(--mist)' }}>— while on hold, nothing for that employee is ever deleted automatically.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
            {holds.map((e) => <span key={e.id} style={{ background: '#FEE2E2', color: '#7F1D1D', borderRadius: 999, padding: '3px 10px', fontWeight: 700 }} title={e.legal_hold_reason || ''}>{e.full_name} <button onClick={() => setHold(e.id, false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7F1D1D' }}>×</button></span>)}
            <select value={holdPick} onChange={(e) => e.target.value && setHold(e.target.value, true)} style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 8 }}>
              <option value="">+ Place a hold…</option>{employees.filter((e) => !e.legal_hold).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ border: '1px solid #E2E8F0', background: '#FBFCFE', borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>Find a document by asking</label>
          <input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="e.g. Where's Maria's I-9? · What gets deleted this month?" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #D5DAE1', borderRadius: 8, padding: '7px 10px', fontSize: 13.5, marginBottom: 8 }} />
          {queryText.trim() ? (
            <AiAssist inline title="Document search" label="Ask"
              system={DOC_SEARCH_SYS}
              prompt={queryText.trim()}
              context={{ question: queryText.trim(), documents: rows.map((r) => ({ title: r.title, category: catLabel(r.category), belongs_to: empName(r.employee_id), retain_until: r.retain_until, archived: !!r.archived_at, uploaded: r.uploaded_at ? String(r.uploaded_at).slice(0, 10) : null })) }} />
          ) : (
            <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>Type a question, then Ask.</span>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 6 }}>Searches titles, categories, people and dates only — never the document contents.</div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          {[['current', 'Current'], ['archived', 'Archived'], ['all', 'All']].map(([k, l]) => <button key={k} onClick={() => setView(k)} style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid ' + (view === k ? '#1F3A5F' : 'var(--border)'), background: view === k ? '#1F3A5F' : '#fff', color: view === k ? '#fff' : '#334155', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{l}</button>)}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or title" style={{ padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 8, minWidth: 220 }} />
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 8 }}>
            <option value="">All categories</option>{DOC_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          {view === 'archived' && shown.length > 0 && <button className="logout-button" onClick={async () => { await supabase.from('rewards_documents').update({ archived_at: null }).in('id', shown.map((r) => r.id)); load() }}>Unarchive all shown</button>}
          {view === 'current' && shown.length > 0 && (q || catFilter) && <button className="logout-button" onClick={async () => { if (confirm(`Archive ${shown.length} document(s)?`)) { await supabase.from('rewards_documents').update({ archived_at: new Date().toISOString() }).in('id', shown.map((r) => r.id)); load() } }}>Archive all shown</button>}
        </div>

        <table className="data-table">
          <thead><tr><th>Title</th><th>Category</th><th>Belongs to</th><th>Keep until</th><th>Status</th><th>Employee view</th><th></th></tr></thead>
          <tbody>
            {shown.map((r) => {
              const d = daysUntil(r.retain_until)
              const hold = empOf(r.employee_id)?.legal_hold
              const status = hold ? 'Legal hold' : ['policy', 'benefits'].includes(r.category) ? 'Kept' : !r.retain_until ? 'Keep (employed)' : d < 0 ? 'Deleting' : d <= 30 ? `Deletes in ${d}d` : 'Must keep'
              return (
                <tr key={r.id} style={{ opacity: r.archived_at ? 0.7 : 1 }}>
                  <td>{r.title || '—'}{r.archived_at && <span style={{ fontSize: 11, color: '#475569', background: '#F1F5F9', borderRadius: 999, padding: '1px 7px', marginLeft: 6 }}>Archived</span>}</td>
                  <td>{catLabel(r.category)}</td>
                  <td>{empName(r.employee_id)}</td>
                  <td>{r.retain_until || '—'} <span style={{ fontSize: 11, color: 'var(--mist)' }}>{r.retain_until_manual ? 'set by you' : 'auto'}</span></td>
                  <td style={{ color: hold ? '#7F1D1D' : d !== null && d <= 30 ? '#B45309' : 'var(--mist)', fontWeight: hold ? 700 : 400 }}>{status}</td>
                  <td>{r.category === 'medical' ? <span style={{ fontSize: 12, color: 'var(--mist)' }}>Confidential</span> : r.employee_id ? <label style={{ fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={r.employee_visible !== false} onChange={() => patchDoc(r, { employee_visible: r.employee_visible === false })} /> {r.employee_visible !== false ? 'Shared' : 'Hidden'}</label> : '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {r.storage_path ? <button className="logout-button" onClick={() => openFile(r.storage_path)}>View</button> : null}{' '}
                    <button className="logout-button" onClick={() => patchDoc(r, { archived_at: r.archived_at ? null : new Date().toISOString() })}>{r.archived_at ? 'Unarchive' : 'Archive'}</button>
                  </td>
                </tr>
              )
            })}
            {shown.length === 0 && <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>No documents here.</td></tr>}
          </tbody>
        </table>
        <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 10 }}>Documents archive automatically 7 days after an employee's separation date. Each document's keep-until date is the longer of the legal minimum for its category and 3 years after separation; after that it is permanently deleted (file and record) unless the employee is on legal hold. Policy and benefit documents are never deleted automatically.</p>
      </>)}
    </div>
  )
}
