import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { money, num, r2, fmtDate, today, LIEN_DOC_LABEL } from './data'

// Commercial Projects · one Florida lien document, printed in the statutory form:
//   Fla. Stat. 713.20(4) progress waiver · 713.20(5) final waiver · 713.06(3)(d) final payment affidavit.
// The form wording below is the statute's and must not be edited (713.20(6)).
export default function LienDocument() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [project, setProject] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('cp_lien_documents').select('*').eq('id', id).maybeSingle()
    if (error || !data) { setMsg(error?.message || 'Document not found'); return }
    const { data: p } = await supabase.from('cp_projects').select('id, name, project_number').eq('id', data.project_id).maybeSingle()
    setD({ ...data, unpaid_lienors: Array.isArray(data.unpaid_lienors) ? data.unpaid_lienors : [] }); setProject(p); setDirty(false)
  }, [id])
  useEffect(() => { load() }, [load])

  if (msg && !d) return <div><h2 className="page-title">Lien Document</h2><p>{msg}</p></div>
  if (!d) return <div><h2 className="page-title">Lien Document</h2><p style={{ color: 'var(--mist)' }}>Loading…</p></div>

  const set = (k, v) => { setD({ ...d, [k]: v }); setDirty(true) }
  const locked = d.status !== 'prepared'
  const isAff = d.doc_type === 'final_affidavit'

  async function save(patch = {}) {
    const { error } = await supabase.from('cp_lien_documents').update({
      amount: r2(d.amount), through_date: d.through_date || null, lienor_name: d.lienor_name, customer_name: d.customer_name, owner_name: d.owner_name,
      property_description: d.property_description, signer_name: d.signer_name, signer_title: d.signer_title, county: d.county,
      conditional_on_check: !!d.conditional_on_check, check_number: d.check_number || null,
      unpaid_lienors: (d.unpaid_lienors || []).filter((l) => (l.name || '').trim()), dated: d.dated || today(), ...patch,
    }).eq('id', d.id)
    if (error) { setMsg(error.message); return false }
    setMsg(patch.status === 'delivered' ? 'Marked delivered.' : 'Saved.'); load(); return true
  }
  async function remove() {
    if (!window.confirm('Delete this document?')) return
    await supabase.from('cp_lien_documents').delete().eq('id', d.id)
    navigate(`/commercial/projects/${d.project_id}`)
  }

  const inp = (label, key, type = 'text', w = 220) => (
    <div className="field" style={{ minWidth: w, flex: `1 1 ${w}px` }}><label>{label}</label>
      <input type={type} step={type === 'number' ? '0.01' : undefined} value={d[key] ?? ''} onChange={(e) => set(key, e.target.value)} disabled={locked} /></div>
  )
  const blank = (v, w = 160) => <span style={{ display: 'inline-block', minWidth: w, borderBottom: '1px solid #000', padding: '0 4px', fontWeight: 600 }}>{v || ' '}</span>
  const dt = d.dated ? new Date(d.dated + 'T12:00:00') : null
  const dayMonth = dt ? dt.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : ''
  const year = dt ? dt.getFullYear() : ''
  const amt = num(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div>
      <style>{`@media print { body * { visibility: hidden !important; } .cp-print, .cp-print * { visibility: visible !important; }
        .cp-print { position: absolute; left: 0; top: 0; width: 100%; color: #000; background: #fff !important; border: none !important; } .cp-noprint { display: none !important; } }`}</style>
      <div className="cp-noprint">
        <h2 className="page-title">{LIEN_DOC_LABEL[d.doc_type]}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <Link to={`/commercial/projects/${d.project_id}`} className="logout-button" style={{ textDecoration: 'none', fontSize: 14 }}>← {project?.name || 'Project'}</Link>
          <span className="badge">{d.status === 'delivered' ? `Delivered ${fmtDate(d.delivered_date)}` : d.status === 'void' ? 'Void' : 'Prepared'}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="logout-button" onClick={() => window.print()}>Print / Save PDF</button>
            {!locked && <button className="logout-button" onClick={remove}>Delete</button>}
            {!locked && <button className="logout-button" onClick={() => save()} disabled={!dirty}>Save</button>}
            {!locked && <button className="auth-button" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => save({ status: 'delivered', delivered_date: today() })}>Mark delivered</button>}
            {d.status === 'delivered' && <button className="logout-button" onClick={() => save({ status: 'void' })}>Void</button>}
          </span>
        </div>
        {!isAff && (
          <div style={{ background: 'rgba(242,169,60,0.12)', border: '1px solid rgba(242,169,60,0.5)', borderRadius: 10, padding: '10px 14px', fontSize: 14, marginBottom: 12 }}>
            <strong>Hand this over only when you are paid.</strong> A Florida statutory waiver releases your lien rights for the amount stated as soon as you sign it. If you are trading it for a check, tick "Conditioned on payment of a check" so the waiver only takes effect when the check clears (Fla. Stat. 713.20(7)).
          </div>
        )}
        {msg && <div style={{ fontWeight: 600, marginBottom: 10, color: /Saved|delivered/.test(msg) ? '#1F7A43' : '#B00020' }}>{msg}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          {inp(isAff ? 'Final payment amount ($)' : 'Payment amount ($)', 'amount', 'number', 160)}
          {d.doc_type === 'progress_waiver' && inp('Work furnished through', 'through_date', 'date', 170)}
          {inp('Date signed', 'dated', 'date', 160)}
          {inp(isAff ? "Contractor's business name" : 'Lienor (your company)', 'lienor_name')}
          {!isAff && inp('Your customer (who hired you)', 'customer_name')}
          {inp('Owner', 'owner_name')}
          {!isAff && <div className="field" style={{ flex: '1 1 100%' }}><label>Property description (address or legal description)</label>
            <textarea rows={2} style={{ width: '100%' }} value={d.property_description || ''} onChange={(e) => set('property_description', e.target.value)} disabled={locked} /></div>}
          {inp(isAff ? 'Affiant name' : 'Signed by (name)', 'signer_name')}{inp(isAff ? 'Affiant title' : 'Title', 'signer_title', 'text', 160)}
          {isAff && inp('County (where signed)', 'county', 'text', 160)}
        </div>
        {!isAff && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14, fontSize: 14 }}>
            <input type="checkbox" checked={!!d.conditional_on_check} onChange={(e) => set('conditional_on_check', e.target.checked)} disabled={locked} />
            Conditioned on payment of a check
            {d.conditional_on_check && <input placeholder="Check #" value={d.check_number || ''} onChange={(e) => set('check_number', e.target.value)} disabled={locked} style={{ width: 120 }} />}
          </label>
        )}
        {isAff && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Lienors under your contract who have NOT been paid in full (suppliers or subs who served a notice to owner)</div>
            {(d.unpaid_lienors || []).map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input placeholder="Name of lienor" value={l.name || ''} disabled={locked} style={{ flex: 1 }}
                  onChange={(e) => { const n = d.unpaid_lienors.slice(); n[i] = { ...n[i], name: e.target.value }; set('unpaid_lienors', n) }} />
                <input type="number" step="0.01" placeholder="Amount due" value={l.amount ?? ''} disabled={locked} style={{ width: 140, textAlign: 'right' }}
                  onChange={(e) => { const n = d.unpaid_lienors.slice(); n[i] = { ...n[i], amount: e.target.value }; set('unpaid_lienors', n) }} />
                {!locked && <button className="logout-button" onClick={() => set('unpaid_lienors', d.unpaid_lienors.filter((_, j) => j !== i))}>✕</button>}
              </div>
            ))}
            {!locked && <button className="logout-button" onClick={() => set('unpaid_lienors', [...(d.unpaid_lienors || []), { name: '', amount: '' }])}>+ Add unpaid lienor</button>}
            <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 6 }}>Leave empty if everyone has been paid. The affidavit must be signed in front of a notary and given to the owner before final payment (Fla. Stat. 713.06(3)(d)).</div>
          </div>
        )}
      </div>

      {/* Statutory form */}
      <div className="cp-print" style={{ background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '28px 32px', maxWidth: 760, fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 15, lineHeight: 1.7 }}>
        {d.doc_type === 'progress_waiver' && (<>
          <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: 18 }}>WAIVER AND RELEASE OF LIEN<br />UPON PROGRESS PAYMENT</div>
          <p>The undersigned lienor, in consideration of the sum of ${blank(amt, 120)}, hereby waives and releases its lien and right to claim a lien for labor, services, or materials furnished through {blank(fmtDate(d.through_date), 150)} to {blank(d.customer_name, 200)} on the job of {blank(d.owner_name, 200)} to the following property:</p>
          <p style={{ paddingLeft: 24 }}>{blank(d.property_description, 420)}</p>
          <p>This waiver and release does not cover any retention or labor, services, or materials furnished after the date specified.</p>
        </>)}
        {d.doc_type === 'final_waiver' && (<>
          <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: 18 }}>WAIVER AND RELEASE OF LIEN<br />UPON FINAL PAYMENT</div>
          <p>The undersigned lienor, in consideration of the final payment in the amount of ${blank(amt, 120)}, hereby waives and releases its lien and right to claim a lien for labor, services, or materials furnished to {blank(d.customer_name, 200)} on the job of {blank(d.owner_name, 200)} to the following described property:</p>
          <p style={{ paddingLeft: 24 }}>{blank(d.property_description, 420)}</p>
        </>)}
        {!isAff && (<>
          {d.conditional_on_check && <p>This waiver and release is conditioned on payment of check no. {blank(d.check_number, 100)} in the amount of ${blank(amt, 110)}.</p>}
          <p>DATED on {blank(dayMonth, 150)}, {blank(year, 60)}.</p>
          <div style={{ marginTop: 26 }}>{blank(d.lienor_name, 300)}<div>(Lienor)</div></div>
          <div style={{ marginTop: 26 }}>By: {blank('', 300)}<div style={{ paddingLeft: 30 }}>{d.signer_name}{d.signer_title ? ', ' + d.signer_title : ''}</div></div>
          <div className="cp-noprint" style={{ marginTop: 18, fontSize: 12, color: 'var(--mist)', fontFamily: 'system-ui, sans-serif' }}>Statutory form, Fla. Stat. {d.doc_type === 'progress_waiver' ? '713.20(4)' : '713.20(5)'}.{d.conditional_on_check ? ' Check condition added under 713.20(7).' : ''}</div>
        </>)}
        {isAff && (<>
          <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: 14 }}>CONTRACTOR'S FINAL PAYMENT AFFIDAVIT</div>
          <div>State of Florida</div>
          <div>County of {blank(d.county, 180)}</div>
          <p>Before me, the undersigned authority, personally appeared {blank(d.signer_name, 200)}, who, after being first duly sworn, deposes and says of his or her personal knowledge the following:</p>
          <p>1. He or she is the {blank(d.signer_title, 140)}, of {blank(d.lienor_name, 220)}, which does business in the State of Florida, hereinafter referred to as the "Contractor."</p>
          <p>2. Contractor, pursuant to a contract with {blank(d.owner_name, 200)}, hereinafter referred to as the "Owner," has furnished or caused to be furnished labor, materials, and services for the construction of certain improvements to real property as more particularly set forth in said contract.</p>
          <p>3. This affidavit is executed by the Contractor in accordance with section 713.06 of the Florida Statutes for the purposes of obtaining final payment from the Owner in the amount of ${blank(amt, 120)}.</p>
          <p>4. All work to be performed under the contract has been fully completed, and all lienors under the direct contract have been paid in full, except the following listed lienors:</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0 14px' }}>
            <thead><tr><th style={{ textAlign: 'left', borderBottom: '1px solid #000' }}>NAME OF LIENOR</th><th style={{ textAlign: 'right', borderBottom: '1px solid #000' }}>AMOUNT DUE</th></tr></thead>
            <tbody>{(d.unpaid_lienors || []).filter((l) => (l.name || '').trim()).length === 0
              ? <tr><td style={{ padding: '6px 0' }}>None</td><td></td></tr>
              : d.unpaid_lienors.filter((l) => (l.name || '').trim()).map((l, i) => <tr key={i}><td style={{ padding: '4px 0' }}>{l.name}</td><td style={{ textAlign: 'right' }}>{money(l.amount)}</td></tr>)}</tbody>
          </table>
          <p>Signed, sealed, and delivered this {blank(dt ? dt.getDate() : '', 40)} day of {blank(dt ? dt.toLocaleDateString(undefined, { month: 'long' }) : '', 110)}, {blank(year, 60)}.</p>
          <div style={{ marginTop: 22 }}>By {blank('', 280)}<div style={{ paddingLeft: 26 }}>{d.signer_name || '(name of affiant)'}{d.signer_title ? ', ' + d.signer_title : ''}</div><div style={{ paddingLeft: 26 }}>{d.lienor_name}</div></div>
          <p style={{ marginTop: 22 }}>Sworn to and subscribed before me this {blank('', 40)} day of {blank('', 140)} by {blank(d.signer_name, 200)}, who is personally known to me or produced {blank('', 180)} as identification, and did take an oath.</p>
          <div style={{ marginTop: 28 }}>{blank('', 300)}<div>Notary Public</div></div>
          <div style={{ marginTop: 8 }}>My Commission Expires: {blank('', 160)}</div>
          <div className="cp-noprint" style={{ marginTop: 18, fontSize: 12, color: 'var(--mist)', fontFamily: 'system-ui, sans-serif' }}>Form per Fla. Stat. 713.06(3)(d).</div>
        </>)}
      </div>
    </div>
  )
}
