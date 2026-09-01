import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const money = (n) => `$${Number(n || 0).toFixed(2)}`
const date = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''

export default function CustomerRecords({ customer }) {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const initial = sp.get('tab') === 'estimates' ? 'estimates' : sp.get('tab') === 'pay' ? 'invoices' : 'history'
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
        .is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('invoices')
        .select('id, invoice_number, kind, approval_status, job_total, amount_due, total_paid, invoice_date, paid_at, created_at')
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

  const estimates = invoices.filter(i => i.kind === 'estimate')
  const bills = invoices.filter(i => i.kind !== 'estimate')

  const TABS = [
    ['history', 'Service history'],
    ['invoices', 'Invoices'],
    ['estimates', 'Estimates'],
  ]

  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">My records</h2>
      <p className="cp-lead">Everything we have on file for your home.</p>

      <div className="cp-tabs">
        {TABS.map(([k, l]) => (
          <button key={k} className={`cp-tab ${tab === k ? 'on' : ''}`} onClick={() => { setTab(k); setMsg('') }}>{l}</button>
        ))}
      </div>

      {msg && <div className="cp-err" style={{ background: '#EAF6F8', color: '#0B3041' }}>{msg}</div>}
      {loading ? <div className="cp-empty">Loading…</div> : (
        <div className="cp-card">
          {tab === 'history' && (jobs.length ? jobs.map(j => (
            <div className="cp-row" key={j.id}>
              <div className="cp-main">
                <b>{j.job_type || 'Service'} · #{j.job_number}</b>
                <span>{date(j.job_date || j.created_at)}{j.service_complaint ? ` — ${j.service_complaint}` : ''}</span>
              </div>
              <span className={`cp-pill ${j.completed_at ? 'ok' : 'pend'}`}>{j.completed_at ? 'Done' : (j.status || 'Open')}</span>
            </div>
          )) : <div className="cp-empty">No service history yet.</div>)}

          {tab === 'invoices' && (bills.length ? bills.map(i => {
            const due = Number(i.amount_due) > 0
            return (
              <div className="cp-row" key={i.id}>
                <div className="cp-main">
                  <b>Invoice #{i.invoice_number}</b>
                  <span>{date(i.invoice_date || i.created_at)} · {money(i.job_total)}</span>
                </div>
                {due ? (
                  <button className="cp-btn pay sm" disabled={busyId === i.id} onClick={() => payInvoice(i.id)}>
                    {busyId === i.id ? '…' : `Pay ${money(i.amount_due)}`}
                  </button>
                ) : <span className="cp-pill paid">Paid</span>}
              </div>
            )
          }) : <div className="cp-empty">No invoices.</div>)}

          {tab === 'estimates' && (estimates.length ? estimates.map(e => {
            const st = (e.approval_status || '').toLowerCase()
            return (
              <div key={e.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="cp-row" style={{ borderBottom: 0, padding: 0 }}>
                  <div className="cp-main">
                    <b>Estimate #{e.invoice_number}</b>
                    <span>{date(e.invoice_date || e.created_at)} · {money(e.job_total)}</span>
                  </div>
                  <span className={`cp-pill ${st === 'approved' ? 'ok' : st === 'declined' ? 'due' : 'pend'}`}>
                    {st ? st[0].toUpperCase() + st.slice(1) : 'Pending'}
                  </span>
                </div>
                <div className="cp-btnrow" style={{ marginTop: 10 }}>
                  <a className="cp-btn ghost sm" href={`/view-invoice/${e.id}`} style={{ textDecoration: 'none' }}>View details</a>
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
