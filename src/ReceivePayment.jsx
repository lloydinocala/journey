import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

const money = (v) => '$' + (Number(v) || 0).toFixed(2)
const today = () => new Date().toISOString().slice(0, 10)
const METHODS = ['Check', 'Cash', 'Card', 'ACH / Bank transfer', 'Other']

// Receive one payment (e.g. a single check) and apply it across a customer's
// open invoices — records a payment_batch header + one invoice_payment per invoice.
export default function ReceivePayment({ profile, orgId, customerId = '', customerName = '', onClose, onRecorded }) {
  const [customers, setCustomers] = useState([])
  const [custQuery, setCustQuery] = useState('')
  const [cust, setCust] = useState(customerId ? { id: customerId, display_name: customerName } : null)
  const [invoices, setInvoices] = useState([])
  const [alloc, setAlloc] = useState({})      // invoiceId -> amount string
  const [checked, setChecked] = useState({})  // invoiceId -> bool
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Check')
  const [checkNumber, setCheckNumber] = useState('')
  const [receivedAt, setReceivedAt] = useState(today())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!cust && orgId) supabase.from('customers').select('id, display_name').eq('org_id', orgId).eq('is_active', true).order('display_name').then(({ data }) => setCustomers(data || []))
  }, [orgId, cust])

  useEffect(() => {
    if (!cust?.id) return
    supabase.from('invoices')
      .select('id, invoice_number, invoice_date, balance, property_id, properties(street_address, city)')
      .eq('org_id', orgId).eq('bills_to_customer_id', cust.id).eq('kind', 'invoice')
      .is('deleted_at', null).eq('is_archived', false)
      .order('invoice_date', { ascending: true })
      .then(({ data }) => {
        const open = (data || []).filter((i) => Number(i.balance || 0) > 0.005)
        setInvoices(open)
        const a = {}, c = {}
        open.forEach((i) => { a[i.id] = Number(i.balance).toFixed(2); c[i.id] = true })
        setAlloc(a); setChecked(c)
        setAmount(open.reduce((s, i) => s + Number(i.balance || 0), 0).toFixed(2))
      })
  }, [cust?.id, orgId])

  const applied = invoices.reduce((s, i) => s + (checked[i.id] ? Number(alloc[i.id] || 0) : 0), 0)
  const remaining = (Number(amount) || 0) - applied

  async function submit() {
    setErr('')
    const total = Number(amount) || 0
    const lines = invoices.filter((i) => checked[i.id] && Number(alloc[i.id] || 0) > 0)
      .map((i) => ({ invoice_id: i.id, amount: Number(alloc[i.id]) }))
    if (!lines.length) { setErr('Select at least one invoice to apply the payment to.'); return }
    if (total <= 0) { setErr('Enter the payment amount.'); return }
    const app = lines.reduce((s, l) => s + l.amount, 0)
    if (app > total + 0.005) { setErr(`Applied (${money(app)}) exceeds the payment amount (${money(total)}).`); return }
    for (const i of invoices) {
      if (checked[i.id] && Number(alloc[i.id] || 0) > Number(i.balance) + 0.005) { setErr(`${i.invoice_number}: applied amount exceeds its balance.`); return }
    }
    setSaving(true)
    const { data: batch, error: bErr } = await supabase.from('payment_batches').insert({
      org_id: orgId, customer_id: cust.id, total_amount: total, applied_amount: app,
      unapplied_amount: Math.max(0, total - app), method, check_number: method === 'Check' ? (checkNumber || null) : null,
      notes: notes || null, received_at: receivedAt, recorded_by: profile?.user_id || null,
    }).select().single()
    if (bErr) { setSaving(false); setErr(bErr.message || 'Could not save the payment.'); return }
    const { error: pErr } = await supabase.from('invoice_payments').insert(lines.map((l) => ({
      org_id: orgId, invoice_id: l.invoice_id, amount: l.amount, method,
      check_number: method === 'Check' ? (checkNumber || null) : null, notes: notes || null,
      batch_id: batch.id, recorded_by: profile?.user_id || null,
    })))
    setSaving(false)
    if (pErr) { setErr(pErr.message || 'Payment saved but allocations failed.'); return }
    onRecorded && onRecorded()
    onClose && onClose()
  }

  const filteredCust = custQuery ? customers.filter((c) => (c.display_name || '').toLowerCase().includes(custQuery.toLowerCase())) : customers

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 4000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface,#fff)', borderRadius: 14, width: '100%', maxWidth: 640, boxShadow: '0 24px 60px rgba(0,0,0,.35)', margin: '20px 0' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0 }}>Receive Payment</h3>
          <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 3 }}>One payment, applied across a customer’s open invoices. Posts to the ledger and settles each balance.</div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* Customer */}
          {!cust ? (
            <div className="field">
              <label>Customer</label>
              <input value={custQuery} onChange={(e) => setCustQuery(e.target.value)} placeholder="Search customers…" autoFocus />
              {custQuery && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                  {filteredCust.slice(0, 30).map((c) => (
                    <div key={c.id} onClick={() => { setCust(c); setCustQuery('') }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>{c.display_name}</div>
                  ))}
                  {filteredCust.length === 0 && <div style={{ padding: '8px 12px', color: 'var(--mist)' }}>No matches</div>}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div><span style={{ fontSize: 12, color: 'var(--mist)' }}>Customer</span><div style={{ fontWeight: 700 }}>{cust.display_name}</div></div>
              {!customerId && <button className="logout-button" style={{ fontSize: 12 }} onClick={() => { setCust(null); setInvoices([]) }}>Change</button>}
            </div>
          )}

          {cust && (
            <>
              {/* Payment details */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <div className="field" style={{ marginBottom: 0, width: 130 }}>
                  <label>Amount</label>
                  <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 0, minWidth: 150 }}>
                  <label>Method</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
                </div>
                {method === 'Check' && (
                  <div className="field" style={{ marginBottom: 0, width: 120 }}>
                    <label>Check #</label>
                    <input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
                  </div>
                )}
                <div className="field" style={{ marginBottom: 0, width: 150 }}>
                  <label>Received</label>
                  <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
                </div>
              </div>
              <div className="field"><label>Notes (optional)</label><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reference, memo…" /></div>

              {/* Open invoices / allocation */}
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mist)', margin: '10px 0 6px' }}>Apply to invoices</div>
              {invoices.length === 0 ? (
                <p style={{ color: 'var(--mist)', fontSize: 14 }}>No open invoices for this customer.</p>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {invoices.map((i) => (
                    <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                      <input type="checkbox" checked={!!checked[i.id]} onChange={(e) => setChecked((c) => ({ ...c, [i.id]: e.target.checked }))} style={{ width: 17, height: 17 }} />
                      <div style={{ flex: 1, fontSize: 13.5 }}>
                        <strong>{i.invoice_number}</strong>
                        <span style={{ color: 'var(--mist)' }}> · {i.properties?.street_address || ''}{i.properties?.city ? ', ' + i.properties.city : ''}</span>
                        <div style={{ fontSize: 12, color: 'var(--mist)' }}>Balance {money(i.balance)}</div>
                      </div>
                      <input type="number" step="0.01" value={alloc[i.id] || ''} disabled={!checked[i.id]}
                        onChange={(e) => setAlloc((a) => ({ ...a, [i.id]: e.target.value }))}
                        style={{ width: 100, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, textAlign: 'right' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 14 }}>
                <span style={{ color: 'var(--mist)' }}>Payment {money(amount)} · Applied {money(applied)}</span>
                <span style={{ fontWeight: 700, color: remaining < -0.005 ? '#C0392B' : remaining > 0.005 ? '#C8811B' : '#1a7f37' }}>
                  {remaining < -0.005 ? `Over by ${money(-remaining)}` : remaining > 0.005 ? `${money(remaining)} unapplied credit` : 'Fully applied'}
                </span>
              </div>
              {err && <div style={{ color: '#C0392B', fontSize: 13, marginTop: 8 }}>{err}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button className="logout-button" onClick={onClose}>Cancel</button>
                <button className="auth-button" style={{ width: 'auto' }} disabled={saving} onClick={submit}>{saving ? 'Recording…' : 'Record payment'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
