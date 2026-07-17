import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from './utils/supabase'

export default function JoinPlan() {
  const { propertyId } = useParams()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [choosingTierId, setChoosingTierId] = useState(null)
  const [checkoutError, setCheckoutError] = useState('')

  const checkoutStatus = searchParams.get('checkout')

  useEffect(() => {
    supabase.functions
      .invoke('public-property-tiers', { body: { propertyId } })
      .then(({ data: result, error: err }) => {
        if (err) {
          setError('This link is invalid or has expired.')
        } else if (result?.error) {
          setError(result.error)
        } else {
          setData(result)
        }
        setLoading(false)
      })
  }, [propertyId])

  async function handleChoose(tierId) {
    setChoosingTierId(tierId)
    setCheckoutError('')
    const { data: result, error } = await supabase.functions.invoke('create-property-agreement-checkout', {
      body: { propertyId, tierId, billingCycle },
    })
    setChoosingTierId(null)
    if (error || result?.error) {
      setCheckoutError(result?.error || error.message)
    } else if (result?.url) {
      window.location.href = result.url
    }
  }

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
        {error || 'Plans not found.'}
      </div>
    )
  }

  const { property, customer, org, tiers } = data
  const primary = org?.brand_primary_color || '#2F5DE3'
  const addressLine = property.street_address + (property.unit ? ' #' + property.unit : '')

  if (checkoutStatus === 'success') {
    return (
      <div style={{ minHeight: '100vh', padding: '40px 20px', background: '#EEF1F6' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <h2 style={{ color: primary }}>You're all set!</h2>
          <p style={{ color: '#64748B' }}>Your maintenance plan is confirmed. {org?.name || 'We'}'ll be in touch to schedule your first visit.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: '40px 20px', background: '#EEF1F6' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 32, marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          {org?.logo_url ? (
            <img src={org.logo_url} alt={org.name} style={{ maxHeight: 60, maxWidth: 200, marginBottom: 10, display: 'block' }} />
          ) : (
            <h1 style={{ margin: '0 0 6px', fontSize: 22, color: primary }}>{org?.name}</h1>
          )}
          <p style={{ margin: 0, color: '#64748B' }}>
            Maintenance plan options for <strong style={{ color: '#152238' }}>{customer?.display_name}</strong> — {addressLine}
          </p>

          <div style={{ display: 'inline-flex', marginTop: 20, border: '1px solid #E2E6ED', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                background: billingCycle === 'monthly' ? primary : 'white',
                color: billingCycle === 'monthly' ? 'white' : '#64748B',
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              style={{
                padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                background: billingCycle === 'annual' ? primary : 'white',
                color: billingCycle === 'annual' ? 'white' : '#64748B',
              }}
            >
              Annual
            </button>
          </div>
        </div>

        {checkoutStatus === 'canceled' && (
          <div style={{ background: '#FFF4E5', border: '1px solid #F5A524', borderRadius: 8, padding: 14, marginBottom: 20, color: '#93650A', fontSize: 14 }}>
            Checkout was canceled — no charge was made. Pick a plan below whenever you're ready.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {tiers.map((t) => {
            const price = billingCycle === 'monthly' ? t.monthly_price : t.annual_price
            return (
              <div key={t.id} style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 8px', color: primary }}>{t.name}</h3>
                {t.description && <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 12px', flex: 1 }}>{t.description}</p>}
                <p style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px' }}>
                  ${Number(price).toFixed(2)}
                  <span style={{ fontSize: 14, fontWeight: 400, color: '#64748B' }}>/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                </p>
                <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px' }}>
                  {t.visit_count_per_year} visit{t.visit_count_per_year === 1 ? '' : 's'}/year
                  {t.includes_comfort_check ? ' · comfort check included' : ''}
                  {t.discount_pct ? ` · ${t.discount_pct}% off repairs` : ''}
                </p>
                <button
                  onClick={() => handleChoose(t.id)}
                  disabled={choosingTierId === t.id}
                  style={{
                    background: primary, color: 'white', border: 'none', borderRadius: 8,
                    padding: '12px 0', fontSize: 14, fontWeight: 600, cursor: choosingTierId === t.id ? 'default' : 'pointer',
                    opacity: choosingTierId === t.id ? 0.7 : 1,
                  }}
                >
                  {choosingTierId === t.id ? 'Loading…' : 'Choose This Plan'}
                </button>
              </div>
            )
          })}
        </div>

        {checkoutError && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 16, textAlign: 'center' }}>{checkoutError}</p>}
      </div>
    </div>
  )
}
