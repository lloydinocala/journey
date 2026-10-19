// Rewards-HVAC · Policies to sign — the company publishes a handbook / policy / NDA /
// direct-deposit authorization; every active employee acknowledges it in My Records.
// Editing the text makes a new version, and everyone re-acknowledges the new version.
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import { listAckDocs, listSignedForms, hasSigned, printCertificate } from './signing'
import { uploadHrFile, signedHrUrl } from './hrData'
import { orgName as getOrgName } from './hrRecords'

const KIND = { handbook: 'Employee handbook', policy: 'Company policy', nda: 'Confidentiality / NDA', direct_deposit: 'Direct deposit authorization', other: 'Other' }
const blank = { kind: 'policy', title: '', body: '' }
const inp = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5, boxSizing: 'border-box', fontFamily: 'inherit' }

export default function DocsPolicies({ orgId, employees, profile }) {
  const [docs, setDocs] = useState([])
  const [signed, setSigned] = useState([])
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [file, setFile] = useState(null)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const active = employees.filter((e) => e.is_active)

  async function load() {
    if (!orgId) return
    const [d, s] = await Promise.all([listAckDocs(orgId, { includeInactive: true }), listSignedForms(orgId)])
    setDocs(d); setSigned(s)
  }
  useEffect(() => { load() }, [orgId])

  async function save(e) {
    e.preventDefault()
    if (!form.title.trim() || (!form.body.trim() && !file && !editing?.storage_path)) return
    setBusy(true)
    let storage = {}
    if (file) {
      const up = await uploadHrFile(orgId, 'policies', file)
      if (!up.error) storage = { storage_path: up.path, file_name: up.name }
    }
    if (editing) {
      const textChanged = (editing.body || '') !== form.body || !!file
      await supabase.from('rewards_ack_documents').update({ kind: form.kind, title: form.title.trim(), body: form.body || null, ...storage, version: textChanged ? editing.version + 1 : editing.version, updated_at: new Date().toISOString() }).eq('id', editing.id)
    } else {
      await supabase.from('rewards_ack_documents').insert({ org_id: orgId, kind: form.kind, title: form.title.trim(), body: form.body || null, ...storage, created_by: profile?.id || null })
    }
    setBusy(false); setForm(blank); setFile(null); setEditing(null); setShow(false); load()
  }
  async function cert(s) {
    const emp = employees.find((e) => e.id === s.employee_id)
    printCertificate({ orgName: await getOrgName(orgId), employeeName: emp?.full_name || '', form: s, ackDoc: docs.find((d) => d.id === s.ack_document_id) })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <p style={{ fontSize: 13, color: 'var(--mist)', margin: 0 }}>Publish a document once; every active employee sees it in My Records → Forms to sign and acknowledges it. Signatures record the time, IP address and device, with a fingerprint of the exact text. Changing the text creates a new version for everyone to re-acknowledge.</p>
        <button className="auth-button" style={{ width: 'auto', margin: 0, flex: 'none' }} onClick={() => { setShow(!show); setEditing(null); setForm(blank) }}>{show ? 'Cancel' : '+ Publish document'}</button>
      </div>
      {show && (
        <form onSubmit={save} className="section-card" style={{ padding: 14, marginBottom: 14, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ fontSize: 12.5, flex: 1 }}>Type<select style={inp} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label style={{ fontSize: 12.5, flex: 2 }}>Title<input style={inp} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Vehicle & driving policy" /></label>
          </div>
          <label style={{ fontSize: 12.5 }}>Text the employee reads (paste it here — recommended)<textarea rows={8} style={inp} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
          <label style={{ fontSize: 12.5 }}>…and/or attach the PDF<input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
          {editing && <div style={{ fontSize: 12, color: '#92400E' }}>Changing the text or file makes version {editing.version + 1}; everyone will be asked to acknowledge it again.</div>}
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={busy}>{busy ? 'Saving…' : editing ? 'Save' : 'Publish'}</button>
        </form>
      )}
      <table className="data-table">
        <thead><tr><th>Document</th><th>Type</th><th>Version</th><th>Signed</th><th></th></tr></thead>
        <tbody>
          {docs.map((d) => {
            const n = active.filter((e) => hasSigned(signed, e.id, d)).length
            return (
              <tr key={d.id} style={{ opacity: d.active ? 1 : 0.55 }}>
                <td><b>{d.title}</b>{d.file_name ? <> · <button className="logout-button" style={{ padding: '1px 7px' }} onClick={async () => { const u = await signedHrUrl(d.storage_path); if (u) window.open(u, '_blank') }}>PDF</button></> : null}
                  <details style={{ fontSize: 12.5 }}><summary style={{ cursor: 'pointer', color: 'var(--mist)' }}>Who has signed</summary>
                    {active.map((e) => { const s = signed.find((x) => x.employee_id === e.id && x.ack_document_id === d.id && x.form_version === 'v' + d.version); return (
                      <div key={e.id}>{s ? '✓' : '○'} {e.full_name}{s ? <> — {new Date(s.signed_at).toLocaleDateString()} <button className="logout-button" style={{ padding: '0 6px', fontSize: 11 }} onClick={() => cert(s)}>Certificate</button></> : ' — not yet'}</div>
                    ) })}
                  </details></td>
                <td>{KIND[d.kind]}</td><td>v{d.version}</td>
                <td style={{ fontWeight: 700, color: n === active.length ? '#166534' : '#92400E' }}>{n} of {active.length}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="logout-button" onClick={() => { setEditing(d); setForm({ kind: d.kind, title: d.title, body: d.body || '' }); setShow(true) }}>Edit</button>{' '}
                  <button className="logout-button" onClick={async () => { await supabase.from('rewards_ack_documents').update({ active: !d.active }).eq('id', d.id); load() }}>{d.active ? 'Retire' : 'Reactivate'}</button>
                </td>
              </tr>
            )
          })}
          {!docs.length && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>Nothing published yet. Start with your employee handbook and any safety or vehicle policies.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
