import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './utils/supabase'
import InvoiceDocument from './InvoiceDocument'
import PMReportDocument from './PMReportDocument'

export default function PublicInvoice() {
  const { invoiceId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payingNow, setPayingNow] = useState(false)
  const [payError, setPayError] = useState('')
  const [deciding, setDeciding] = useState(false)
  const [decideError, setDecideError] = useState('')
  const [decidedStatus, setDecidedStatus] = useState('')

  async function handleDecision(d) {
    setDeciding(true); setDecideError('')
    const { data: result, error } = await supabase.rpc('record_customer_estimate_decision', { p_estimate_id: invoiceId, p_decision: d })
    setDeciding(false)
    if (error) setDecideError(error.message)
    else setDecidedStatus(result || (d === 'approved' ? 'Approved' : 'Declined'))
  }

  async function handlePayNow() {
    setPayingNow(true)
    setPayError('')
    try {
      const { data: result, error } = await supabase.functions.invoke('create-invoice-checkout', { body: { invoiceId } })
      if (result?.url) { window.location.href = result.url; return }
      // The function returns its real reason (e.g. "already paid", "not yet verified with
      // completion photos") as JSON in a non-2xx response. supabase-js surfaces that as
      // `error` and puts the Response on error.context — the body is NOT auto-parsed — so
      // read it here; otherwise the customer would see a cryptic "non-2xx status code".
      let msg = result?.error || ''
      if (!msg && error?.context && typeof error.context.json === 'function') {
        try { const body = await error.context.json(); msg = body?.error || '' } catch (_) { /* fall through */ }
      }
      setPayError(msg || error?.message || 'We couldn’t start the payment just now. Please try again, or contact us and we’ll be glad to help you take care of it.')
    } catch (e) {
      setPayError('We couldn’t start the payment just now. Please try again, or contact us and we’ll be glad to help you take care of it.')
    } finally {
      setPayingNow(false)
    }
  }

  useEffect(() => {
    supabase.functions
      .invoke('get-public-invoice', { body: { invoiceId } })
      .then(({ data: result, error: err }) => {
        if (err) {
          setError('This invoice link is invalid or has expired.')
        } else if (result?.error) {
          setError(result.error)
        } else {
          setData(result)
        }
        setLoading(false)
      })
  }, [invoiceId])

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: '#8A93A6' }}>
        Loading…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: '#C0392B' }}>
        {error || 'Invoice not found.'}
      </div>
    )
  }

  const isEstimate = data.invoice.kind === 'estimate'

  const estStatus = decidedStatus || data.invoice.approval_status
  const estimateFooter = (
    <div style={{ textAlign: 'center', marginTop: 28 }}>
      {estStatus === 'Approved' ? (
        <div style={{ color: '#1F7A43', fontWeight: 700, fontSize: 16 }}>✓ Approved — thank you! We&rsquo;ll be in touch to schedule the work.</div>
      ) : estStatus === 'Declined' ? (
        <div style={{ color: '#64748B', fontWeight: 600, fontSize: 15 }}>You declined this estimate. Contact us any time if you&rsquo;d like to revisit it.</div>
      ) : (
        <div>
          <p style={{ color: '#152238', fontSize: 15, marginBottom: 14 }}>Approve this estimate to authorize the repair, or decline.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => handleDecision('approved')} disabled={deciding} style={{ background: '#1F7A43', color: 'white', border: 'none', borderRadius: 8, padding: '14px 36px', fontSize: 15, fontWeight: 700, cursor: deciding ? 'default' : 'pointer', opacity: deciding ? 0.7 : 1 }}>{deciding ? 'Saving…' : 'Approve'}</button>
            <button onClick={() => handleDecision('declined')} disabled={deciding} style={{ background: 'white', color: '#C0392B', border: '1px solid #C0392B', borderRadius: 8, padding: '14px 36px', fontSize: 15, fontWeight: 700, cursor: deciding ? 'default' : 'pointer', opacity: deciding ? 0.7 : 1 }}>Decline</button>
          </div>
          {decideError && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 10 }}>{decideError}</p>}
        </div>
      )}
    </div>
  )

  const footer = isEstimate ? estimateFooter : data.invoice.paid_at ? (
    <div style={{ textAlign: 'center', marginTop: 28, color: '#4CD97B', fontWeight: 600 }}>
      ✓ Paid on {new Date(data.invoice.paid_at).toLocaleDateString()}
    </div>
  ) : (
    <div style={{ textAlign: 'center', marginTop: 28 }}>
      <button
        onClick={handlePayNow}
        disabled={payingNow}
        style={{
          background: data.org?.brand_primary_color || '#2F5DE3',
          color: 'white',
          border: 'none',
          borderRadius: 10,
          padding: '16px 40px',
          fontSize: 17,
          fontWeight: 700,
          cursor: payingNow ? 'default' : 'pointer',
          opacity: payingNow ? 0.7 : 1,
          width: '100%',
          maxWidth: 360,
          minHeight: 52,
        }}
      >
        {payingNow ? 'Loading…' : `Pay Now — $${data.invoice.amount_due?.toFixed(2)}`}
      </button>
      {payError && <p style={{ color: '#C0392B', fontSize: 14, marginTop: 12, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.4 }}>{payError}</p>}
    </div>
  )

  return (
    <div style={{
      minHeight: '100dvh',
      // Comfortable gutters that shrink on phones; generous bottom room past the
      // safe-area/home-indicator so the Pay button is never trapped under the
      // browser toolbar (100dvh + this is the fix for the mobile "cut off" report).
      padding: 'clamp(16px, 4vw, 40px) clamp(10px, 4vw, 20px) calc(clamp(24px, 6vw, 56px) + env(safe-area-inset-bottom, 0px))',
      background: '#EEF1F6',
    }}>
      {data.pmReport && <PMReportDocument report={data.pmReport} org={data.org} property={data.property} customer={data.customer} />}
      {(!data.pmReport || (data.lineItems && data.lineItems.length > 0)) ? (
        <InvoiceDocument data={data} footer={footer} />
      ) : (
        <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', borderRadius: 12, padding: '24px 28px', textAlign: 'center', color: '#1F7A43', fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}>
          No repairs are recommended at this time — your system is in good working order.
        </div>
      )}
    </div>
  )
}
