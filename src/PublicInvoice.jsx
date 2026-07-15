import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './utils/supabase'
import InvoiceDocument from './InvoiceDocument'

export default function PublicInvoice() {
  const { invoiceId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payingNow, setPayingNow] = useState(false)
  const [payError, setPayError] = useState('')

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

  const footer = isEstimate ? null : data.invoice.paid_at ? (
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
      <InvoiceDocument data={data} footer={footer} />
    </div>
  )
}
