// My Records → Forms to sign. The employee's W-4 and any company documents waiting for
// their acknowledgment. Signing goes through the hr-sign function, which records the exact
// statement, the time, IP address and device, and a fingerprint of what was signed.
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import { W4_PERJURY, printCertificate } from './signing'

const inp = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }
const box = { border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16, background: '#fff' }

async function callSign(body) {
  const { data, error } = await supabase.functions.invoke('hr-sign', { body })
  if (error || data?.error) {
    let m = data?.error || error?.message
    try { const j = await error?.context?.json?.(); if (j?.error) m = j.error } catch (e) { /* ignore */ }
    return { error: m || 'Could not sign.' }
  }
  return data
}

export function useSignCount(orgId, empId) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!orgId || !empId) return
    Promise.all([
      supabase.from('rewards_ack_documents').select('id, version').eq('org_id', orgId).eq('active', true),
      supabase.from('rewards_signed_forms').select('form_type, ack_document_id, form_version').eq('employee_id', empId),
    ]).then(([a, s]) => {
      const signed = s.data || []
      const pendingAcks = (a.data || []).filter((d) => !signed.some((x) => x.ack_document_id === d.id && x.form_version === 'v' + d.version)).length
      setN(pendingAcks + (signed.some((x) => x.form_type === 'w4') ? 0 : 1))
    })
  }, [orgId, empId])
  return n
}

export default function MySignForms({ orgId, empId, employeeName }) {
  const [acks, setAcks] = useState([])
  const [signed, setSigned] = useState([])
  const [w4Open, setW4Open] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    if (!orgId || !empId) return
    const [a, s] = await Promise.all([
      supabase.from('rewards_ack_documents').select('*').eq('org_id', orgId).eq('active', true).order('kind'),
      supabase.from('rewards_signed_forms').select('*').eq('employee_id', empId).order('signed_at', { ascending: false }),
    ])
    setAcks(a.data || []); setSigned(s.data || [])
  }
  useEffect(() => { load() }, [orgId, empId])

  if (!empId) return <p style={{ color: 'var(--mist)' }}>Your login isn't linked to an employee record yet — ask the office.</p>
  const lastW4 = signed.find((s) => s.form_type === 'w4')
  const pending = acks.filter((d) => !signed.some((x) => x.ack_document_id === d.id && x.form_version === 'v' + d.version))

  return (
    <div>
      {msg && <div style={{ background: '#E8F5EC', border: '1px solid #BFE3CB', color: '#166534', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontWeight: 700 }}>{msg}</div>}

      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div><b>Form W-4 — Federal tax withholding</b>
            <div style={{ fontSize: 13, color: 'var(--mist)' }}>{lastW4 ? `Signed ${new Date(lastW4.signed_at).toLocaleDateString()}. Update it any time your situation changes (marriage, a new child, a second job).` : 'Not on file yet — please complete it so your paycheck withholding is right.'}</div></div>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setW4Open(!w4Open)}>{w4Open ? 'Cancel' : lastW4 ? 'Update my W-4' : 'Fill out my W-4'}</button>
        </div>
        {w4Open && <W4Form prev={lastW4?.data} employeeName={employeeName} onDone={() => { setW4Open(false); setMsg('Your W-4 was signed and sent to payroll.'); load() }} />}
      </div>

      {pending.map((d) => <AckCard key={d.id} doc={d} onDone={() => { setMsg(`Thank you — "${d.title}" acknowledged.`); load() }} />)}
      {!pending.length && lastW4 && <p style={{ color: '#166534', fontWeight: 700 }}>✓ You're all caught up.</p>}

      {signed.length > 0 && (
        <div style={box}>
          <b>What you've signed</b>
          <table className="data-table" style={{ marginTop: 8 }}><tbody>
            {signed.map((s) => (
              <tr key={s.id}><td>{s.form_type === 'w4' ? 'Form W-4' : s.data?.title} <span style={{ fontSize: 11.5, color: 'var(--mist)' }}>{s.form_version}</span></td><td>{new Date(s.signed_at).toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}><button className="logout-button" onClick={() => printCertificate({ orgName: '', employeeName, form: s, ackDoc: acks.find((a) => a.id === s.ack_document_id) })}>🖨 Print</button></td></tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  )
}

function SignBlock({ statement, onSign, busy, err, label = 'Sign' }) {
  const [name, setName] = useState('')
  const [agree, setAgree] = useState(false)
  return (
    <div style={{ background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginTop: 12 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, cursor: 'pointer' }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} /> <span>{statement}</span>
      </label>
      <label style={{ fontSize: 12.5, display: 'block', marginTop: 8 }}>Type your full legal name to sign
        <input style={{ ...inp, fontFamily: 'cursive, Georgia, serif', fontSize: 17 }} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 4 }}>This is your electronic signature. We record the date and time, your IP address and device with it.</div>
      {err && <div className="auth-error" style={{ marginTop: 8 }}>{err}</div>}
      <button className="auth-button" style={{ width: 'auto', marginTop: 10 }} disabled={busy || !agree || name.trim().length < 3} onClick={() => onSign(name.trim())}>{busy ? 'Signing…' : label}</button>
    </div>
  )
}

function AckCard({ doc, onDone }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function openPdf() {
    const r = await callSign({ action: 'ack_file', ack_document_id: doc.id })
    if (r.url) window.open(r.url, '_blank'); else setErr(r.error || 'Could not open the file.')
  }
  async function sign(name) {
    setBusy(true); setErr('')
    const r = await callSign({ action: 'ack', ack_document_id: doc.id, signed_name: name, agree: true })
    setBusy(false); if (r.error) setErr(r.error); else onDone()
  }
  return (
    <div style={box}>
      <b>{doc.title}</b> <span style={{ fontSize: 12, color: 'var(--mist)' }}>version {doc.version}</span>
      {doc.body && <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginTop: 8, background: '#fff' }}>{doc.body}</div>}
      {doc.storage_path && <button className="logout-button" style={{ marginTop: 8 }} onClick={openPdf}>📄 Open the document</button>}
      <SignBlock statement="I acknowledge that I have received and read this document, and I agree to follow it. I understand I may ask questions about it at any time." onSign={sign} busy={busy} err={err} label="Acknowledge & sign" />
    </div>
  )
}

function W4Form({ prev, employeeName, onDone }) {
  const parts = (employeeName || '').split(' ')
  const [d, setD] = useState({
    first_name: prev?.first_name || parts[0] || '', last_name: prev?.last_name || parts.slice(1).join(' ') || '',
    address: prev?.address || '', city_state_zip: prev?.city_state_zip || '', filing_status: prev?.filing_status || '',
    step2_checked: !!prev?.step2_checked, step3_children: prev?.step3_children || '', step3_other: prev?.step3_other || '',
    step4a_other_income: prev?.step4a_other_income || '', step4b_deductions: prev?.step4b_deductions || '', step4c_extra: prev?.step4c_extra || '', exempt: !!prev?.exempt,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  async function sign(name) {
    setBusy(true); setErr('')
    const r = await callSign({ action: 'w4', data: d, signed_name: name, agree: true })
    setBusy(false); if (r.error) setErr(r.error); else onDone()
  }
  const sec = { borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 12 }
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Same questions as the IRS Form W-4. Not sure? The IRS Tax Withholding Estimator (irs.gov/w4app) helps. Your Social Security number is kept securely by the office and isn't entered here.</div>
      <div style={sec}><b>Step 1 — Personal information</b>
        <div style={{ display: 'flex', gap: 8 }}><label style={{ flex: 1, fontSize: 12.5 }}>First name<input style={inp} value={d.first_name} onChange={set('first_name')} /></label><label style={{ flex: 1, fontSize: 12.5 }}>Last name<input style={inp} value={d.last_name} onChange={set('last_name')} /></label></div>
        <label style={{ fontSize: 12.5, display: 'block' }}>Address<input style={inp} value={d.address} onChange={set('address')} /></label>
        <label style={{ fontSize: 12.5, display: 'block' }}>City, state, ZIP<input style={inp} value={d.city_state_zip} onChange={set('city_state_zip')} /></label>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>(c) Filing status</div>
        {[['single', 'Single or Married filing separately'], ['married', 'Married filing jointly or Qualifying surviving spouse'], ['hoh', 'Head of household (only if you\'re unmarried and pay more than half the costs of keeping up a home for yourself and a qualifying individual)']].map(([k, l]) => (
          <label key={k} style={{ display: 'flex', gap: 8, fontSize: 13.5, margin: '4px 0', cursor: 'pointer' }}><input type="radio" checked={d.filing_status === k} onChange={() => setD({ ...d, filing_status: k })} /> {l}</label>
        ))}
      </div>
      <div style={sec}><b>Step 2 — Multiple jobs or spouse works</b>
        <label style={{ display: 'flex', gap: 8, fontSize: 13.5, marginTop: 4, cursor: 'pointer' }}><input type="checkbox" checked={d.step2_checked} onChange={set('step2_checked')} /> Check if there are only two jobs total (you have two jobs, or you're married filing jointly and your spouse also works) and the pay is similar.</label>
      </div>
      <div style={sec}><b>Step 3 — Claim dependents and other credits</b> <span style={{ fontSize: 12, color: 'var(--mist)' }}>(if your income is $200,000 or less, $400,000 married filing jointly)</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: 1, fontSize: 12.5 }}>Qualifying children under 17 × $2,000 =<input type="number" min="0" style={inp} value={d.step3_children} onChange={set('step3_children')} placeholder="$" /></label>
          <label style={{ flex: 1, fontSize: 12.5 }}>Other dependents × $500 =<input type="number" min="0" style={inp} value={d.step3_other} onChange={set('step3_other')} placeholder="$" /></label>
        </div>
      </div>
      <div style={sec}><b>Step 4 — Other adjustments (optional)</b>
        <label style={{ fontSize: 12.5, display: 'block' }}>(a) Other income not from jobs (yearly)<input type="number" min="0" style={inp} value={d.step4a_other_income} onChange={set('step4a_other_income')} placeholder="$" /></label>
        <label style={{ fontSize: 12.5, display: 'block' }}>(b) Deductions beyond the standard deduction (yearly)<input type="number" min="0" style={inp} value={d.step4b_deductions} onChange={set('step4b_deductions')} placeholder="$" /></label>
        <label style={{ fontSize: 12.5, display: 'block' }}>(c) Extra withholding each pay period<input type="number" min="0" style={inp} value={d.step4c_extra} onChange={set('step4c_extra')} placeholder="$" /></label>
        <label style={{ display: 'flex', gap: 8, fontSize: 13, marginTop: 6, cursor: 'pointer' }}><input type="checkbox" checked={d.exempt} onChange={set('exempt')} /> I claim exemption from withholding (I had no federal tax liability last year and expect none this year). Exemption must be renewed every year.</label>
      </div>
      <div style={sec}><b>Step 5 — Sign</b>
        <SignBlock statement={W4_PERJURY} onSign={sign} busy={busy} err={err} label="Sign my W-4" />
      </div>
    </div>
  )
}
