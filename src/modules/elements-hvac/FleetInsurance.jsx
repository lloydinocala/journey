// Elements-HVAC · Fleet · Insurance & Documents
// Tracks insurance policies (fleet-wide or specific vehicles) with the legal
// detail — carrier, policy number, dates, coverage, agent — plus the uploaded
// insurer card as printable proof, and other legal documents (registration,
// title, DOT, emissions, permits). Expiration is flagged red/amber. Files open
// in a new tab for printing; this is a desktop (office) screen only, so proof
// of insurance stays under office control and is never exposed on mobile.
// Payment/financing records are intentionally out of scope (a bookkeeping job).
import { useState, useEffect } from 'react'
import { listVehicles, FLAG_COLORS } from './fleetData'
import { useOrgSelector, OrgBar } from './shared'
import {
  listPolicies, addPolicy, updatePolicy, archivePolicy, setPolicyVehicles,
  listDocuments, addDocument, archiveDocument,
  uploadFleetFile, fileUrl, expiryStatus, DOC_TYPES, docTypeLabel,
} from './fleetLegalData'

const nn = (s) => (s === '' || s === undefined ? null : s)
const stateColor = (st) =>
  st.state === 'overdue' ? FLAG_COLORS.red
    : st.state === 'due_soon' ? FLAG_COLORS.amber
      : st.state === 'none' ? 'var(--mist)' : '#16A34A'
const StatusPill = ({ st }) => (
  <span style={{ background: stateColor(st), color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.label}</span>
)

const blankPolicy = {
  carrier: '', policy_number: '', naic: '', effective_date: '', expiration_date: '',
  coverage_summary: '', agent_name: '', agent_phone: '', scope: 'fleet', due_soon_days: 30,
}
const blankDoc = {
  vehicle_id: '', doc_type: 'registration', label: '', identifier: '',
  issued_date: '', expiration_date: '', due_soon_days: 30,
}

export default function FleetInsurance({ profile }) {
  const org = useOrgSelector(profile)
  const [vehicles, setVehicles] = useState([])
  const [policies, setPolicies] = useState([])
  const [docs, setDocs] = useState([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  // policy form
  const [showPol, setShowPol] = useState(false)
  const [pol, setPol] = useState(blankPolicy)
  const [polVeh, setPolVeh] = useState([])       // selected vehicle ids when scope='listed'
  const [polCard, setPolCard] = useState(null)   // File

  // document form
  const [showDoc, setShowDoc] = useState(false)
  const [doc, setDoc] = useState(blankDoc)
  const [docFile, setDocFile] = useState(null)

  async function load() {
    if (!org.selectedOrg) return
    const [v, p, d] = await Promise.all([
      listVehicles(org.selectedOrg), listPolicies(org.selectedOrg), listDocuments(org.selectedOrg),
    ])
    setVehicles(v); setPolicies(p); setDocs(d)
  }
  useEffect(() => { load() }, [org.selectedOrg]) // eslint-disable-line react-hooks/exhaustive-deps

  const vehName = (id) => vehicles.find((v) => v.id === id)?.name || '—'
  const coversLabel = (p) => (p.scope === 'fleet' ? 'Whole fleet' : `${p.vehicle_ids.length} vehicle${p.vehicle_ids.length === 1 ? '' : 's'}`)

  async function openFile(path) {
    const url = await fileUrl(path)
    if (url) window.open(url, '_blank', 'noopener')
    else setMsg('Could not open that file.')
  }

  // ---- Policies -------------------------------------------------------------
  async function handleAddPolicy(e) {
    e.preventDefault(); setMsg('')
    if (!pol.carrier.trim() && !pol.policy_number.trim()) { setMsg('Enter at least a carrier or a policy number.'); return }
    setBusy('policy')
    let card_path = null, card_name = null
    if (polCard) {
      const up = await uploadFleetFile(org.selectedOrg, 'insurance', polCard)
      if (up.error) { setBusy(''); setMsg('Card upload failed: ' + up.error.message); return }
      card_path = up.path; card_name = up.name
    }
    const fields = {
      carrier: nn(pol.carrier.trim()), policy_number: nn(pol.policy_number.trim()), naic: nn(pol.naic.trim()),
      effective_date: nn(pol.effective_date), expiration_date: nn(pol.expiration_date),
      coverage_summary: nn(pol.coverage_summary.trim()), agent_name: nn(pol.agent_name.trim()), agent_phone: nn(pol.agent_phone.trim()),
      scope: pol.scope, due_soon_days: Number(pol.due_soon_days) || 30, card_path, card_name,
    }
    const { error } = await addPolicy(org.selectedOrg, fields, pol.scope === 'listed' ? polVeh : [], profile.id)
    setBusy('')
    if (error) { setMsg(error.message); return }
    setPol(blankPolicy); setPolVeh([]); setPolCard(null); setShowPol(false); load()
  }

  async function replaceCard(policy, file) {
    if (!file) return
    setBusy('card:' + policy.id)
    const up = await uploadFleetFile(org.selectedOrg, 'insurance', file)
    if (up.error) { setBusy(''); setMsg('Card upload failed: ' + up.error.message); return }
    await updatePolicy(policy.id, { card_path: up.path, card_name: up.name })
    setBusy(''); load()
  }

  function togglePolVeh(id) {
    setPolVeh((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  // ---- Documents ------------------------------------------------------------
  async function handleAddDoc(e) {
    e.preventDefault(); setMsg('')
    setBusy('doc')
    let file_path = null, file_name = null
    if (docFile) {
      const up = await uploadFleetFile(org.selectedOrg, 'documents', docFile)
      if (up.error) { setBusy(''); setMsg('File upload failed: ' + up.error.message); return }
      file_path = up.path; file_name = up.name
    }
    const fields = {
      vehicle_id: nn(doc.vehicle_id), doc_type: doc.doc_type,
      label: nn(doc.label.trim()), identifier: nn(doc.identifier.trim()),
      issued_date: nn(doc.issued_date), expiration_date: nn(doc.expiration_date),
      due_soon_days: Number(doc.due_soon_days) || 30, file_path, file_name,
    }
    const { error } = await addDocument(org.selectedOrg, fields, profile.id)
    setBusy('')
    if (error) { setMsg(error.message); return }
    setDoc(blankDoc); setDocFile(null); setShowDoc(false); load()
  }

  const btn = { width: 'auto', margin: 0 }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Insurance &amp; Documents</h2>
          <span className="badge">{policies.length} policies · {docs.length} docs</span>
        </div>
      </div>
      <OrgBar {...org} />
      {msg && <div className="auth-error" style={{ marginBottom: 12 }}>{msg}</div>}

      {/* ===================== INSURANCE POLICIES ===================== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 10px' }}>
        <h3 style={{ margin: 0 }}>Insurance policies</h3>
        <button className="auth-button" style={btn} onClick={() => { setShowPol(!showPol); setMsg('') }}>{showPol ? 'Cancel' : '+ New Policy'}</button>
      </div>

      {showPol && (
        <form className="inline-form" onSubmit={handleAddPolicy} style={{ marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="field" style={{ minWidth: 170 }}><label>Carrier</label><input type="text" value={pol.carrier} onChange={(e) => setPol({ ...pol, carrier: e.target.value })} placeholder="e.g. Progressive Commercial" /></div>
          <div className="field" style={{ minWidth: 150 }}><label>Policy number</label><input type="text" value={pol.policy_number} onChange={(e) => setPol({ ...pol, policy_number: e.target.value })} /></div>
          <div className="field" style={{ width: 110 }}><label>NAIC</label><input type="text" value={pol.naic} onChange={(e) => setPol({ ...pol, naic: e.target.value })} /></div>
          <div className="field"><label>Effective</label><input type="date" value={pol.effective_date} onChange={(e) => setPol({ ...pol, effective_date: e.target.value })} /></div>
          <div className="field"><label>Expiration</label><input type="date" value={pol.expiration_date} onChange={(e) => setPol({ ...pol, expiration_date: e.target.value })} /></div>
          <div className="field" style={{ width: 120 }}><label>Warn (days)</label><input type="number" value={pol.due_soon_days} onChange={(e) => setPol({ ...pol, due_soon_days: e.target.value })} /></div>
          <div className="field" style={{ minWidth: 220, flex: 1 }}><label>Coverage summary</label><input type="text" value={pol.coverage_summary} onChange={(e) => setPol({ ...pol, coverage_summary: e.target.value })} placeholder="e.g. $1M CSL, comprehensive + collision" /></div>
          <div className="field" style={{ minWidth: 150 }}><label>Agent name</label><input type="text" value={pol.agent_name} onChange={(e) => setPol({ ...pol, agent_name: e.target.value })} /></div>
          <div className="field" style={{ width: 150 }}><label>Agent phone</label><input type="text" value={pol.agent_phone} onChange={(e) => setPol({ ...pol, agent_phone: e.target.value })} /></div>
          <div className="field" style={{ width: 160 }}>
            <label>Covers</label>
            <select value={pol.scope} onChange={(e) => setPol({ ...pol, scope: e.target.value })}>
              <option value="fleet">Whole fleet</option>
              <option value="listed">Specific vehicles</option>
            </select>
          </div>
          {pol.scope === 'listed' && (
            <div className="field" style={{ minWidth: 220 }}>
              <label>Vehicles on this policy</label>
              <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid var(--line, #CBD5E1)', borderRadius: 8, padding: 8 }}>
                {vehicles.length === 0 && <div style={{ color: 'var(--mist)', fontSize: 13 }}>No vehicles yet.</div>}
                {vehicles.map((v) => (
                  <label key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0', fontWeight: 400 }}>
                    <input type="checkbox" checked={polVeh.includes(v.id)} onChange={() => togglePolVeh(v.id)} /> {v.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="field" style={{ minWidth: 220 }}>
            <label>Proof-of-insurance card (PDF or image)</label>
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setPolCard(e.target.files?.[0] || null)} />
          </div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={busy === 'policy'}>{busy === 'policy' ? 'Saving…' : 'Add policy'}</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr><th>Carrier</th><th>Policy #</th><th>Effective → Expiration</th><th>Status</th><th>Covers</th><th>Agent</th><th>Proof card</th><th></th></tr>
        </thead>
        <tbody>
          {policies.map((p) => {
            const st = expiryStatus(p.expiration_date, p.due_soon_days)
            return (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.carrier || '—'}{p.coverage_summary ? <div style={{ fontSize: 12, color: 'var(--mist)', fontWeight: 400 }}>{p.coverage_summary}</div> : null}</td>
                <td>{p.policy_number || '—'}{p.naic ? <div style={{ fontSize: 12, color: 'var(--mist)' }}>NAIC {p.naic}</div> : null}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{p.effective_date || '—'} → {p.expiration_date || '—'}</td>
                <td><StatusPill st={st} /></td>
                <td>{coversLabel(p)}</td>
                <td>{p.agent_name || '—'}{p.agent_phone ? <div style={{ fontSize: 12, color: 'var(--mist)' }}>{p.agent_phone}</div> : null}</td>
                <td>
                  {p.card_path ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button className="auth-button" style={btn} onClick={() => openFile(p.card_path)} title="Opens in a new tab to view or print">View / Print</button>
                      <label style={{ fontSize: 11, color: 'var(--mist)', cursor: 'pointer' }}>
                        Replace<input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={(e) => replaceCard(p, e.target.files?.[0])} />
                      </label>
                    </div>
                  ) : (
                    <label className="auth-button" style={{ ...btn, cursor: 'pointer', display: 'inline-block' }}>
                      {busy === 'card:' + p.id ? 'Uploading…' : 'Upload card'}
                      <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={(e) => replaceCard(p, e.target.files?.[0])} />
                    </label>
                  )}
                </td>
                <td><button className="logout-button" onClick={async () => { await archivePolicy(p.id); load() }}>Remove</button></td>
              </tr>
            )
          })}
          {policies.length === 0 && <tr><td colSpan="8" style={{ color: 'var(--mist)' }}>No policies yet. Add your commercial auto policy (whole fleet) or a per-vehicle policy, and upload the insurer card as printable proof.</td></tr>}
        </tbody>
      </table>

      {/* ===================== LEGAL DOCUMENTS ===================== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '28px 0 10px' }}>
        <h3 style={{ margin: 0 }}>Registration &amp; other legal documents</h3>
        <button className="auth-button" style={btn} onClick={() => { setShowDoc(!showDoc); setMsg('') }}>{showDoc ? 'Cancel' : '+ New Document'}</button>
      </div>

      {showDoc && (
        <form className="inline-form" onSubmit={handleAddDoc} style={{ marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="field" style={{ minWidth: 170 }}>
            <label>Vehicle</label>
            <select value={doc.vehicle_id} onChange={(e) => setDoc({ ...doc, vehicle_id: e.target.value })}>
              <option value="">— whole fleet —</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 160 }}>
            <label>Type</label>
            <select value={doc.doc_type} onChange={(e) => setDoc({ ...doc, doc_type: e.target.value })}>
              {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 150 }}><label>Label (optional)</label><input type="text" value={doc.label} onChange={(e) => setDoc({ ...doc, label: e.target.value })} placeholder="e.g. State registration" /></div>
          <div className="field" style={{ minWidth: 140 }}><label>Number / ID</label><input type="text" value={doc.identifier} onChange={(e) => setDoc({ ...doc, identifier: e.target.value })} placeholder="reg # / doc #" /></div>
          <div className="field"><label>Issued</label><input type="date" value={doc.issued_date} onChange={(e) => setDoc({ ...doc, issued_date: e.target.value })} /></div>
          <div className="field"><label>Expiration</label><input type="date" value={doc.expiration_date} onChange={(e) => setDoc({ ...doc, expiration_date: e.target.value })} /></div>
          <div className="field" style={{ width: 120 }}><label>Warn (days)</label><input type="number" value={doc.due_soon_days} onChange={(e) => setDoc({ ...doc, due_soon_days: e.target.value })} /></div>
          <div className="field" style={{ minWidth: 220 }}><label>Scan / file (optional)</label><input type="file" accept="application/pdf,image/*" onChange={(e) => setDocFile(e.target.files?.[0] || null)} /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={busy === 'doc'}>{busy === 'doc' ? 'Saving…' : 'Add document'}</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr><th>Vehicle</th><th>Type</th><th>Number / ID</th><th>Expiration</th><th>Status</th><th>File</th><th></th></tr>
        </thead>
        <tbody>
          {docs.map((d) => {
            const st = expiryStatus(d.expiration_date, d.due_soon_days)
            return (
              <tr key={d.id}>
                <td>{d.vehicle_id ? vehName(d.vehicle_id) : <span style={{ color: 'var(--mist)' }}>Whole fleet</span>}</td>
                <td>{docTypeLabel(d.doc_type)}{d.label ? <div style={{ fontSize: 12, color: 'var(--mist)' }}>{d.label}</div> : null}</td>
                <td>{d.identifier || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{d.expiration_date || '—'}</td>
                <td><StatusPill st={st} /></td>
                <td>{d.file_path ? <button className="auth-button" style={btn} onClick={() => openFile(d.file_path)}>View / Print</button> : <span style={{ color: 'var(--mist)' }}>—</span>}</td>
                <td><button className="logout-button" onClick={async () => { await archiveDocument(d.id); load() }}>Remove</button></td>
              </tr>
            )
          })}
          {docs.length === 0 && <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>No documents yet. Track registration, title, DOT, emissions, and permits here — with the scanned document and its expiration.</td></tr>}
        </tbody>
      </table>

      <p style={{ color: 'var(--mist)', fontSize: 12.5, marginTop: 16 }}>
        Proof of insurance and documents open in a new tab to print from this office screen — they are not exposed on the mobile app. Insurance and financing <em>payment</em> records are handled in bookkeeping, not here.
      </p>
    </div>
  )
}
