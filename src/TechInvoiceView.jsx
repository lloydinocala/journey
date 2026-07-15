import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import InvoiceDocument from './InvoiceDocument'
import { IconChevronLeft } from './MobileIcons'

export default function TechInvoiceView({ profile }) {
  const { invoiceId } = useParams()
  const navigate = useNavigate()

  const [docData, setDocData] = useState(null)
  const [invoiceRow, setInvoiceRow] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendError, setSendError] = useState('')
  const [copyLabel, setCopyLabel] = useState('Copy Link')

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [checkNumber, setCheckNumber] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')

    const [docRes, rowRes, paymentsRes] = await Promise.all([
      supabase.functions.invoke('get-public-invoice', { body: { invoiceId } }),
      supabase
        .from('invoices')
        .select('id, org_id, kind, job_total, amount_due, total_paid, paid_at, sent_at')
        .eq('id', invoiceId)
        .single(),
      supabase
        .from('invoice_payments')
        .select('id, amount, method, check_number, notes, recorded_at')
        .eq('invoice_id', invoiceId)
        .order('recorded_at', { ascending: false }),
    ])

    if (docRes.error || docRes.data?.error) {
      setError(docRes.data?.error || 'Could not load this invoice.')
      setLoading(false)
      return
    }

    setDocData(docRes.data)
    setInvoiceRow(rowRes.data)
    setPayments(paymentsRes.data || [])

    const balance = (rowRes.data?.job_total || 0) - (rowRes.data?.total_paid || 0)
    setPaymentAmount(balance > 0 ? balance.toFixed(2) : '')

    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [invoiceId])

  async function handleSendEmail() {
    setSendingEmail(true)
    setSendError('')
    const { data, error } = await supabase.functions.invoke('send-invoice-email', { body: { invoiceId } })
    setSendingEmail(false)
    if (error) {
      let detail = error.message
      if (error.context) {
        try {
          const body = await error.context.json()
          if (body?.error) detail = body.error
        } catch {}
      }
      setSendError(detail)
    } else if (data?.error) {
      setSendError(data.error)
    } else {
      loadAll()
    }
  }

  function payLinkUrl() {
    return `${window.location.origin}/view-invoice/${invoiceId}`
  }

  function copyPayLink() {
    navigator.clipboard.writeText(payLinkUrl())
    setCopyLabel('Copied!')
    setTimeout(() => setCopyLabel('Copy Link'), 1500)
  }

  async function handleRecordPayment(e) {
    e.preventDefault()
    setPaymentError('')
    const amt = parseFloat(paymentAmount)
    if (!amt || amt <= 0) {
      setPaymentError('Enter an amount.')
      return
    }
    if (paymentMethod === 'check' && !checkNumber.trim()) {
      setPaymentError('Enter a check number.')
      return
    }

    setRecordingPayment(true)
    const { data: userData } = await supabase.auth.getUser()

    const { error: insertError } = await supabase.from('invoice_payments').insert({
      org_id: invoiceRow.org_id,
      invoice_id: invoiceId,
      amount: amt,
      method: paymentMethod,
      check_number: paymentMethod === 'check' ? checkNumber.trim() : null,
      notes: paymentNotes.trim() || null,
      recorded_by: userData?.user?.id || null,
    })

    if (insertError) {
      setPaymentError(insertError.message)
      setRecordingPayment(false)
      return
    }

    const newTotalPaid = (invoiceRow.total_paid || 0) + amt
    const patch = { total_paid: newTotalPaid }
    if (newTotalPaid >= invoiceRow.job_total) {
      patch.paid_at = new Date().toISOString()
    }
    await supabase.from('invoices').update(patch).eq('id', invoiceId)

    setRecordingPayment(false)
    setCheckNumber('')
    setPaymentNotes('')
    loadAll()
  }

  if (loading) {
    return (
      <div className="mobile-shell">
        <div className="mobile-header"><button className="mobile-back" onClick={() => navigate(-1)}><IconChevronLeft /></button></div>
        <div className="mobile-body"><p style={{ color: 'var(--mist)' }}>Loading…</p></div>
      </div>
    )
  }

  if (error || !docData) {
    return (
      <div className="mobile-shell">
        <div className="mobile-header"><button className="mobile-back" onClick={() => navigate(-1)}><IconChevronLeft /></button></div>
        <div className="mobile-body"><p style={{ color: '#C0392B' }}>{error || 'Invoice not found.'}</p></div>
      </div>
    )
  }

  const isEstimate = docData.invoice.kind === 'estimate'
  const balance = Math.max((invoiceRow?.job_total || 0) - (invoiceRow?.total_paid || 0), 0)

  return (
    <div className="mobile-shell">
      <div className="mobile-header job-detail-header">
        <button className="mobile-back" onClick={() => navigate(-1)}><IconChevronLeft /></button>
        <div className="job-detail-header-text">
          <div className="job-detail-title">{docData.invoice.invoice_number}</div>
          <div className="job-detail-sub">{docData.customer?.display_name}</div>
        </div>
        {!isEstimate && (
          <span className={`status-pill ${invoiceRow?.paid_at ? 'status-active' : 'status-trial'}`}>
            {invoiceRow?.paid_at ? 'Paid' : 'Unpaid'}
          </span>
        )}
      </div>

      <div className="mobile-body" style={{ background: 'transparent', padding: 0 }}>
        <div style={{ padding: 14 }}>
          <InvoiceDocument data={docData} footer={null} />
        </div>

        <div style={{ padding: '0 14px 14px' }}>
          {!isEstimate && (
            <div className="section-card">
              <div className="section-card-header"><span>Send &amp; Pay</span></div>
              <div className="section-card-body">
                <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 0 }}>No login required for the customer.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="action-btn primary" style={{ flex: '1 1 auto' }} onClick={handleSendEmail} disabled={sendingEmail}>
                    {sendingEmail ? 'Sending…' : invoiceRow?.sent_at ? 'Resend to Customer' : 'Send to Customer'}
                  </button>
                  <button className="action-btn" style={{ flex: '1 1 auto', background: '#2E7FC4' }} onClick={() => window.open(payLinkUrl(), '_blank')}>
                    Open Card Pay Link
                  </button>
                  <button className="action-btn" style={{ flex: '1 1 auto', background: '#F0F1F3', color: 'var(--paper)' }} onClick={copyPayLink}>
                    {copyLabel}
                  </button>
                </div>
                {invoiceRow?.sent_at && (
                  <p style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 8 }}>Last sent {new Date(invoiceRow.sent_at).toLocaleString()}</p>
                )}
                {sendError && <p style={{ color: '#C0392B', fontSize: 12.5, marginTop: 8 }}>{sendError}</p>}
              </div>
            </div>
          )}

          {!isEstimate && !invoiceRow?.paid_at && (
            <div className="section-card">
              <div className="section-card-header"><span>Record Cash / Check Payment</span></div>
              <div className="section-card-body">
                <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 0 }}>
                  For payment collected in person. Card payments through the pay link record themselves automatically.
                </p>
                <form onSubmit={handleRecordPayment}>
                  <div className="mobile-field-row">
                    <div className="mobile-field">
                      <label>Amount</label>
                      <input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                    </div>
                    <div className="mobile-field">
                      <label>Method</label>
                      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  {paymentMethod === 'check' && (
                    <div className="mobile-field">
                      <label>Check Number</label>
                      <input type="text" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
                    </div>
                  )}
                  <div className="mobile-field">
                    <label>Notes (optional)</label>
                    <input type="text" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
                  </div>
                  {paymentError && <p style={{ color: '#C0392B', fontSize: 12.5, marginBottom: 8 }}>{paymentError}</p>}
                  <button className="action-btn primary" type="submit" disabled={recordingPayment} style={{ width: '100%' }}>
                    {recordingPayment ? 'Recording…' : `Record Payment${balance > 0 ? ` (Balance $${balance.toFixed(2)})` : ''}`}
                  </button>
                </form>
              </div>
            </div>
          )}

          {payments.length > 0 && (
            <div className="section-card">
              <div className="section-card-header"><span>Payment History</span></div>
              <div className="section-card-body">
                {payments.map((p) => (
                  <div key={p.id} className="kv-row">
                    <span>
                      {p.method === 'check' ? `Check #${p.check_number}` : p.method === 'cash' ? 'Cash' : 'Other'}
                      {' — '}
                      {new Date(p.recorded_at).toLocaleDateString()}
                    </span>
                    <strong>${Number(p.amount).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
