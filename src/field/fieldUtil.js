import { supabase } from '../utils/supabase'

// Small helpers shared by the Field App "run it from the phone" screens.
export const usd = (n) => (n == null || isNaN(n) ? '—' : (Number(n) < 0 ? '-' : '') + '$' + Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
export const fmtPhone = (p) => { const d = String(p || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p || '' }
export const telHref = (p) => `tel:${String(p || '').replace(/[^\d+]/g, '')}`
export const smsHref = (p) => `sms:${String(p || '').replace(/[^\d+]/g, '')}`
export const daysSince = (t) => (t ? Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / 86400000)) : null)
export const shortWhen = (t) => (t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
export const shortDay = (iso) => (iso ? new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')

// Call an edge function and return { data, error } with the function's own error text when it sent one.
export async function callFn(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  let e = data?.error || null
  if (!e && error) {
    try { e = (await error.context?.json())?.error } catch { /* not JSON */ }
    e = e || error.message || 'Something went wrong.'
  }
  return { data, error: e }
}

// Send (or resend) an invoice or estimate to the customer by email or text.
export async function sendDoc(invoiceId, channel = 'email') {
  const { data, error } = await callFn('send-invoice-email', { invoiceId, channel })
  if (error) return { ok: false, t: error }
  return { ok: true, t: channel === 'sms' ? `Texted to ${data?.sentText || 'the customer'}.` : `Emailed to ${data?.sentTo || 'the customer'}.` }
}
