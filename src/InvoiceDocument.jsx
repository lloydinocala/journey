function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function addDaysFormatted(dateStr, days) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + (days || 0))
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Pure presentational invoice/estimate layout — used by both the public,
// no-login customer pay page (PublicInvoice.jsx) and the staff-only mobile
// preview (TechInvoiceView.jsx), so what a tech reviews before sending is
// pixel-identical to what the customer actually receives. `footer` is a slot
// for whatever action area belongs below the totals — Pay Now for customers,
// Send/Record Payment controls for staff — since those two audiences need
// very different, and very differently-secured, actions there.
export default function InvoiceDocument({ data, footer }) {
  const { invoice, org, job, property, customer, lineItems, technicians } = data
  const primary = org?.brand_primary_color || '#2F5DE3'
  const isEstimate = invoice.kind === 'estimate'
  const docLabel = isEstimate ? 'Estimate' : 'Invoice'

  const hasBusinessAddress = org?.business_street || org?.business_city
  const hasContactBlock = hasBusinessAddress || org?.business_phone || org?.business_email || org?.business_website || org?.license_number
  const paymentTermsLabel = !org?.payment_terms_days ? 'Due Upon Receipt' : 'Net ' + org.payment_terms_days
  const dueDate = addDaysFormatted(invoice.invoice_date, org?.payment_terms_days || 0)

  const discountDisplay =
    invoice.discount_amount > 0
      ? (invoice.discount_type === 'percent' ? invoice.subtotal * (invoice.discount_amount / 100) : invoice.discount_amount)
      : 0

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', background: 'white', borderRadius: 12, padding: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>

        <div style={{ flex: 1, minWidth: 240 }}>
          {org?.logo_url ? (
            <img src={org.logo_url} alt={org.name} style={{ maxHeight: 70, maxWidth: 220, marginBottom: 10, display: 'block' }} />
          ) : (
            <h1 style={{ margin: '0 0 10px', fontSize: 22, color: primary }}>{org?.name}</h1>
          )}
          {org?.logo_url && <p style={{ margin: '0 0 16px', fontWeight: 700, fontSize: 15, color: '#152238' }}>{org?.name}</p>}

          <div style={{ borderTop: '1px solid #E2E6ED', paddingTop: 14 }}>
            <p style={{ margin: 0, fontWeight: 600, color: '#152238' }}>{customer?.display_name}</p>
            <p style={{ margin: '2px 0', color: '#64748B', fontSize: 14 }}>
              {property?.street_address}{property?.unit ? ' #' + property.unit : ''}
            </p>
            <p style={{ margin: '2px 0', color: '#64748B', fontSize: 14 }}>
              {[property?.city, property?.state, property?.zip].filter(Boolean).join(', ')}
            </p>
            {customer?.primary_phone && (
              <p style={{ margin: '10px 0 2px', color: '#64748B', fontSize: 14 }}>{customer.primary_phone}</p>
            )}
            {customer?.email_1 && (
              <p style={{ margin: '2px 0', color: '#64748B', fontSize: 14 }}>{customer.email_1}</p>
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ border: '1px solid #E2E6ED', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                <span style={{ color: '#8A93A6', textTransform: 'uppercase', fontSize: 11 }}>Job</span>
                <span style={{ fontWeight: 600 }}>#{job?.job_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                <span style={{ color: '#8A93A6', textTransform: 'uppercase', fontSize: 11 }}>Service Date</span>
                <span style={{ fontWeight: 600 }}>{formatDate(job?.job_date)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                <span style={{ color: '#8A93A6', textTransform: 'uppercase', fontSize: 11 }}>Payment Terms</span>
                <span style={{ fontWeight: 600 }}>{paymentTermsLabel}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                <span style={{ color: '#8A93A6', textTransform: 'uppercase', fontSize: 11 }}>Due Date</span>
                <span style={{ fontWeight: 600 }}>{dueDate}</span>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #E2E6ED', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#8A93A6', textTransform: 'uppercase', fontSize: 11 }}>Amount Due</span>
              <span style={{ fontWeight: 700, fontSize: 20 }}>${invoice.amount_due?.toFixed(2)}</span>
            </div>
          </div>

          {hasContactBlock && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, textTransform: 'uppercase', color: '#8A93A6', borderBottom: '1px solid #E2E6ED', paddingBottom: 6, margin: '0 0 6px' }}>
                Contact Us
              </p>
              {hasBusinessAddress && (
                <>
                  <p style={{ margin: '2px 0', fontSize: 14, color: '#152238' }}>{org.business_street}</p>
                  <p style={{ margin: '2px 0', fontSize: 14, color: '#152238' }}>
                    {[org.business_city, org.business_state, org.business_zip].filter(Boolean).join(', ')}
                  </p>
                </>
              )}
              {org?.business_phone && <p style={{ margin: '8px 0 2px', fontSize: 14, color: '#152238' }}>{org.business_phone}</p>}
              {org?.business_email && <p style={{ margin: '2px 0', fontSize: 14, color: '#152238' }}>{org.business_email}</p>}
              {org?.business_website && <p style={{ margin: '2px 0', fontSize: 14, color: '#152238' }}>{org.business_website}</p>}
              {org?.license_number && <p style={{ margin: '8px 0 2px', fontSize: 12, color: '#8A93A6' }}>License #{org.license_number}</p>}
            </div>
          )}

          {technicians && technicians.length > 0 && (
            <p style={{ marginTop: 12, fontSize: 13, color: '#64748B' }}>
              Service completed by: {technicians.join(', ')}
            </p>
          )}
        </div>
      </div>

      <div style={{ background: primary, color: 'white', padding: '10px 16px', borderRadius: 6, fontWeight: 700, letterSpacing: 1, fontSize: 14, marginBottom: 20 }}>
        {docLabel.toUpperCase()} {invoice.invoice_number}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', background: primary, color: 'white', padding: '8px 14px', borderRadius: '6px 6px 0 0', fontSize: 13, fontWeight: 600 }}>
          <div style={{ flex: 3 }}>Services</div>
          <div style={{ flex: 1, textAlign: 'right' }}>Qty</div>
          <div style={{ flex: 1, textAlign: 'right' }}>Unit Price</div>
          <div style={{ flex: 1, textAlign: 'right' }}>Amount</div>
        </div>
        {lineItems.map((li, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              padding: '10px 14px',
              fontSize: 14,
              borderBottom: '1px solid #EEF1F6',
              background: idx % 2 === 1 ? '#FAFBFC' : 'white',
            }}
          >
            <div style={{ flex: 3 }}>{li.description}</div>
            <div style={{ flex: 1, textAlign: 'right', color: '#64748B' }}>{li.quantity}</div>
            <div style={{ flex: 1, textAlign: 'right', color: '#64748B' }}>${li.unit_price.toFixed(2)}</div>
            <div style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>${(li.quantity * li.unit_price).toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 280, marginLeft: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
          <span>Subtotal</span><span>${invoice.subtotal?.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
          <span>Sales tax</span><span>${invoice.sales_tax?.toFixed(2)}</span>
        </div>
        {discountDisplay > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
            <span>Discount</span><span>-${discountDisplay.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, marginTop: 10, paddingTop: 10, borderTop: '2px solid ' + primary }}>
          <span>{isEstimate ? 'Estimated Total' : 'Total Due'}</span><span>${invoice.amount_due?.toFixed(2)}</span>
        </div>
      </div>

      {footer}
    </div>
  )
}
