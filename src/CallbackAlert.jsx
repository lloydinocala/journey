import { useState, useEffect, useCallback } from 'react'
import { supabase } from './utils/supabase'

// Site-wide EMERGENCY callback alert. When a customer taps "Call Me First" on an
// estimate, the estimate is stamped (call_requested_at) and left unapproved. This
// overlay polls every org for unhandled callback requests and throws a loud,
// full-screen popup on every office page until someone calls the customer and taps
// "Mark call made" (mark_estimate_call_handled). Mounted once in Layout.
export default function CallbackAlert({ profile }) {
  const [list, setList] = useState([])
  const [busy, setBusy] = useState(false)
  const [snoozeUntil, setSnoozeUntil] = useState(0)

  const load = useCallback(async () => {
    if (!profile?.org_id) return
    const { data, error } = await supabase.rpc('list_pending_callbacks')
    if (!error && Array.isArray(data)) setList(data)
  }, [profile?.org_id])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const current = list[0]
  if (!current || Date.now() < snoozeUntil) return null

  const phone = current.customer_phone || ''
  const name = current.customer_name || 'A customer'
  const firstName = name.split(' ')[0]

  async function markHandled() {
    setBusy(true)
    try { await supabase.rpc('mark_estimate_call_handled', { p_estimate_id: current.estimate_id }) } catch (_) { /* will re-surface on next poll */ }
    setBusy(false)
    await load()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(90,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`@keyframes cbaPulse{0%,100%{box-shadow:0 24px 70px rgba(0,0,0,0.5),0 0 0 0 rgba(225,25,0,0.55)}50%{box-shadow:0 24px 70px rgba(0,0,0,0.5),0 0 0 20px rgba(225,25,0,0)}}`}</style>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560, overflow: 'hidden', animation: 'cbaPulse 1.15s ease-in-out infinite' }}>
        <div style={{ background: '#E11900', color: '#fff', padding: '20px 26px', textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '0.02em' }}>📞 CALLBACK REQUESTED</div>
          {list.length > 1 && <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, opacity: 0.92 }}>{list.length} customers are waiting for a call</div>}
        </div>
        <div style={{ padding: '26px 26px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{name}</div>
          {current.property_label && <div style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>{current.property_label}</div>}
          <div style={{ fontSize: 14, color: '#475569', marginTop: 10, lineHeight: 1.45 }}>
            asked us to call before approving their estimate{current.invoice_number ? ` (#${current.invoice_number})` : ''}.
          </div>
          {phone ? (
            <a href={`tel:${phone}`} style={{ display: 'block', margin: '22px auto 12px', maxWidth: 380, background: '#1F7A43', color: '#fff', fontWeight: 800, fontSize: 19, padding: '16px', borderRadius: 12, textDecoration: 'none' }}>
              Call {firstName} now — {phone}
            </a>
          ) : (
            <div style={{ margin: '22px auto 12px', color: '#B00020', fontWeight: 700 }}>No phone number on file — open the customer record to reach them.</div>
          )}
          <button onClick={markHandled} disabled={busy} style={{ display: 'block', margin: '0 auto', maxWidth: 380, width: '100%', background: '#fff', color: '#0F172A', border: '2px solid #0F172A', fontWeight: 800, fontSize: 15, padding: '13px', borderRadius: 12, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Saving…' : '✓ Mark call made'}
          </button>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setSnoozeUntil(Date.now() + 120000)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer' }}>
              Remind me again in 2 minutes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
