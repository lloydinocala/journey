// Financing Central → Opportunities: open estimates and upcoming jobs where financing could
// help — anything not yet paid or financed whose amount fits at least one of your lenders'
// min/max (and the lender takes that kind of work: service vs system replacement).
// "Send application" texts/emails the lender's apply link and starts tracking the deal.
// Financing is offered, never pushed: the message says plainly that it's optional.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const nice = (s) => (s ? new Date(String(s).slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

function fits(lender, amount, isSystem) {
  if (lender.min_amount != null && amount < Number(lender.min_amount)) return false
  if (lender.max_amount != null && amount > Number(lender.max_amount)) return false
  if (isSystem && lender.for_system === false) return false
  if (!isSystem && lender.for_service === false) return false
  return true
}

export default function FinancingOpportunities({ orgId, lenders, deals, companyPhone, onSent }) {
  const [rows, setRows] = useState(null)
  const [sending, setSending] = useState(null)   // the opportunity being sent

  useEffect(() => {
    if (!orgId) return
    let live = true
    ;(async () => {
      const since = new Date(Date.now() - 120 * 86400000).toISOString()
      const sel = 'id, invoice_number, kind, job_id, reference_job_id, bills_to_customer_id, job_total, balance, invoice_date, created_at, estimate_type, approval_status, financing_status, payment_method, paid_at, is_archived'
      const [{ data: ests }, { data: jobs }] = await Promise.all([
        supabase.from('invoices').select(sel).eq('org_id', orgId).eq('kind', 'estimate').is('deleted_at', null).gte('created_at', since),
        supabase.from('jobs').select('id, job_number, segment, job_date, status, customer_id').eq('org_id', orgId).is('deleted_at', null).gte('job_date', isoToday()).in('status', ['scheduled', 'unscheduled']),
      ])
      const jobIds = (jobs || []).map((j) => j.id)
      const { data: jobInvs } = jobIds.length
        ? await supabase.from('invoices').select(sel).eq('org_id', orgId).eq('kind', 'invoice').is('deleted_at', null).in('job_id', jobIds)
        : { data: [] }
      const jobBy = Object.fromEntries((jobs || []).map((j) => [j.id, j]))
      const open = (i) => !i.is_archived && !i.financing_status && !i.payment_method && !i.paid_at
      const list = [
        ...(ests || []).filter((e) => open(e) && (!e.approval_status || e.approval_status === 'Pending') && Number(e.job_total) > 0)
          .map((e) => ({ inv: e, type: 'estimate', date: e.invoice_date || e.created_at, amount: Number(e.job_total), isSystem: e.estimate_type === 'system', jobId: e.job_id || e.reference_job_id })),
        ...(jobInvs || []).filter((i) => open(i) && Number(i.balance) > 0)
          .map((i) => ({ inv: i, type: 'job', job: jobBy[i.job_id], date: jobBy[i.job_id]?.job_date, amount: Number(i.balance), isSystem: false, jobId: i.job_id })),
      ]
      // Customer names.
      const custIds = [...new Set(list.map((r) => r.inv.bills_to_customer_id || r.job?.customer_id).filter(Boolean))]
      const { data: custs } = custIds.length ? await supabase.from('customers').select('id, display_name, primary_phone, email_1').in('id', custIds) : { data: [] }
      const custBy = Object.fromEntries((custs || []).map((c) => [c.id, c]))
      list.forEach((r) => { r.customer = custBy[r.inv.bills_to_customer_id || r.job?.customer_id] || null })
      list.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
      if (live) setRows(list)
    })()
    return () => { live = false }
  }, [orgId, deals.length])

  const tracked = useMemo(() => new Set(deals.filter((d) => d.status !== 'cancelled' && d.source_id).map((d) => d.source_id)), [deals])
  const shown = (rows || []).map((r) => ({ ...r, lenders: lenders.filter((l) => fits(l, r.amount, r.isSystem)) }))
    .filter((r) => r.lenders.length && !tracked.has(r.inv.id))

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ marginBottom: 4 }}>Opportunities <span className="badge">{rows ? shown.length : '…'}</span></h3>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 820 }}>
        Open estimates and upcoming jobs that fit at least one of your lenders. Offer financing where it genuinely helps the customer — the message says it's optional. Once sent, the deal moves into the pipeline below.
      </p>
      {!rows ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : !lenders.length ? null : !shown.length ? (
        <p style={{ color: 'var(--mist)', fontSize: 13.5 }}>No open estimates or upcoming jobs fit your lenders right now.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line, #E2E8F0)', borderRadius: 10 }}>
          <table className="data-table" style={{ margin: 0 }}>
            <thead><tr><th>Date</th><th>Customer</th><th>For</th><th style={{ textAlign: 'right' }}>Amount</th><th>Lenders that fit</th><th /></tr></thead>
            <tbody>
              {shown.map((r) => {
                const sendable = r.lenders.some((l) => l.apply_url)
                return (
                  <tr key={r.inv.id}>
                    <td>{nice(r.date)}</td>
                    <td>{r.customer ? <Link to={`/customers/${r.customer.id}`}>{r.customer.display_name}</Link> : '—'}</td>
                    <td>
                      {r.type === 'estimate'
                        ? <Link to={r.jobId ? `/estimate/${r.jobId}` : '/estimates'}>{r.isSystem ? 'System estimate' : 'Estimate'} {r.inv.invoice_number}</Link>
                        : <Link to={`/jobs?job=${r.jobId}`}>Job {r.job?.job_number}{r.job?.segment > 1 ? `-${r.job.segment}` : ''}</Link>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(r.amount)}</td>
                    <td style={{ fontSize: 12.5 }}>{r.lenders.map((l) => <span key={l.id} title={l.apply_url ? '' : 'No customer application link yet — add it in Configure lenders'} style={{ display: 'inline-block', margin: '1px 4px 1px 0', padding: '1px 7px', borderRadius: 999, background: l.apply_url ? '#E8F0FB' : '#EEF1F6', color: l.apply_url ? '#1D4ED8' : '#94A3B8' }}>{l.name}</span>)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {sendable
                        ? <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '5px 12px', fontSize: 12.5 }} onClick={() => setSending(r)}>Send application</button>
                        : <Link to="/financing-options" style={{ fontSize: 12 }}>Add apply link</Link>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {sending && <SendDialog opp={sending} companyPhone={companyPhone} onClose={() => setSending(null)} onSent={() => { setSending(null); onSent && onSent() }} />}
    </div>
  )
}

function SendDialog({ opp, companyPhone, onClose, onSent }) {
  const options = opp.lenders.filter((l) => l.apply_url)
  const [lenderId, setLenderId] = useState(options[0]?.id || '')
  const hasPhone = !!opp.customer?.primary_phone, hasEmail = !!opp.customer?.email_1
  const [sms, setSms] = useState(hasPhone)
  const [email, setEmail] = useState(hasEmail)
  const lender = options.find((l) => l.id === lenderId)
  const first = (opp.customer?.display_name || '').split(/[\s,]+/)[0] || 'there'
  const draft = (l) => `Hi ${first}, here's the link to apply for financing with ${l?.name || 'our lender'} for your ${opp.type === 'estimate' ? 'estimate' : 'invoice'} of ${money(opp.amount)}. It's completely optional — apply only if it helps. Questions? Call us at ${companyPhone || 'our office'}.`
  const [message, setMessage] = useState(draft(lender))
  const [edited, setEdited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (!edited) setMessage(draft(lender)) }, [lenderId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    setBusy(true); setErr('')
    const channels = [sms && 'sms', email && 'email'].filter(Boolean)
    const { data, error } = await supabase.functions.invoke('financing-send-application', { body: { sourceId: opp.inv.id, lenderOptionId: lenderId, channels, message } })
    setBusy(false)
    let msg = data?.error
    if (!msg && error?.context?.json) { try { msg = (await error.context.json()).error } catch (e) { /* ignore */ } }
    if (msg || error) { setErr(msg || error.message); return }
    const failed = Object.entries(data?.results || {}).filter(([, r]) => !r.ok)
    if (failed.length) window.alert(`Sent by ${data.sent.join(' and ')}. Not sent by ${failed.map(([k, r]) => `${k === 'sms' ? 'text' : 'email'} (${r.error})`).join(', ')}.`)
    onSent()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3 style={{ marginTop: 0 }}>Send financing application</h3>
        <div style={{ fontSize: 13.5, color: 'var(--mist)', marginTop: -6, marginBottom: 12 }}>{opp.customer?.display_name} · {money(opp.amount)}</div>
        <div className="field"><label>Lender</label>
          <select value={lenderId} onChange={(e) => setLenderId(e.target.value)}>
            {options.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Message</label>
          <textarea rows={4} value={message} onChange={(e) => { setMessage(e.target.value); setEdited(true) }} style={{ width: '100%' }} />
          <span style={{ fontSize: 12, color: 'var(--mist)' }}>The application link is added automatically.</span>
        </div>
        <div style={{ display: 'flex', gap: 18, fontSize: 13.5, margin: '6px 0 4px' }}>
          <label style={{ opacity: hasPhone ? 1 : 0.5 }}><input type="checkbox" checked={sms} disabled={!hasPhone} onChange={(e) => setSms(e.target.checked)} /> Text {hasPhone ? opp.customer.primary_phone : '(no phone)'}</label>
          <label style={{ opacity: hasEmail ? 1 : 0.5 }}><input type="checkbox" checked={email} disabled={!hasEmail} onChange={(e) => setEmail(e.target.checked)} /> Email {hasEmail ? opp.customer.email_1 : '(no email)'}</label>
        </div>
        {err && <div className="auth-error" style={{ marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="logout-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={send} disabled={busy || !lenderId || (!sms && !email) || !message.trim()}>{busy ? 'Sending…' : 'Send'}</button>
        </div>
      </div>
    </div>
  )
}
