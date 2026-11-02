import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from './utils/supabase'

// A subscriber's own Journey-HVAC subscription (what THEY pay Journey), billed through Journey's
// Stripe account by the platform-billing edge function.
//   <PayJourney/>          public page /pay/:token — the never-expiring "pay your subscription" link
//   <JourneyBillingPanel/> the same view inside Settings (org admin) and Plans & Entitlements (office)

const money = (cents) => '$' + (Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const STATUS = {
  active: ['Active', '#166534', '#E3F1E8'], trialing: ['Active (trial)', '#166534', '#E3F1E8'],
  past_due: ['Payment failed — please update your card', '#92400E', '#FEF3C7'], unpaid: ['Unpaid', '#B00020', '#FBE7E7'],
  incomplete: ['Waiting on first payment', '#92400E', '#FEF3C7'], canceled: ['Canceled', '#64748B', '#EEF1F5'],
}
const ACTIVE = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete']

async function call(body) {
  const { data, error } = await supabase.functions.invoke('platform-billing', { body })
  if (error) {
    let msg = error.message
    try { const j = await error.context?.json(); if (j?.error) msg = j.error } catch { /* keep generic */ }
    return { error: msg }
  }
  return data
}

export function JourneyBillingPanel({ orgId, token, office, onChanged }) {
  const [interval, setInterval] = useState('month')
  const [d, setD] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const who = token ? { token } : { org_id: orgId }

  async function load(iv = interval) {
    const r = await call({ action: 'status', interval: iv, ...who })
    if (r?.error) { setMsg(r.error); setD(null); return }
    setMsg(''); setD(r)
    if (r?.billing?.billing_interval && ACTIVE.includes(r.billing.status)) setInterval(r.billing.billing_interval)
  }
  useEffect(() => { if (orgId || token) load() }, [orgId, token])

  async function go(action, extra = {}) {
    setBusy(action); setMsg('')
    const r = await call({ action, interval, ...who, ...extra })
    setBusy('')
    if (r?.error) { setMsg(r.error === 'already_subscribed' ? 'This company already has a subscription — use Manage billing.' : r.error); return }
    if (r?.url && action !== 'link') { window.location.href = r.url; return }
    if (action === 'link' && r?.url) { try { await navigator.clipboard.writeText(r.url); setMsg('Payment link copied — send it to the owner.') } catch { setMsg(r.url) } return }
    if (action === 'sync') setMsg(r?.skipped ? 'No active subscription to update.' : r?.changed ? `Subscription updated (${r.changed} change${r.changed === 1 ? '' : 's'}). Stripe prorates the difference on the next bill.` : 'Already matches.')
    if (action === 'setup') setMsg(`Billing connected to Stripe (${r.livemode ? 'LIVE' : 'test mode'}).`)
    await load(); onChanged?.()
  }

  if (!d) return <div style={{ fontSize: 13.5, color: msg ? '#B00020' : 'var(--mist)' }}>{msg || 'Loading…'}</div>
  const b = d.billing || {}
  const subscribed = b.stripe_subscription_id && ACTIVE.includes(b.status)
  const st = STATUS[b.status]
  const btn = { width: 'auto', padding: '8px 18px', margin: 0 }

  return (
    <div>
      {!d.livemode && <div style={{ fontSize: 12, fontWeight: 800, color: '#92400E', background: '#FEF3C7', borderRadius: 6, padding: '4px 10px', display: 'inline-block', marginBottom: 10 }}>TEST MODE — no real charges</div>}
      {d.house ? (
        <p style={{ margin: 0, fontSize: 14 }}>House account — not billed.</p>
      ) : (
        <>
          {st && <div style={{ display: 'inline-block', fontSize: 13, fontWeight: 700, color: st[1], background: st[2], borderRadius: 8, padding: '4px 10px', marginBottom: 10 }}>
            {st[0]}{b.current_period_end && ACTIVE.includes(b.status) ? ` · ${b.cancel_at_period_end ? 'ends' : 'renews'} ${new Date(b.current_period_end).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}
          </div>}
          {!subscribed && (
            <div style={{ display: 'inline-flex', border: '1px solid var(--border, #D5DAE1)', borderRadius: 8, overflow: 'hidden', margin: '0 0 10px' }}>
              {[['month', 'Monthly'], ['year', `Annual (save ${d.discountPct}%)`]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => { setInterval(k); load(k) }} style={{ border: 'none', padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: interval === k ? '#215F9A' : '#fff', color: interval === k ? '#fff' : '#1F2A37' }}>{l}</button>
              ))}
            </div>
          )}
          <table style={{ width: '100%', maxWidth: 520, borderCollapse: 'collapse', fontSize: 14, marginBottom: 10 }}>
            <tbody>
              {d.lines.map((l) => (
                <tr key={l.key} style={{ borderBottom: '1px solid #EEF1F5' }}>
                  <td style={{ padding: '6px 0' }}>{l.name}</td>
                  <td style={{ padding: '6px 0', textAlign: 'right' }}>{money(l.cents)}</td>
                </tr>
              ))}
              <tr><td style={{ padding: '8px 0', fontWeight: 800 }}>Total per {(subscribed ? b.billing_interval : interval) === 'year' ? 'year' : 'month'}</td><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 800 }}>{money(d.totalCents)}</td></tr>
            </tbody>
          </table>
          {d.unpriced?.length > 0 && office && <div style={{ fontSize: 12.5, color: '#92400E', marginBottom: 8 }}>No price set (not billed): {d.unpriced.join(', ')} — set it on the Packages tab.</div>}
          {subscribed && b.amount_cents != null && b.amount_cents !== d.totalCents && (
            <div style={{ fontSize: 12.5, color: '#92400E', marginBottom: 8 }}>Stripe is charging {money(b.amount_cents)}; packages now total {money(d.totalCents)}.{office ? ' Click "Update Stripe" to match.' : ' The Journey office will update it.'}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!subscribed && <button className="auth-button" style={btn} disabled={!!busy || !d.lines.length} onClick={() => go('checkout')}>{busy === 'checkout' ? 'Opening…' : 'Subscribe & pay'}</button>}
            {b.stripe_subscription_id && <button className="logout-button" style={btn} disabled={!!busy} onClick={() => go('portal')}>{busy === 'portal' ? 'Opening…' : 'Manage billing / update card'}</button>}
            {office && <button className="logout-button" style={btn} disabled={!!busy} onClick={() => go('link')}>Copy payment link</button>}
            {office && subscribed && <button className="logout-button" style={btn} disabled={!!busy} onClick={() => go('sync')}>{busy === 'sync' ? 'Updating…' : 'Update Stripe'}</button>}
            {office && d.setupDone === false && <button className="logout-button" style={btn} disabled={!!busy} onClick={() => go('setup')}>Connect billing to Stripe (one time)</button>}
          </div>
        </>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 13.5, color: /copied|updated|matches|connected/i.test(msg) ? '#166534' : '#B00020' }}>{msg}</div>}
    </div>
  )
}

export default function PayJourney() {
  const { token } = useParams()
  const [sp] = useSearchParams()
  const [org, setOrg] = useState(null)
  useEffect(() => { call({ action: 'status', token }).then((r) => setOrg(r?.org || null)) }, [token])
  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB', padding: '40px 16px', fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 2px 12px rgba(16,42,67,.08)' }}>
        <div style={{ fontWeight: 900, fontSize: 22, color: '#0B2545' }}>Journey-HVAC</div>
        <div style={{ fontSize: 14, color: 'var(--mist, #64748B)', marginBottom: 18 }}>Subscription{org?.name ? ` for ${org.name}` : ''}</div>
        {sp.get('done') && <div style={{ background: '#E3F1E8', color: '#166534', borderRadius: 8, padding: '10px 14px', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Thank you — your payment went through. Your Journey account is active.</div>}
        <JourneyBillingPanel token={token} />
        <p style={{ fontSize: 12.5, color: '#64748B', marginTop: 22 }}>Payments are processed securely by Stripe. Questions? Call (844) 486-1625.</p>
      </div>
    </div>
  )
}
