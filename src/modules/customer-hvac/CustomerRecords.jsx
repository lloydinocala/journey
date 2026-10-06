import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const money = (n) => `$${Number(n || 0).toFixed(2)}`
const date = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''

// My records — three tabs:
//   Appointments: upcoming + not-yet-completed visits (read-only; no job detail page).
//   Invoices:     every invoice except estimates — clickable to view and downloadable.
//   Estimates:    view / download, plus approve or decline while pending.
// Invoices and estimates open the shared document view (/view-invoice/:id); the Download
// link opens it in print mode so the customer can save a PDF to their phone or desktop.
export default function CustomerRecords({ customer }) {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const initial = sp.get('tab') === 'appointments' ? 'appointments' : sp.get('tab') === 'estimates' ? 'estimates' : 'invoices'
  const [tab, setTab] = useState(initial)
  const [jobs, setJobs] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState('')

  async function loadAll() {
    setLoading(true)
    const [jRes, iRes] = await Promise.all([
      supabase.from('jobs')
        .select('id, job_number, status, job_type, service_complaint, job_date, completed_at, created_at')
        .is('deleted_at', null).order('job_date', { ascending: true }),
      supabase.from('invoices')
        .select('id, invoice_number, kind, estimate_type, approval_status, job_total, amount_due, total_paid, invoice_date, paid_at, created_at')
        .is('deleted_at', null).eq('is_archived', false).order('created_at', { ascending: false }),
    ])
    setJobs(jRes.data || []); setInvoices(iRes.data || [])
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [customer.id])

  async function payInvoice(id) {
    setBusyId(id); setMsg('')
    try {
      const { data, error } = await supabase.functions.invoke('create-invoice-checkout', { body: { invoiceId: id } })
      if (data?.url) { window.location.href = data.url; return }
      let m = data?.error || ''
      if (!m && error?.context?.json) { try { m = (await error.context.json())?.error } catch (_) {} }
      setMsg(m || 'We couldn’t start the payment just now. Please try again or give us a call.')
    } catch (_) {
      setMsg('We couldn’t start the payment just now. Please try again or give us a call.')
    } finally { setBusyId(null) }
  }

  async function decide(id, decision) {
    setBusyId(id); setMsg('')
    const { error } = await supabase.rpc('record_customer_estimate_decision', { p_estimate_id: id, p_decision: decision })
    setBusyId(null)
    if (error) setMsg(error.message)
    else { setMsg(decision === 'approved' ? 'Approved — thank you! We’ll be in touch to schedule.' : 'Estimate declined.'); loadAll() }
  }

  // Estimates: show pending ones (service or system). Hide approved/declined JOB (service)
  // estimates — the customer gets the invoice for those — but keep approved NEW SYSTEM
  // estimates visible, since the customer may want to refer back to a system they approved.
  const estimates = invoices.filter(i => {
    if (i.kind !== 'estimate') return false
    const st = (i.approval_status || '').toLowerCase()
    if (st === '' || st === 'pending') return true
    if (st === 'approved' && i.estimate_type === 'system') return true
    return false
  })
  // Invoices of every kind EXCEPT estimates.
  const bills = invoices.filter(i => i.kind !== 'estimate')
  // Upcoming + not-yet-completed appointments (open work), soonest first.
  const openJobs = jobs.filter(j => !j.completed_at && j.status !== 'completed' && j.status !== 'cancelled' && j.status !== 'canceled')

  const statusWord = (j) => {
    const s = (j.status || '').replace(/_/g, ' ')
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Scheduled'
  }

  const TABS = [
    ['appointments', 'Appointments'],
    ['invoices', 'Invoices'],
    ['estimates', 'Estimates'],
  ]

  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">My records</h2>
      <p className="cp-lead">Your upcoming visits, invoices, and estimates — view or download any document.</p>

      <div className="cp-tabs">
        {TABS.map(([k, l]) => (
          <button key={k} className={`cp-tab ${tab === k ? 'on' : ''}`} onClick={() => { setTab(k); setMsg('') }}>{l}</button>
        ))}
      </div>

      {msg && <div className="cp-err" style={{ background: '#EAF6F8', color: '#0B3041' }}>{msg}</div>}
      {loading ? <div className="cp-empty">Loading…</div> : (
        <div className="cp-card">
          {tab === 'appointments' && (openJobs.length ? openJobs.map(j => (
            <div className="cp-row" key={j.id}>
              <div className="cp-main">
                <b>{j.job_type || 'Service'} · #{j.job_number}</b>
                <span>{j.job_date ? date(j.job_date) : 'Not yet scheduled'}{j.service_complaint ? ` — ${j.service_complaint}` : ''}</span>
              </div>
              <span className="cp-pill pend">{statusWord(j)}</span>
            </div>
          )) : <div className="cp-empty">No upcoming or open appointments.</div>)}

          {tab === 'invoices' && (bills.length ? bills.map(i => {
            const due = Number(i.amount_due) > 0
            return (
              <div key={i.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="cp-row" style={{ borderBottom: 0, padding: 0 }}>
                  <div className="cp-main">
                    <b>Invoice #{i.invoice_number}</b>
                    <span>{date(i.invoice_date || i.created_at)} · {money(i.job_total)}</span>
                  </div>
                  {due ? <span className="cp-pill due">Due {money(i.amount_due)}</span> : <span className="cp-pill paid">Paid</span>}
                </div>
                <div className="cp-btnrow" style={{ marginTop: 10 }}>
                  <a className="cp-btn ghost sm" href={`/view-invoice/${i.id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>View invoice</a>
                  <a className="cp-btn ghost sm" href={`/view-invoice/${i.id}?print=1`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>Download</a>
                  {due && <button className="cp-btn pay sm" disabled={busyId === i.id} onClick={() => payInvoice(i.id)}>{busyId === i.id ? '…' : `Pay ${money(i.amount_due)}`}</button>}
                </div>
              </div>
            )
          }) : <div className="cp-empty">No invoices.</div>)}

          {tab === 'estimates' && (estimates.length ? estimates.map(e => {
            const st = (e.approval_status || '').toLowerCase()
            return (
              <div key={e.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="cp-row" style={{ borderBottom: 0, padding: 0 }}>
                  <div className="cp-main">
                    <b>{e.estimate_type === 'system' ? 'System Estimate' : 'Estimate'} #{e.invoice_number}</b>
                    <span>{date(e.invoice_date || e.created_at)} · {money(e.job_total)}</span>
                  </div>
                  <span className={`cp-pill ${st === 'approved' ? 'ok' : st === 'declined' ? 'due' : 'pend'}`}>
                    {st ? st[0].toUpperCase() + st.slice(1) : 'Pending'}
                  </span>
                </div>
                <div className="cp-btnrow" style={{ marginTop: 10 }}>
                  <a className="cp-btn ghost sm" href={`/view-invoice/${e.id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>View details</a>
                  <a className="cp-btn ghost sm" href={`/view-invoice/${e.id}?print=1`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>Download</a>
                  {st !== 'approved' && st !== 'declined' && (
                    <>
                      <button className="cp-btn pay sm" disabled={busyId === e.id} onClick={() => decide(e.id, 'approved')}>Approve</button>
                      <button className="cp-btn ghost sm" disabled={busyId === e.id} onClick={() => decide(e.id, 'declined')}>Decline</button>
                    </>
                  )}
                </div>
              </div>
            )
          }) : <div className="cp-empty">No estimates.</div>)}
        </div>
      )}
    </div>
  )
}
