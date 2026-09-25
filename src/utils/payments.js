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
    .select('id, invoice_number, kind, amount_due, balance, total_paid, paid_at, payment_method, payment_method_at, financing_status, payment_confirmed_at, bills_to_customer_id, job_id')
    .eq('org_id', orgId).eq('kind', 'invoice')
    .is('paid_at', null).is('deleted_at', null)
    .not('payment_method', 'is', null)
    .order('payment_method_at', { ascending: true })
  const rows = data || []
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
