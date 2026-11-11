import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FieldShell from './FieldShell'
import { supabase } from '../utils/supabase'
import { usd, fmtPhone, telHref, smsHref, shortDay } from './fieldUtil'

// CUSTOMERS — find anyone, see their homes, equipment, jobs and invoices, and call, text or book.
export default function FieldCustomers({ profile }) {
  const navigate = useNavigate()
  const orgId = profile?.org_id
  const [q, setQ] = useState(() => { try { return sessionStorage.getItem('fa_cust_q') || '' } catch { return '' } })
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!orgId) return
    try { sessionStorage.setItem('fa_cust_q', q) } catch { /* private mode */ }
    let live = true
    const t = setTimeout(async () => {
      const s = q.trim().replace(/[%,()]/g, ' ')
      let query = supabase.from('customers').select('id, display_name, company, primary_phone, email_1, is_active').eq('org_id', orgId)
      if (s) {
        const digits = s.replace(/\D/g, '')
        const ors = [`display_name.ilike.%${s}%`, `company.ilike.%${s}%`, `email_1.ilike.%${s}%`]
        if (digits.length >= 3) ors.push(`primary_phone.ilike.%${digits.slice(-4)}%`)
        query = query.or(ors.join(','))
      }
      const { data } = await query.order('display_name').limit(60)
      let list = data || []
      if (s) {
        // Also match by street address.
        const { data: props } = await supabase.from('properties').select('customer_id, street_address').eq('org_id', orgId).ilike('street_address', `%${s}%`).limit(30)
        const extra = [...new Set((props || []).map((p) => p.customer_id).filter((id) => id && !list.some((c) => c.id === id)))]
        if (extra.length) {
          const { data: more } = await supabase.from('customers').select('id, display_name, company, primary_phone, email_1, is_active').in('id', extra)
          list = [...list, ...(more || [])]
        }
      }
      if (live) setRows(list)
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [orgId, q])
  return (
    <FieldShell profile={profile} title="Customers" onBack={() => navigate('/tech/field')}>
      <input className="fa-input" style={{ marginBottom: 10, fontSize: 16 }} placeholder="Name, phone, email or address…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="fa-panel">
        <button type="button" className="fa-navbtn ghost" style={{ borderColor: 'var(--fa-cyan)' }} onClick={() => navigate('/tech/field/add', { state: { mode: 'customer' } })}>+ New Customer</button>
        {!rows ? <p className="fa-empty">Loading…</p> : !rows.length ? <p className="fa-empty">No customers match.</p> : rows.map((c) => (
          <div key={c.id} className="fa-info" role="button" tabIndex={0} style={{ cursor: 'pointer', padding: '10px 12px', opacity: c.is_active === false ? 0.6 : 1 }} onClick={() => navigate(`/tech/field/customer/${c.id}`)}>
            <div style={{ fontWeight: 800, fontSize: 15.5 }}>{c.display_name}{c.company && c.company !== c.display_name ? <span className="fa-muted" style={{ fontWeight: 600 }}> · {c.company}</span> : ''}</div>
            <div className="fa-muted" style={{ fontSize: 13 }}>{[fmtPhone(c.primary_phone), c.email_1].filter(Boolean).join(' · ') || 'No contact on file'}</div>
          </div>
        ))}
      </div>
    </FieldShell>
  )
}

const EDIT_FIELDS = [['display_name', 'Name'], ['company', 'Company'], ['primary_phone', 'Phone'], ['secondary_phone', 'Other phone'], ['email_1', 'Email'], ['notes', 'Notes']]

export function FieldCustomer({ profile }) {
  const navigate = useNavigate()
  const { customerId } = useParams()
  const [c, setC] = useState(null)
  const [props, setProps] = useState([])
  const [equip, setEquip] = useState([])
  const [jobs, setJobs] = useState([])
  const [invs, setInvs] = useState([])
  const [edit, setEdit] = useState(null)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState('')
  async function load() {
    const { data, error } = await supabase.from('customers').select('id, display_name, company, first_name, last_name, primary_phone, secondary_phone, email_1, email_2, notes, is_banned').eq('id', customerId).maybeSingle()
    if (error || !data) { setErr('Customer not found.'); return }
    setC(data)
    const { data: pr } = await supabase.from('properties').select('id, street_address, unit, city, state, zip, gate_code, notes').or(`customer_id.eq.${customerId},bill_to_customer_id.eq.${customerId}`).eq('is_active', true)
    setProps(pr || [])
    const pids = (pr || []).map((p) => p.id)
    const [{ data: eq }, { data: jb }, { data: iv }] = await Promise.all([
      pids.length ? supabase.from('property_equipment').select('id, property_id, system_label, outdoor_brand, outdoor_model, indoor_brand, indoor_model, furnace_brand, install_date, manufacture_year, status').in('property_id', pids).neq('status', 'retired') : Promise.resolve({ data: [] }),
      supabase.from('jobs').select('id, job_number, segment, job_date, job_type, status').eq('customer_id', customerId).is('deleted_at', null).order('job_date', { ascending: false }).limit(25),
      supabase.from('invoices').select('id, invoice_number, kind, approval_status, invoice_date, job_total, balance, paid_at, job_id').eq('bills_to_customer_id', customerId).is('deleted_at', null).in('kind', ['invoice', 'estimate']).order('created_at', { ascending: false }).limit(25),
    ])
    setEquip(eq || []); setJobs(jb || []); setInvs(iv || [])
  }
  useEffect(() => { load() }, [customerId]) // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    setMsg(null)
    const patch = {}
    for (const [k] of EDIT_FIELDS) patch[k] = String(edit[k] ?? '').trim() || null
    if (!patch.display_name) { setMsg({ ok: false, t: 'Name is required.' }); return }
    const { error } = await supabase.from('customers').update(patch).eq('id', customerId)
    if (error) { setMsg({ ok: false, t: error.message }); return }
    setEdit(null); setMsg({ ok: true, t: 'Saved.' }); load()
  }
  const h = { fontWeight: 800, fontSize: 15, margin: '6px 4px 0' }
  const line = (j) => `${j.job_number}${j.segment > 1 ? `-${j.segment}` : ''}`
  return (
    <FieldShell profile={profile} title="Customer" onBack={() => navigate(-1)}>
      <div className="fa-panel">
        {err ? <p className="fa-empty">{err}</p> : !c ? <p className="fa-empty">Loading…</p> : edit ? (<>
          {EDIT_FIELDS.map(([k, l]) => (
            <div key={k}><div className="fa-section-label">{l}</div>
              {k === 'notes' ? <textarea className="fa-textarea" rows={3} value={edit[k] ?? ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
                : <input className="fa-input" style={{ fontSize: 16 }} inputMode={k.includes('phone') ? 'tel' : k.includes('email') ? 'email' : undefined} value={edit[k] ?? ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />}
            </div>
          ))}
          {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="fa-navbtn" style={{ flex: 1 }} onClick={save}>Save</button>
            <button type="button" className="fa-navbtn ghost" style={{ flex: 1 }} onClick={() => { setEdit(null); setMsg(null) }}>Cancel</button>
          </div>
        </>) : (<>
          <div className="fa-info">
            <div className="fa-info-name">{c.display_name}</div>
            {c.company && c.company !== c.display_name && <div className="fa-info-line">{c.company}</div>}
            {c.primary_phone && <div className="fa-info-line">{fmtPhone(c.primary_phone)}</div>}
            {c.email_1 && <div className="fa-info-line" style={{ overflowWrap: 'anywhere' }}>{c.email_1}</div>}
            {c.notes && <div className="fa-info-line" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{c.notes}</div>}
            {c.is_banned && <span className="fa-chip red">Do not service</span>}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {c.primary_phone && <a className="fa-small-btn" style={{ textDecoration: 'none' }} href={telHref(c.primary_phone)}>Call</a>}
              {c.primary_phone && <a className="fa-small-btn" style={{ textDecoration: 'none' }} href={smsHref(c.primary_phone)}>Text</a>}
              <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)' }} onClick={() => setEdit({ ...c })}>Edit</button>
            </div>
          </div>
          {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
          {!c.is_banned && <button type="button" className="fa-navbtn" onClick={() => navigate('/tech/new-job', { state: { customer: c, phone: c.primary_phone || '' } })}>+ New Job for {c.first_name || c.display_name}</button>}

          <div style={h}>Properties</div>
          {!props.length ? <p className="fa-muted" style={{ margin: '0 4px' }}>No property on file.</p> : props.map((p) => {
            const eqs = equip.filter((e) => e.property_id === p.id)
            const addr = [p.street_address + (p.unit ? ` #${p.unit}` : ''), p.city, [p.state, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
            return (
              <div key={p.id} className="fa-info">
                <div style={{ fontWeight: 700 }}>{addr}</div>
                <a className="fa-muted" style={{ fontSize: 12.5 }} href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`} target="_blank" rel="noopener noreferrer">Directions ↗</a>
                {p.gate_code && <div className="fa-info-line">Gate: {p.gate_code}</div>}
                {p.notes && <div className="fa-info-line" style={{ whiteSpace: 'pre-wrap' }}>{p.notes}</div>}
                {eqs.map((e) => (
                  <div key={e.id} style={{ borderTop: '1px solid #E3EAF0', marginTop: 8, paddingTop: 6, fontSize: 13.5 }}>
                    <b>{e.system_label || 'System'}</b>{(e.manufacture_year || e.install_date) ? ` · ${e.manufacture_year || String(e.install_date).slice(0, 4)}` : ''}
                    <div className="fa-muted">{[e.outdoor_brand && `Outdoor: ${e.outdoor_brand} ${e.outdoor_model || ''}`, e.indoor_brand && `Indoor: ${e.indoor_brand} ${e.indoor_model || ''}`, e.furnace_brand && `Furnace: ${e.furnace_brand}`].filter(Boolean).join(' · ') || 'No details'}</div>
                  </div>
                ))}
              </div>
            )
          })}

          <div style={h}>Jobs</div>
          {!jobs.length ? <p className="fa-muted" style={{ margin: '0 4px' }}>No jobs yet.</p> : jobs.map((j) => (
            <div key={j.id} className="fa-info" role="button" tabIndex={0} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '9px 12px' }} onClick={() => navigate(`/tech/field/job/${j.id}`)}>
              <div><b>#{line(j)}</b> <span className="fa-muted">{j.job_type}</span></div>
              <div className="fa-muted" style={{ whiteSpace: 'nowrap' }}>{shortDay(j.job_date)} · {String(j.status || '').replace(/_/g, ' ')}</div>
            </div>
          ))}

          <div style={h}>Invoices &amp; Estimates</div>
          {!invs.length ? <p className="fa-muted" style={{ margin: '0 4px' }}>None yet.</p> : invs.map((i) => (
            <div key={i.id} className="fa-info" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '9px 12px' }}>
              <div><b>{i.kind === 'estimate' ? 'Est' : 'Inv'} #{i.invoice_number}</b> <span className="fa-muted">{shortDay(i.invoice_date)}</span></div>
              <div style={{ textAlign: 'right' }}>
                <b>{usd(i.job_total)}</b>
                <div className="fa-muted" style={{ fontSize: 12 }}>{i.kind === 'estimate' ? (i.approval_status || 'Pending') : i.paid_at ? 'Paid' : Number(i.balance) > 0 ? `${usd(i.balance)} due` : 'Open'}</div>
              </div>
            </div>
          ))}
        </>)}
      </div>
    </FieldShell>
  )
}
