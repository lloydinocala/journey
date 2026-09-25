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
  const [methodBusy, setMethodBusy] = useState('')     // which method button is saving
  const [methodDone, setMethodDone] = useState('')     // recorded non-card choice
  const [methodError, setMethodError] = useState('')

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

  // Cash / Check / Financing: record the customer's choice (server-side, since this
  // page is unauthenticated). Never marks the invoice paid — the office confirms.
  async function recordMethod(method) {
    setMethodBusy(method); setMethodError('')
    try {
      const { data: result, error } = await supabase.functions.invoke('set-invoice-payment-method', { body: { invoiceId, method } })
      if (error || result?.error) {
        let msg = result?.error || ''
        if (!msg && error?.context && typeof error.context.json === 'function') { try { const b = await error.context.json(); msg = b?.error || '' } catch (_) { /* ignore */ } }
        setMethodError(msg || error?.message || 'We couldn’t save that just now. Please try again, or call us and we’ll take care of it.')
        return
      }
      setMethodDone(method)
    } catch (e) {
      setMethodError('We couldn’t save that just now. Please try again, or call us and we’ll take care of it.')
    } finally { setMethodBusy('') }
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
  const eBrand = data.org?.brand_primary_color || '#2F5DE3'
  const eLane = { width: '100%', maxWidth: 340, minHeight: 48, borderRadius: 10, fontSize: 15.5, fontWeight: 700, cursor: 'pointer', margin: '0 auto', display: 'block' }
  const estDoneMsg = {
    card: 'Great — we’ll take your card for the deposit when we confirm your install date.',
    financing: 'Great — we’ll send you financing options to apply. We’ll schedule your install once financing is approved.',
    cash: 'Great — we’ll arrange your cash deposit when we confirm your install date.',
    check: 'Great — we’ll confirm the deposit amount and your install date shortly.',
  }
  const estimateFooter = (
    <div style={{ textAlign: 'center', marginTop: 28 }}>
      {estStatus === 'Approved' ? (
        <div>
          <div style={{ color: '#1F7A43', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>✓ Approved — thank you! Now, how would you like to handle payment?</div>
          {methodDone ? (
            <div style={{ maxWidth: 440, margin: '0 auto', color: '#1F7A43', fontWeight: 600, fontSize: 15, lineHeight: 1.45 }}>
              {estDoneMsg[methodDone]}
              <button onClick={() => { setMethodDone(''); setMethodError('') }} style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: '#64748B', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}>Choose a different way</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <button onClick={() => recordMethod('card')} disabled={!!methodBusy} style={{ ...eLane, background: eBrand, color: 'white', border: 'none' }}>{methodBusy === 'card' ? 'Saving…' : 'Pay by card'}</button>
              <button onClick={() => recordMethod('financing')} disabled={!!methodBusy} style={{ ...eLane, background: '#fff', color: eBrand, border: `1px solid ${eBrand}` }}>{methodBusy === 'financing' ? 'Saving…' : 'Apply for financing'}</button>
              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 340, margin: '0 auto' }}>
                <button onClick={() => recordMethod('cash')} disabled={!!methodBusy} style={{ ...eLane, flex: 1, maxWidth: 'none', background: '#fff', color: '#334155', border: '1px solid #CBD5E1' }}>{methodBusy === 'cash' ? '…' : 'Cash'}</button>
                <button onClick={() => recordMethod('check')} disabled={!!methodBusy} style={{ ...eLane, flex: 1, maxWidth: 'none', background: '#fff', color: '#334155', border: '1px solid #CBD5E1' }}>{methodBusy === 'check' ? '…' : 'Check'}</button>
              </div>
            </div>
          )}
          {methodError && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 10 }}>{methodError}</p>}
        </div>
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

  const brand = data.org?.brand_primary_color || '#2F5DE3'
  const orgName = data.org?.name || 'us'
  const amt = Number(data.invoice.amount_due || 0).toFixed(2)
  const lane = { width: '100%', maxWidth: 360, minHeight: 50, borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'block', margin: '0 auto' }

  const paidFooter = (
    <div style={{ textAlign: 'center', marginTop: 28, color: '#4CD97B', fontWeight: 600 }}>
      ✓ Paid on {new Date(data.invoice.paid_at).toLocaleDateString()}
    </div>
  )
  const doneMsg = {
    cash: `Thanks! Please have $${amt} ready in cash — we’ll mark it paid when we collect it.`,
    check: `Thanks! Please make your check for $${amt} out to ${orgName} — we’ll mark it paid when we receive it.`,
    financing: `Great — we’ll send you financing options to apply. Your invoice stays open until financing is approved, then we’ll take care of the rest.`,
  }
  const doneFooter = (
    <div style={{ textAlign: 'center', marginTop: 28, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
      <div style={{ color: '#1F7A43', fontWeight: 700, fontSize: 15, lineHeight: 1.45 }}>{doneMsg[methodDone]}</div>
      <button onClick={() => { setMethodDone(''); setMethodError('') }} style={{ marginTop: 12, background: 'none', border: 'none', color: '#64748B', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}>Choose a different way to pay</button>
    </div>
  )
  const chooserFooter = (
    <div style={{ textAlign: 'center', marginTop: 28 }}>
      <p style={{ color: '#152238', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>How would you like to pay?</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <button onClick={handlePayNow} disabled={payingNow || !!methodBusy} style={{ ...lane, background: brand, color: 'white', border: 'none', opacity: payingNow ? 0.7 : 1 }}>
          {payingNow ? 'Loading…' : `Pay by card — $${amt}`}
        </button>
        <button onClick={() => recordMethod('financing')} disabled={!!methodBusy || payingNow} style={{ ...lane, background: '#fff', color: brand, border: `1px solid ${brand}` }}>
          {methodBusy === 'financing' ? 'Saving…' : 'Apply for financing'}
        </button>
        <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 360, margin: '0 auto' }}>
          <button onClick={() => recordMethod('cash')} disabled={!!methodBusy || payingNow} style={{ ...lane, flex: 1, maxWidth: 'none', background: '#fff', color: '#334155', border: '1px solid #CBD5E1' }}>{methodBusy === 'cash' ? '…' : 'Cash'}</button>
          <button onClick={() => recordMethod('check')} disabled={!!methodBusy || payingNow} style={{ ...lane, flex: 1, maxWidth: 'none', background: '#fff', color: '#334155', border: '1px solid #CBD5E1' }}>{methodBusy === 'check' ? '…' : 'Check'}</button>
        </div>
      </div>
      {(payError || methodError) && <p style={{ color: '#C0392B', fontSize: 14, marginTop: 12, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.4 }}>{payError || methodError}</p>}
    </div>
  )

  const footer = isEstimate ? estimateFooter
    : data.invoice.paid_at ? paidFooter
      : methodDone ? doneFooter
        : chooserFooter

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
