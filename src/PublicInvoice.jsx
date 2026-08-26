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
    const { data: result, error } = await supabase.functions.invoke('create-invoice-checkout', { body: { invoiceId } })
    setPayingNow(false)
    if (error || result?.error) {
      setPayError(result?.error || error.message)
    } else if (result?.url) {
      window.location.href = result.url
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A93A6' }}>
        Loading…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C0392B' }}>
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
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
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
          borderRadius: 8,
          padding: '14px 40px',
          fontSize: 15,
          fontWeight: 600,
          cursor: payingNow ? 'default' : 'pointer',
          opacity: payingNow ? 0.7 : 1,
        }}
      >
        {payingNow ? 'Loading…' : 'Pay Now'}
      </button>
      {payError && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 10 }}>{payError}</p>}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', padding: '40px 20px', background: '#EEF1F6' }}>
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
