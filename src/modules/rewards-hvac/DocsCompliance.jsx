// Rewards-HVAC · Required-documents tracker: every active employee × every required document
// (federal + their state), with what's on file, what's missing, and the action to fix it.
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import { requiredDocsFor, STATES, STATE_DOCS } from './complianceDocs'
import { listSignedForms, listAckDocs, hasSigned } from './signing'
import { uploadHrFile, addDocument } from './hrData'

const CELL = {
  ok: ['✓', '#166534', '#DCFCE7'], missing: ['Missing', '#B42318', '#FEE2E2'], waiting: ['Waiting on employee', '#92400E', '#FEF3C7'],
  overdue: ['Overdue', '#B42318', '#FEE2E2'], na: ['—', '#94A3B8', '#F8FAFC'], optional: ['Optional', '#64748B', '#F1F5F9'], nodoc: ['No document published', '#64748B', '#F1F5F9'],
}
const inp = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5, boxSizing: 'border-box' }

export default function DocsCompliance({ orgId, employees, docs, onChanged }) {
  const [state, setState] = useState('FL')
  const [hr, setHr] = useState({})
  const [signed, setSigned] = useState([])
  const [acks, setAcks] = useState([])
  const [cell, setCell] = useState(null)   // { emp, doc }
  const active = employees.filter((e) => e.is_active)

  async function load() {
    if (!orgId) return
    const [{ data: h }, s, a, { data: st }] = await Promise.all([
      supabase.from('rewards_employee_hr').select('*').eq('org_id', orgId),
      listSignedForms(orgId), listAckDocs(orgId),
      supabase.from('rewards_settings').select('work_state').eq('org_id', orgId).maybeSingle(),
    ])
    setHr(Object.fromEntries((h || []).map((r) => [r.employee_id, r]))); setSigned(s); setAcks(a)
    if (st?.work_state && STATE_DOCS[st.work_state]) setState(st.work_state)
  }
  useEffect(() => { load() }, [orgId])

  const required = requiredDocsFor(state)
  function status(emp, d) {
    const h = hr[emp.id] || {}
    if (d.key === 'i9') {
      const onFile = docs.some((x) => x.employee_id === emp.id && x.category === 'i9')
      return onFile && h.i9_inspection ? 'ok' : 'missing'
    }
    if (d.key === 'w4') return signed.some((s) => s.employee_id === emp.id && s.form_type === 'w4') || docs.some((x) => x.employee_id === emp.id && x.category === 'w4') ? 'ok' : 'waiting'
    if (d.how === 'ack') {
      const list = acks.filter((a) => a.kind === d.ackKind)
      if (!list.length) return d.required ? 'nodoc' : 'na'
      return list.every((a) => hasSigned(signed, emp.id, a)) ? 'ok' : (d.required ? 'waiting' : 'optional')
    }
    if (d.how === 'record') {
      if (d.minEmployees && active.length < d.minEmployees && !h[d.field]) return 'optional'
      if (h[d.field]) return 'ok'
      if (d.dueDays && emp.hire_date && (Date.now() - new Date(emp.hire_date + 'T00:00:00')) / 86400000 > d.dueDays) return 'overdue'
      return 'missing'
    }
    return 'na'
  }
  const gaps = active.reduce((n, e) => n + required.filter((d) => ['missing', 'overdue', 'waiting', 'nodoc'].includes(status(e, d))).length, 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <label style={{ fontSize: 13 }}>Work state&nbsp;
          <select value={state} onChange={(e) => setState(e.target.value)} style={{ padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 8 }}>
            {STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
        <span style={{ fontSize: 13, color: gaps ? '#B42318' : '#166534', fontWeight: 700 }}>{gaps ? `${gaps} item${gaps === 1 ? '' : 's'} need attention` : 'Everyone is complete'}</span>
        <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>{STATE_DOCS[state]?.notes}</span>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table className="data-table" style={{ minWidth: 260 + active.length * 120 }}>
          <thead><tr><th style={{ minWidth: 260 }}>Document</th>{active.map((e) => <th key={e.id} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{e.full_name}</th>)}</tr></thead>
          <tbody>
            {required.map((d) => (
              <tr key={d.key}>
                <td><b>{d.label}</b><div style={{ fontSize: 11.5, color: 'var(--mist)' }}>{d.scope}{d.required === false ? ' · optional' : ''}{d.minEmployees ? ` · required at ${d.minEmployees}+ employees` : ''}</div></td>
                {active.map((e) => {
                  const st = status(e, d); const c = CELL[st]
                  return (
                    <td key={e.id} style={{ textAlign: 'center', padding: 4 }}>
                      <button onClick={() => setCell({ emp: e, doc: d })} style={{ border: 'none', borderRadius: 7, padding: '5px 8px', fontSize: 12, fontWeight: 700, color: c[1], background: c[2], cursor: 'pointer', minWidth: 70 }}>{c[0]}</button>
                    </td>
                  )
                })}
              </tr>
            ))}
            {!active.length && <tr><td colSpan="2" style={{ color: 'var(--mist)' }}>No active employees.</td></tr>}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: 'var(--mist)' }}>Click any cell to see what's needed and take care of it.</p>
      {cell && <CellPanel orgId={orgId} emp={cell.emp} doc={cell.doc} hr={hr[cell.emp.id] || {}} acks={acks} signed={signed}
        onClose={() => setCell(null)} onSaved={() => { setCell(null); load(); onChanged() }} />}
    </div>
  )
}

function CellPanel({ orgId, emp, doc, hr, acks, signed, onClose, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [file, setFile] = useState(null)
  const [insp, setInsp] = useState(hr.i9_inspection || { inspected_by: '', inspected_on: new Date().toISOString().slice(0, 10), list: 'A', doc_a: '', doc_b: '', doc_c: '', expires: '', notes: '' })
  const [val, setVal] = useState(doc.field ? (hr[doc.field] || '') : '')

  async function saveHr(patch) {
    const { data: ex } = await supabase.from('rewards_employee_hr').select('id').eq('employee_id', emp.id).maybeSingle()
    return ex ? supabase.from('rewards_employee_hr').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', ex.id)
      : supabase.from('rewards_employee_hr').insert({ org_id: orgId, employee_id: emp.id, ...patch })
  }
  async function saveI9() {
    setBusy(true); setErr('')
    if (!insp.inspected_by || !insp.inspected_on || (insp.list === 'A' ? !insp.doc_a : !(insp.doc_b && insp.doc_c))) { setErr('Fill in who inspected, when, and which documents.'); setBusy(false); return }
    if (file) {
      const up = await uploadHrFile(orgId, emp.id, file)
      if (up.error) { setErr(up.error.message); setBusy(false); return }
      await addDocument(orgId, { title: `Form I-9 — ${emp.full_name}`, category: 'i9', employee_id: emp.id, retention_anchor: 'termination', storage_path: up.path, file_name: up.name, employee_visible: true })
    }
    const r = await saveHr({ i9_inspection: insp, i9_status: 'verified', i9_completed_at: new Date().toISOString() })
    setBusy(false); if (r.error) setErr(r.error.message); else onSaved()
  }
  async function saveRecord() {
    setBusy(true); setErr('')
    const r = await saveHr({ [doc.field]: val || null })
    setBusy(false); if (r.error) setErr(r.error.message); else onSaved()
  }
  async function uploadW4() {
    if (!file) return
    setBusy(true)
    const up = await uploadHrFile(orgId, emp.id, file)
    if (!up.error) await addDocument(orgId, { title: `Form W-4 (paper) — ${emp.full_name}`, category: 'w4', employee_id: emp.id, retention_anchor: 'termination', storage_path: up.path, file_name: up.name })
    setBusy(false); if (up.error) setErr(up.error.message); else onSaved()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>{doc.label}</h3>
        <div style={{ fontSize: 13, color: 'var(--mist)', marginBottom: 10 }}>{emp.full_name}{emp.hire_date ? ` · hired ${emp.hire_date}` : ''}</div>
        <p style={{ fontSize: 13.5 }}>{doc.note}</p>
        {doc.link && <p style={{ fontSize: 13.5 }}><a href={doc.link} target="_blank" rel="noreferrer">Open the official form ↗</a></p>}

        {doc.key === 'i9' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 12.5 }}>Signed I-9 scan or PDF {hr.i9_inspection ? '(optional — already recorded)' : ''}<input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
            <b style={{ fontSize: 13 }}>Section 2 — document inspection</b>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ fontSize: 12.5, flex: 2 }}>Inspected by<input style={inp} value={insp.inspected_by} onChange={(e) => setInsp({ ...insp, inspected_by: e.target.value })} /></label>
              <label style={{ fontSize: 12.5, flex: 1 }}>Date<input type="date" style={inp} value={insp.inspected_on} onChange={(e) => setInsp({ ...insp, inspected_on: e.target.value })} /></label>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
              <label><input type="radio" checked={insp.list === 'A'} onChange={() => setInsp({ ...insp, list: 'A' })} /> One List A document</label>
              <label><input type="radio" checked={insp.list === 'BC'} onChange={() => setInsp({ ...insp, list: 'BC' })} /> List B + List C</label>
            </div>
            {insp.list === 'A'
              ? <label style={{ fontSize: 12.5 }}>List A document (e.g. U.S. passport, permanent resident card)<input style={inp} value={insp.doc_a} onChange={(e) => setInsp({ ...insp, doc_a: e.target.value })} /></label>
              : <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ fontSize: 12.5, flex: 1 }}>List B (identity, e.g. driver's license)<input style={inp} value={insp.doc_b} onChange={(e) => setInsp({ ...insp, doc_b: e.target.value })} /></label>
                  <label style={{ fontSize: 12.5, flex: 1 }}>List C (work authorization, e.g. Social Security card)<input style={inp} value={insp.doc_c} onChange={(e) => setInsp({ ...insp, doc_c: e.target.value })} /></label>
                </div>}
            <label style={{ fontSize: 12.5 }}>Expiration date (if any)<input type="date" style={inp} value={insp.expires} onChange={(e) => setInsp({ ...insp, expires: e.target.value })} /></label>
            <label style={{ fontSize: 12.5 }}>Notes<input style={inp} value={insp.notes} onChange={(e) => setInsp({ ...insp, notes: e.target.value })} /></label>
            <div style={{ fontSize: 11.5, color: '#92400E' }}>You must examine the ORIGINAL documents in person (or by a DHS-approved remote method). Don't record document numbers here — they belong only on the I-9 itself. The employee chooses which acceptable documents to show.</div>
            <button className="auth-button" style={{ width: 'auto' }} disabled={busy} onClick={saveI9}>{busy ? 'Saving…' : 'Save I-9 record'}</button>
          </div>
        )}

        {doc.key === 'w4' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 13.5 }}>The employee signs their W-4 in <b>My Records → Forms to sign</b> (field app: My Records). {signed.filter((s) => s.employee_id === emp.id && s.form_type === 'w4').length ? 'A signed W-4 is on file.' : 'No electronic W-4 yet.'}</div>
            <label style={{ fontSize: 12.5 }}>Or upload a signed paper W-4<input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
            <button className="logout-button" disabled={!file || busy} onClick={uploadW4}>Upload paper W-4</button>
          </div>
        )}

        {doc.how === 'ack' && (
          <div style={{ fontSize: 13.5 }}>
            {acks.filter((a) => a.kind === doc.ackKind).length === 0
              ? <>No {doc.label.toLowerCase()} published yet — add it under <b>Policies to sign</b>.</>
              : acks.filter((a) => a.kind === doc.ackKind).map((a) => (
                <div key={a.id}>{hasSigned(signed, emp.id, a) ? '✓' : '○'} {a.title} (v{a.version}) — {hasSigned(signed, emp.id, a) ? 'signed' : 'waiting for the employee to sign in My Records'}</div>
              ))}
          </div>
        )}

        {doc.how === 'record' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 12.5 }}>{doc.key === 'everify' ? 'E-Verify case number' : 'Date reported'}
              <input type={doc.key === 'everify' ? 'text' : 'date'} style={inp} value={val} onChange={(e) => setVal(e.target.value)} /></label>
            {doc.dueDays && emp.hire_date && <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Due by {new Date(new Date(emp.hire_date + 'T00:00:00').getTime() + doc.dueDays * 86400000).toLocaleDateString()}</div>}
            <button className="auth-button" style={{ width: 'auto' }} disabled={busy} onClick={saveRecord}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        )}

        {err && <div className="auth-error" style={{ marginTop: 8 }}>{err}</div>}
        <div style={{ textAlign: 'right', marginTop: 12 }}><button className="logout-button" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}
