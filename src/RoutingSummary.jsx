import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'

// Shows who an estimate/invoice routes to, resolved from the customer's contacts:
// a department-level approver wins, otherwise a customer-level approver. The
// manager is the recipient — they approve the work/payment and forward to their AP.
//
// Renders NOTHING for a customer with no contacts (i.e. a plain residential
// account), so those screens stay clean. Routing only appears once the data
// actually has commercial structure — complexity shows up only when it exists.
export default function RoutingSummary({ customerId, propertyId, label = 'Invoice' }) {
  const [routing, setRouting] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!customerId) {
      setRouting(null)
      return
    }
    supabase
      .from('contacts')
      .select('id, name, email, title, property_id, is_approver, is_billing')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .then(({ data }) => {
        if (cancelled) return
        const all = data || []
        const pick = (flag) => {
          const dept = all.filter((c) => c[flag] && c.property_id === propertyId)
          return dept.length ? dept : all.filter((c) => c[flag] && !c.property_id)
        }
        setRouting({
          approvers: pick('is_approver'),
          billing: pick('is_billing'),
          hasContacts: all.length > 0,
        })
      })
    return () => {
      cancelled = true
    }
  }, [customerId, propertyId])

  if (!routing || !routing.hasContacts) return null

  const { approvers, billing } = routing
  const line = (list) => list.map((c) => (c.email ? `${c.name} (${c.email})` : c.name)).join(', ')

  return (
    <div
      style={{
        border: '0.5px solid var(--border, #d0d0d0)',
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 14,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label} routing</div>
      {approvers.length > 0 ? (
        <div>Approval &rarr; {line(approvers)}</div>
      ) : (
        <div style={{ color: 'var(--danger, #c0392b)' }}>
          &#9888; No approver set for this department &mdash; set one on the customer page before sending.
        </div>
      )}
      {billing.length > 0 && (
        <div style={{ color: 'var(--mist)', marginTop: 2 }}>Then billing &rarr; {line(billing)}</div>
      )}
    </div>
  )
}
