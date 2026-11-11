import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldShell from './FieldShell'
import { supabase } from '../utils/supabase'
import { listPaymentsToConfirm, confirmPaymentMethod, markInvoicePaid, methodLabel } from '../utils/payments'
import { usd, daysSince, shortDay, callFn, sendDoc } from './fieldUtil'

// MONEY — who owes you, what came in this week, payments waiting on you, and Stripe deposits.
const TABS = [['owed', 'Owed'], ['paid', 'Paid'], ['confirm', 'To Confirm'], ['payouts', 'Deposits']]
const PAY_METHODS = [['cash', 'Cash'], ['check', 'Check'], ['card', 'Card']]

async function withNames(rows) {
  const ids = [...new Set(rows.map((r) => r.bills_to_customer_id).filter(Boolean))]
  if (!ids.length) return rows
  const { data } = await supabase.from('customers').select('id, display_name').in('id', ids)
  const m = Object.fromEntries((data || []).map((c) => [c.id, c.display_name]))
  return rows.map((r) => ({ ...r, customer_name: r.customer_name || m[r.bills_to_customer_id] || '' }))
}

export default function FieldMoney({ profile }) {
  const navigate = useNavigate()
  const orgId = profile?.org_id
  const [tab, setTab] = useState('owed')
  const [owed, setOwed] = useState(null)
  const [paid, setPaid] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [payouts, setPayouts] = useState(null)
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)

  async function loadOwed() {
    const { data } = await supabase.from('invoices')
      .select('id, invoice_number, job_id, bills_to_customer_id, invoice_date, sent_at, sent_count, balance, amount_due, payment_method')
      .eq('org_id', orgId).eq('kind', 'invoice').is('deleted_at', null).is('paid_at', null).not('sent_at', 'is', null)
      .order('sent_at', { ascending: true }).limit(300)
    setOwed(await withNames((data || []).filter((r) => Number(r.balance ?? r.amount_due) > 0.004)))
  }
  async function loadPaid() {
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data } = await supabase.from('invoice_payments').select('id, amount, method, recorded_at, invoice_id, invoices ( invoice_number, bills_to_customer_id )')
      .eq('org_id', orgId).gte('recorded_at', since).order('recorded_at', { ascending: false })
    const rows = (data || []).map((p) => ({ ...p, invoice_number: p.invoices?.invoice_number, bills_to_customer_id: p.invoices?.bills_to_customer_id }))
    setPaid(await withNames(rows))
  }
  async function loadConfirm() { setConfirm(await listPaymentsToConfirm(orgId)) }
  async function loadPayouts() {
    const { data: o } = await supabase.from('organizations').select('stripe_charges_enabled').eq('id', orgId).maybeSingle()
    if (!o?.stripe_charges_enabled) { setPayouts({ off: true }); return }
    const { data, error } = await callFn('stripe-payouts', { action: 'summary', orgId })
    setPayouts(error ? { err: error } : data)
  }
  useEffect(() => {
    if (!orgId) return
    loadOwed(); loadPaid(); loadConfirm(); loadPayouts()
  }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function remind(inv, channel) {
    setBusy(inv.id + channel); setMsg(null)
    const r = await sendDoc(inv.id, channel)
    setBusy(''); setMsg({ id: inv.id, ...r })
    if (r.ok) loadOwed()
  }
  async function markPaid(inv, method) {
    setBusy(inv.id + 'paid'); setMsg(null)
    const { error } = await markInvoicePaid(orgId, { ...inv, payment_method: method || inv.payment_method }, profile?.id)
    setBusy('')
    if (error) { setMsg({ id: inv.id, ok: false, t: error.message }); return }
    setMsg({ id: inv.id, ok: true, t: 'Recorded as paid.' }); setOpen(null)
    loadOwed(); loadPaid(); loadConfirm()
  }
  async function confirmIt(inv) {
    setBusy(inv.id + 'confirm')
    await confirmPaymentMethod(orgId, inv.id)
    setBusy(''); loadConfirm()
  }

  const owedTotal = (owed || []).reduce((a, r) => a + Number(r.balance ?? r.amount_due ?? 0), 0)
  const paidTotal = (paid || []).reduce((a, r) => a + Number(r.amount || 0), 0)
  const counts = { owed: owed?.length, paid: paid?.length, confirm: confirm?.length }

  return (
    <FieldShell profile={profile} title="Money" onBack={() => navigate('/tech/field')}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div className="fa-info" style={{ textAlign: 'center' }}><div className="fa-muted" style={{ fontSize: 12.5 }}>Owed to you</div><div style={{ fontWeight: 900, fontSize: 21 }}>{owed ? usd(owedTotal) : '…'}</div></div>
        <div className="fa-info" style={{ textAlign: 'center' }}><div className="fa-muted" style={{ fontSize: 12.5 }}>Paid last 7 days</div><div style={{ fontWeight: 900, fontSize: 21, color: '#1B7A3D' }}>{paid ? usd(paidTotal) : '…'}</div></div>
      </div>
      <div className="fa-seg">
        {TABS.map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setOpen(null); setMsg(null) }}>{l}{counts[k] ? ` (${counts[k]})` : ''}</button>)}
      </div>
      <div className="fa-panel">
        {tab === 'owed' && (!owed ? <p className="fa-empty">Loading…</p> : !owed.length ? <p className="fa-empty">Nobody owes you right now.</p> : owed.map((inv) => {
          const age = daysSince(inv.sent_at)
          return (
            <div key={inv.id} className="fa-info" onClick={() => setOpen(open === inv.id ? null : inv.id)} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5 }}>{inv.customer_name || 'Customer'}</div>
                  <div className="fa-muted" style={{ fontSize: 12.5 }}>#{inv.invoice_number} · sent {shortDay(inv.sent_at)}{inv.sent_count > 1 ? ` · ${inv.sent_count}×` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900 }}>{usd(inv.balance ?? inv.amount_due)}</div>
                  <span className={`fa-chip ${age > 30 ? 'red' : ''}`} style={{ margin: 0 }}>{age === 0 ? 'today' : `${age} day${age === 1 ? '' : 's'}`}</span>
                </div>
              </div>
              {open === inv.id && (
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className="fa-small-btn" disabled={!!busy} onClick={() => remind(inv, 'email')}>{busy === inv.id + 'email' ? 'Sending…' : 'Email reminder'}</button>
                    <button type="button" className="fa-small-btn" disabled={!!busy} onClick={() => remind(inv, 'sms')}>{busy === inv.id + 'sms' ? 'Sending…' : 'Text reminder'}</button>
                  </div>
                  <div className="fa-muted" style={{ fontSize: 12.5, marginTop: 4 }}>Got paid in person? Record it:</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {PAY_METHODS.map(([k, l]) => <button key={k} type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)' }} disabled={!!busy} onClick={() => markPaid(inv, k)}>Paid — {l}</button>)}
                  </div>
                  {inv.job_id && <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)' }} onClick={() => navigate(`/tech/field/job/${inv.job_id}`)}>Open the job</button>}
                </div>
              )}
              {msg?.id === inv.id && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`} style={{ marginTop: 8 }}>{msg.t}</div>}
            </div>
          )
        }))}

        {tab === 'paid' && (!paid ? <p className="fa-empty">Loading…</p> : !paid.length ? <p className="fa-empty">No payments in the last 7 days.</p> : paid.map((p) => (
          <div key={p.id} className="fa-info" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800 }}>{p.customer_name || 'Customer'}</div>
              <div className="fa-muted" style={{ fontSize: 12.5 }}>#{p.invoice_number || '—'} · {p.method || '—'} · {shortDay(p.recorded_at)}</div>
            </div>
            <div style={{ fontWeight: 900, color: '#1B7A3D' }}>{usd(p.amount)}</div>
          </div>
        )))}

        {tab === 'confirm' && (!confirm ? <p className="fa-empty">Loading…</p> : !confirm.length ? <p className="fa-empty">Nothing waiting on you.</p> : confirm.map((inv) => (
          <div key={inv.id} className="fa-info">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{inv.customer_name || 'Customer'}</div>
                <div className="fa-muted" style={{ fontSize: 12.5 }}>{inv.kind === 'estimate' ? 'Estimate' : 'Invoice'} #{inv.invoice_number} · {inv.payment_method ? `will pay by ${methodLabel(inv.payment_method)}` : 'no method chosen'}{inv.financing_status ? ` · financing ${inv.financing_status}` : ''}</div>
              </div>
              <div style={{ fontWeight: 900 }}>{usd(inv.balance ?? inv.amount_due)}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {!inv.payment_confirmed_at && <button type="button" className="fa-small-btn" disabled={!!busy} onClick={() => confirmIt(inv)}>{busy === inv.id + 'confirm' ? 'Saving…' : 'Confirm method'}</button>}
              {inv.kind === 'invoice' && <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)' }} disabled={!!busy} onClick={() => markPaid(inv)}>{busy === inv.id + 'paid' ? 'Saving…' : 'Mark paid'}</button>}
            </div>
            {msg?.id === inv.id && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`} style={{ marginTop: 8 }}>{msg.t}</div>}
          </div>
        )))}

        {tab === 'payouts' && (!payouts ? <p className="fa-empty">Loading…</p>
          : payouts.off ? <p className="fa-empty">Card payments aren&apos;t set up yet. Admin → Setup Checklist → Payments.</p>
          : payouts.err ? <div className="fa-msg err">{payouts.err}</div>
          : (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="fa-info" style={{ textAlign: 'center' }}><div className="fa-muted" style={{ fontSize: 12.5 }}>Clearing</div><div style={{ fontWeight: 900, fontSize: 18 }}>{usd(payouts.balance?.pending)}</div></div>
              <div className="fa-info" style={{ textAlign: 'center' }}><div className="fa-muted" style={{ fontSize: 12.5 }}>Ready for next deposit</div><div style={{ fontWeight: 900, fontSize: 18 }}>{usd(payouts.balance?.available)}</div></div>
            </div>
            <div className="fa-section-label" style={{ marginTop: 6 }}>Deposits to your bank</div>
            {!(payouts.payouts || []).length ? <p className="fa-empty">No deposits yet.</p> : (payouts.payouts || []).slice(0, 12).map((p) => (
              <div key={p.id} className="fa-info" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div><div style={{ fontWeight: 700 }}>{p.arrival_date ? new Date(p.arrival_date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</div>
                  <div className="fa-muted" style={{ fontSize: 12.5 }}>{{ paid: 'Deposited', in_transit: 'On the way', pending: 'Scheduled', failed: 'Failed' }[p.status] || p.status}</div></div>
                <div style={{ fontWeight: 900 }}>{usd(p.amount)}</div>
              </div>
            ))}
          </>))}
      </div>
    </FieldShell>
  )
}
