// Duct Cleaning estimate / invoice editor — desktop (/estimate/:jobId, /invoice/:jobId) and
// field app (/tech/estimate/:jobId, /tech/invoice/:jobId) for jobs whose type is Duct Cleaning.
// The tech or office taps quantities against the Duct Cleaning Pricebook; prices, tax and totals
// fill in. Numbers come from the database: invoices DC-0112 (same as the job), estimates EDC-0078.
// The customer copy, sending, approval and payment use the same pages as every other invoice.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from './utils/supabase'

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// Used by the route switch: is this job a duct cleaning job?
export async function isDuctCleaningJob(jobId) {
  if (!jobId) return false
  const { data } = await supabase.from('jobs').select('service_line').eq('id', jobId).maybeSingle()
  return data?.service_line === 'duct_cleaning'
}

// Route wrapper: duct cleaning jobs open this editor; every other job opens the normal page.
export function DuctOr({ kind, mobile, profile, children }) {
  const { jobId } = useParams()
  const [dc, setDc] = useState(null)
  useEffect(() => { let live = true; isDuctCleaningJob(jobId).then((v) => { if (live) setDc(v) }); return () => { live = false } }, [jobId])
  if (dc === null) return <div className="page"><p style={{ color: 'var(--mist)' }}>Loading…</p></div>
  return dc ? <DuctCleaningEditor jobId={jobId} kind={kind} mobile={mobile} profile={profile} /> : children
}

export default function DuctCleaningEditor({ jobId: jobIdProp, estimateId, kind, profile, mobile }) {
  const navigate = useNavigate()
  const isEstimate = kind === 'estimate'
  const [job, setJob] = useState(null)
  const [doc, setDoc] = useState(null)
  const [items, setItems] = useState([])
  const [lines, setLines] = useState([])
  const [rate, setRate] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [custom, setCustom] = useState(null)

  async function load() {
    setErr('')
    // An estimate written before any job: open it by its own id; the job may not exist yet.
    let byId = null
    if (estimateId) {
      const { data } = await supabase.from('invoices').select('*').eq('id', estimateId).maybeSingle()
      if (!data) { setErr('Estimate not found.'); return }
      byId = data
    }
    const jid = jobIdProp || byId?.job_id
    let j = null
    if (jid) {
      ({ data: j } = await supabase.from('jobs').select('id, org_id, job_number, segment, customer_id, property_id, status, customers ( display_name )').eq('id', jid).maybeSingle())
      if (!j) { setErr('Job not found.'); return }
    } else {
      const { data: c } = byId.bills_to_customer_id ? await supabase.from('customers').select('display_name').eq('id', byId.bills_to_customer_id).maybeSingle() : { data: null }
      j = { id: null, org_id: byId.org_id, job_number: null, segment: 1, customer_id: byId.bills_to_customer_id, property_id: byId.property_id, customers: c }
    }
    setJob(j)
    const [{ data: pb }, { data: o }] = await Promise.all([
      supabase.from('duct_pricebook_items').select('*').eq('org_id', j.org_id).eq('is_active', true).order('sort_order').order('name'),
      supabase.from('organizations').select('sales_tax_rate').eq('id', j.org_id).maybeSingle(),
    ])
    setItems(pb || []); setRate(Number(o?.sales_tax_rate) || 0)

    let d = byId
    if (!d) {
      let q = supabase.from('invoices').select('*').eq('job_id', jid).eq('kind', kind).is('deleted_at', null)
      if (isEstimate) q = q.neq('estimate_type', 'system')
      ;({ data: d } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle())
    }
    if (!d && !isEstimate) {
      // Start the invoice from the approved estimate when there is one (copies its lines).
      const { data: est } = await supabase.from('invoices').select('id, approved_by').eq('job_id', jid).eq('kind', 'estimate').eq('approval_status', 'Approved').is('deleted_at', null).order('approved_at', { ascending: false }).limit(1).maybeSingle()
      if (est) {
        await supabase.rpc('convert_approved_estimate', { p_estimate_id: est.id, p_approved_by: est.approved_by || profile?.full_name || 'Customer' })
        ;({ data: d } = await supabase.from('invoices').select('*').eq('job_id', jid).eq('kind', 'invoice').limit(1).maybeSingle())
      }
    }
    if (!d) {
      // The database assigns the DC- / EDC- number.
      const { data: created, error } = await supabase.from('invoices').insert({
        org_id: j.org_id, job_id: jid, kind, invoice_number: 'DC-NEW', invoice_date: new Date().toISOString().slice(0, 10),
        bills_to_customer_id: j.customer_id, property_id: j.property_id, discount_type: 'dollar', service_line: 'duct_cleaning',
        ...(isEstimate ? { estimate_type: 'service', approval_status: 'Pending' } : {}),
      }).select('*').single()
      if (error) { setErr(error.message); return }
      d = created
    }
    setDoc(d)
    const { data: ls } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', d.id).order('sort_order')
    setLines(ls || [])
  }
  useEffect(() => { load() }, [jobIdProp, estimateId, kind]) // eslint-disable-line react-hooks/exhaustive-deps

  const locked = !!doc && (isEstimate ? doc.approval_status === 'Approved' || doc.approval_status === 'Declined' : !!doc.paid_at)
  const byItem = useMemo(() => Object.fromEntries(lines.filter((l) => l.duct_item_id).map((l) => [l.duct_item_id, l])), [lines])
  const customLines = lines.filter((l) => !l.duct_item_id)
  const cats = useMemo(() => [...new Set(items.map((i) => i.category))], [items])

  const totals = useMemo(() => {
    const sub = r2(lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0))
    const taxable = lines.filter((l) => l.taxable).reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0)
    const tax = r2(taxable * rate / 100)
    return { sub, tax, total: r2(sub + tax) }
  }, [lines, rate])

  // Keep the invoice's totals in step with its lines.
  useEffect(() => {
    if (!doc || locked) return
    const paid = Number(doc.total_paid || 0)
    const patch = { subtotal: totals.sub, sales_tax: totals.tax, job_total: totals.total, amount_due: r2(totals.total - paid), balance: r2(totals.total - paid) }
    if (patch.subtotal === Number(doc.subtotal) && patch.job_total === Number(doc.job_total) && patch.sales_tax === Number(doc.sales_tax)) return
    supabase.from('invoices').update(patch).eq('id', doc.id).then(() => setDoc((x) => ({ ...x, ...patch })))
  }, [totals.sub, totals.tax, totals.total, doc?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function setQty(item, qty) {
    if (locked || busy) return
    qty = Math.max(0, Math.round(Number(qty) || 0))
    const ex = byItem[item.id]
    setBusy(true); setErr('')
    if (ex && qty === 0) {
      await supabase.from('invoice_line_items').delete().eq('id', ex.id)
      setLines((ls) => ls.filter((l) => l.id !== ex.id))
    } else if (ex) {
      await supabase.from('invoice_line_items').update({ quantity: qty }).eq('id', ex.id)
      setLines((ls) => ls.map((l) => (l.id === ex.id ? { ...l, quantity: qty } : l)))
    } else if (qty > 0) {
      const { data, error } = await supabase.from('invoice_line_items').insert({
        invoice_id: doc.id, org_id: doc.org_id, description: item.name, unit_price: Number(item.price), quantity: qty,
        taxable: !!item.taxable, is_custom: false, sort_order: item.sort_order || 0, category: item.category, duct_item_id: item.id,
      }).select('*').single()
      if (error) setErr(error.message); else setLines((ls) => [...ls, data])
    }
    setBusy(false)
  }
  async function addCustom(e) {
    e.preventDefault()
    if (!custom.description.trim() || !(Number(custom.unit_price) >= 0)) return
    const { data, error } = await supabase.from('invoice_line_items').insert({
      invoice_id: doc.id, org_id: doc.org_id, description: custom.description.trim(), unit_price: Number(custom.unit_price) || 0,
      quantity: Math.max(1, Number(custom.quantity) || 1), taxable: !!custom.taxable, is_custom: true, sort_order: 9999, category: 'Other',
    }).select('*').single()
    if (error) { setErr(error.message); return }
    setLines((ls) => [...ls, data]); setCustom(null)
  }
  async function removeLine(l) {
    if (locked) return
    await supabase.from('invoice_line_items').delete().eq('id', l.id)
    setLines((ls) => ls.filter((x) => x.id !== l.id))
  }

  async function send(channel) {
    setBusy(true); setErr(''); setMsg('')
    const { data, error } = await supabase.functions.invoke('send-invoice-email', { body: { invoiceId: doc.id, channel } })
    setBusy(false)
    let detail = data?.error
    if (!detail && error?.context?.json) { try { detail = (await error.context.json()).error } catch (e) { /* ignore */ } }
    if (detail || error) setErr(detail || error.message); else { setMsg(channel === 'sms' ? 'Texted to the customer.' : 'Emailed to the customer.'); load() }
  }
  async function approveAndInvoice() {
    if (!window.confirm('Mark this estimate approved and start the invoice from it?')) return
    setBusy(true)
    const by = profile?.full_name || 'Office'
    // Recording the approval creates the job automatically when the estimate has none yet.
    const { error: aErr } = await supabase.from('invoices').update({ approval_status: 'Approved', approved_at: new Date().toISOString(), approved_by: by }).eq('id', doc.id)
    if (aErr) { setBusy(false); setErr(aErr.message); return }
    const { data: fresh } = await supabase.from('invoices').select('job_id').eq('id', doc.id).maybeSingle()
    if (!fresh?.job_id) { setBusy(false); setErr('Approved, but no job could be created — the estimate needs a customer property.'); return }
    const { error } = await supabase.rpc('convert_approved_estimate', { p_estimate_id: doc.id, p_approved_by: by })
    setBusy(false)
    if (error) { setErr(error.message); return }
    navigate(mobile ? `/tech/invoice/${fresh.job_id}` : `/invoice/${fresh.job_id}`)
  }

  if (err && !doc) return <div className="page"><div className="auth-error">{err}</div></div>
  if (!doc || !job) return <div className="page"><p style={{ color: 'var(--mist)' }}>Loading…</p></div>

  const pad = mobile ? 12 : 0
  const stepBtn = { width: mobile ? 38 : 30, height: mobile ? 38 : 30, borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontSize: 18, fontWeight: 700, cursor: locked ? 'default' : 'pointer', lineHeight: 1 }
  const title = `${isEstimate ? 'Estimate' : 'Invoice'} ${doc.invoice_number}`

  return (
    <div className={mobile ? '' : 'page'} style={{ padding: pad, paddingBottom: mobile ? 110 : 0, maxWidth: 900 }}>
      <div style={{ marginBottom: 6 }}>
        {job.id
          ? <Link to={mobile ? `/tech/${job.id}` : `/jobs?job=${job.id}`} style={{ fontSize: 13 }}>← Job {job.job_number}{job.segment > 1 ? `-${job.segment}` : ''}</Link>
          : <Link to={mobile ? '/tech' : '/estimates'} style={{ fontSize: 13 }}>← {mobile ? 'Back' : 'Estimates'}</Link>}
        {!job.id && <span style={{ fontSize: 12.5, color: 'var(--mist)', marginLeft: 10 }}>No job yet — one is created automatically when it's approved.</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: '4px 0' }}>Duct Cleaning {title}</h2>
        <span style={{ fontSize: 13, color: 'var(--mist)' }}>{job.customers?.display_name}</span>
      </div>
      {!isEstimate && doc.from_estimate_number && <div style={{ fontSize: 13, color: 'var(--mist)', fontWeight: 600 }}>From Estimate #{doc.from_estimate_number}</div>}
      {locked && <div style={{ background: '#EEF1F6', borderRadius: 8, padding: '8px 12px', margin: '10px 0', fontSize: 13 }}>{isEstimate ? `This estimate is ${String(doc.approval_status).toLowerCase()} — it can't be changed.` : 'This invoice is paid — it can\'t be changed.'}</div>}
      {err && <div className="auth-error" style={{ margin: '10px 0' }}>{err}</div>}
      {msg && <div style={{ background: '#E3F1E8', color: '#166534', borderRadius: 8, padding: '8px 12px', margin: '10px 0', fontSize: 13, fontWeight: 600 }}>{msg}</div>}
      {!items.length && <div style={{ background: '#FFF8E6', border: '1px solid #F0DFA8', borderRadius: 8, padding: '8px 12px', margin: '10px 0', fontSize: 13 }}>The Duct Cleaning Pricebook is empty. {mobile ? 'Ask the office to add items.' : <Link to="/pricebook-duct-cleaning">Add items</Link>}</div>}

      {cats.map((c) => (
        <div key={c} style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#7A8290', marginBottom: 6 }}>{c}</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            {items.filter((i) => i.category === c).map((it, idx) => {
              const ln = byItem[it.id]; const qty = Number(ln?.quantity || 0)
              return (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: mobile ? '10px 12px' : '8px 12px', borderTop: idx ? '1px solid #EEF1F6' : 'none', background: qty ? '#F2F8FD' : '#fff' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: qty ? 700 : 500, fontSize: mobile ? 15 : 14 }}>{it.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--mist)' }}>{money(ln ? ln.unit_price : it.price)} each{it.taxable ? ' · taxable' : ''}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button style={stepBtn} disabled={locked || !qty} onClick={() => setQty(it, qty - 1)}>−</button>
                    <input type="number" min="0" value={qty || ''} placeholder="0" disabled={locked} onChange={(e) => setQty(it, e.target.value)} style={{ width: mobile ? 52 : 50, textAlign: 'center', fontWeight: 700, fontSize: 15 }} />
                    <button style={stepBtn} disabled={locked} onClick={() => setQty(it, qty + 1)}>+</button>
                  </div>
                  <div style={{ width: mobile ? 76 : 90, textAlign: 'right', fontWeight: 700 }}>{qty ? money(qty * Number(ln.unit_price)) : ''}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Other (custom) items */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#7A8290', marginBottom: 6 }}>Other duct cleaning items</div>
        {customLines.map((l) => (
          <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 2px', fontSize: 14 }}>
            <span style={{ flex: 1 }}>{l.description}{l.taxable ? <span style={{ color: 'var(--mist)', fontSize: 12 }}> · taxable</span> : null}</span>
            <span style={{ color: 'var(--mist)' }}>{l.quantity} × {money(l.unit_price)}</span>
            <b style={{ width: 90, textAlign: 'right' }}>{money(l.quantity * l.unit_price)}</b>
            {!locked && <button className="logout-button" style={{ padding: '2px 8px' }} onClick={() => removeLine(l)}>✕</button>}
          </div>
        ))}
        {!locked && (custom ? (
          <form onSubmit={addCustom} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} placeholder="Description" style={{ flex: '1 1 200px' }} autoFocus />
            <input type="number" min="1" value={custom.quantity} onChange={(e) => setCustom({ ...custom, quantity: e.target.value })} style={{ width: 60 }} title="Qty" />
            <input type="number" step="0.01" value={custom.unit_price} onChange={(e) => setCustom({ ...custom, unit_price: e.target.value })} placeholder="Price" style={{ width: 90 }} />
            <label style={{ fontSize: 13 }}><input type="checkbox" checked={custom.taxable} onChange={(e) => setCustom({ ...custom, taxable: e.target.checked })} /> Taxable</label>
            <button className="auth-button" type="submit" style={{ width: 'auto', margin: 0 }}>Add</button>
            <button className="logout-button" type="button" onClick={() => setCustom(null)}>Cancel</button>
          </form>
        ) : <button className="logout-button" onClick={() => setCustom({ description: '', quantity: 1, unit_price: '', taxable: false })}>+ Add other item</button>)}
      </div>

      {/* Totals + actions */}
      <div style={{ ...(mobile ? { position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid var(--border)', padding: '10px 14px', boxShadow: '0 -4px 14px rgba(0,0,0,.06)', zIndex: 20 } : { marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 14 }) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: 'var(--mist)' }}>Subtotal {money(totals.sub)} · Tax {money(totals.tax)}</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{isEstimate ? 'Estimated total' : 'Total due'} {money(isEstimate ? totals.total : totals.total - Number(doc.total_paid || 0))}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {mobile ? (
            <button className="auth-button" style={{ width: '100%', margin: 0 }} disabled={!lines.length} onClick={() => navigate(`/tech/invoice-view/${doc.id}`)}>
              Review with customer →
            </button>
          ) : (<>
            <a className="logout-button" href={`/view-invoice/${doc.id}`} target="_blank" rel="noreferrer">View customer copy ↗</a>
            <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy || !lines.length} onClick={() => send('email')}>Email to customer</button>
            <button className="auth-button" style={{ width: 'auto', margin: 0, background: '#0E7C66' }} disabled={busy || !lines.length} onClick={() => send('sms')}>Text to customer</button>
            {isEstimate && !locked && <button className="auth-button" style={{ width: 'auto', margin: 0, background: '#1F7A43' }} disabled={busy || !lines.length} onClick={approveAndInvoice}>Approved → start invoice</button>}
          </>)}
        </div>
      </div>
    </div>
  )
}
