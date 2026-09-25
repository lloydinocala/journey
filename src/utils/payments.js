// Payment-method confirmation helpers (Phase A of payment options & financing).
// A customer (or the office) chooses how they'll pay; the office then CONFIRMS the
// method — which is what unlocks install scheduling — and marks the invoice PAID
// once the money is actually in. paid_at itself is settled server-side from the
// invoice_payments ledger (a DB trigger), so "Mark paid" records a payment row the
// same way ReceivePayment does; it never writes paid_at directly.
import { supabase } from './supabase'

const METHOD_LABEL = { cash: 'Cash', check: 'Check', card: 'Card', financing: 'Financing' }
export const methodLabel = (m) => METHOD_LABEL[m] || (m ? m[0].toUpperCase() + m.slice(1) : '—')

// Invoices that have a chosen payment method but aren't paid yet — the office
// work queue: confirm the method (unlocks scheduling), approve financing, mark paid.
export async function listPaymentsToConfirm(orgId) {
  const { data } = await supabase.from('invoices')
    .select('id, invoice_number, kind, estimate_type, approval_status, amount_due, balance, total_paid, paid_at, payment_method, payment_method_at, financing_status, payment_confirmed_at, bills_to_customer_id, job_id, spawned_job_id, converted_to_job_id')
    .eq('org_id', orgId)
    .is('paid_at', null).is('deleted_at', null)
    .or('kind.eq.invoice,and(kind.eq.estimate,estimate_type.eq.system)')
    .order('payment_method_at', { ascending: true })
  // Invoices appear once a method is chosen and stay until paid. System estimates
  // appear once approved into an install and stay until payment is confirmed — even
  // with no method yet, so the office can set it and confirm here (which is what
  // releases the install scheduling gate for an office-driven sale).
  const rows = (data || []).filter((r) => {
    if (r.kind === 'invoice') return !!r.payment_method
    const approved = (r.approval_status || '').toLowerCase() === 'approved' || r.spawned_job_id || r.converted_to_job_id
    return approved && !r.payment_confirmed_at
  })
  // Resolve customer display names without relying on an embed FK name.
  const ids = [...new Set(rows.map((r) => r.bills_to_customer_id).filter(Boolean))]
  let names = {}
  if (ids.length) {
    const { data: cust } = await supabase.from('customers').select('id, display_name').in('id', ids)
    ;(cust || []).forEach((c) => { names[c.id] = c.display_name })
  }
  return rows.map((r) => ({ ...r, customer_name: names[r.bills_to_customer_id] || '' }))
}

// Confirm the chosen method is good to proceed (this is what the install
// scheduling gate checks). For a financing invoice, confirming means approved.
export async function confirmPaymentMethod(orgId, invoiceId) {
  return supabase.from('invoices')
    .update({ payment_confirmed_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', invoiceId)
}

// Office sets the payment method on an estimate/invoice (in-person sale where the
// customer didn't pick online).
export async function setPaymentMethodOffice(orgId, invoiceId, method) {
  const patch = { payment_method: method, payment_method_at: new Date().toISOString(), financing_status: method === 'financing' ? 'applied' : null }
  return supabase.from('invoices').update(patch).eq('org_id', orgId).eq('id', invoiceId)
}

export async function setFinancingStatus(orgId, invoiceId, status) {
  const patch = { financing_status: status }
  if (status === 'approved' || status === 'funded') patch.payment_confirmed_at = new Date().toISOString()
  return supabase.from('invoices').update(patch).eq('org_id', orgId).eq('id', invoiceId)
}

// Mark an invoice PAID by recording a payment for its balance (batch + line),
// exactly as the Receive Payment flow does — the balance/paid_at trigger settles it.
export async function markInvoicePaid(orgId, invoice, userId) {
  const amount = Number(invoice.balance ?? invoice.amount_due ?? 0)
  const method = methodLabel(invoice.payment_method)
  const { data: batch, error: be } = await supabase.from('payment_batches').insert({
    org_id: orgId, customer_id: invoice.bills_to_customer_id || null,
    total_amount: amount, applied_amount: amount, unapplied_amount: 0,
    method, notes: 'Marked paid from Payments to Confirm', received_at: new Date().toISOString(), recorded_by: userId || null,
  }).select('id').single()
  if (be) return { error: be }
  const { error: pe } = await supabase.from('invoice_payments').insert({
    org_id: orgId, invoice_id: invoice.id, amount, method, batch_id: batch?.id || null, recorded_by: userId || null,
  })
  if (pe) return { error: pe }
  return {}
}
