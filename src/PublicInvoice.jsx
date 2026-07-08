import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './utils/supabase'

export default function PublicInvoice() {
  const { invoiceId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mist)' }}>
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

  const { invoice, org, job, property, customer, lineItems } = data
  const brandColor = org?.brand_primary_color || 'var(--route-blue)'

  return (
    <div style={{ minHeight: '100vh', padding: '40px 20px' }}>
      <div className="auth-card" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: brandColor }}>{org?.name}</h1>
            <p style={{ color: 'var(--mist)', margin: '4px 0 0' }}>Invoice {invoice.invoice_number}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--mist)' }}>{invoice.invoice_date}</p>
            {invoice.paid_at ? (
              <span className="status-pill status-active" style={{ marginTop: 6, display: 'inline-block' }}>Paid</span>
            ) : (
              <span className="status-pill status-trial" style={{ marginTop: 6, display: 'inline-block' }}>Due</span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{customer?.display_name}</p>
          <p style={{ margin: '2px 0', color: 'var(--mist)' }}>
            {property?.street_address}{property?.unit ? ` #${property.unit}` : ''}
          </p>
          <p style={{ margin: '2px 0', color: 'var(--mist)' }}>
            {[property?.city, property?.state, property?.zip].filter(Boolean).join(', ')}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--mist)' }}>Job {job?.job_number} — {job?.job_date}</p>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '12px 0', marginBottom: 20 }}>
          {lineItems.map((li, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
              <span>{li.description}{li.quantity > 1 ? ` × ${li.quantity}` : ''}</span>
              <span>${(li.quantity * li.unit_price).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div style={{ maxWidth: 260, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
            <span>Subtotal</span><span>${invoice.subtotal?.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
            <span>Sales tax</span><span>${invoice.sales_tax?.toFixed(2)}</span>
          </div>
          {invoice.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
              <span>Discount</span><span>-${(invoice.discount_type === 'percent' ? invoice.subtotal * (invoice.discount_amount / 100) : invoice.discount_amount).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span>Total Due</span><span>${invoice.amount_due?.toFixed(2)}</span>
          </div>
        </div>

        {!invoice.paid_at && (
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <button className="auth-button" style={{ width: 'auto', padding: '12px 32px' }} disabled>
              Pay Now — Coming Soon
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
