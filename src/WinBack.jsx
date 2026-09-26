// Win-back for lapsed maintenance plans. Self-contained: loads canceled/expired
// agreements, ranks them (most recent + highest value first — the best win-back
// odds), shows the reason beside each, and offers an honest AI outreach draft.
import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import AiAssist from './AiAssist'

const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toFixed(0)}`)
const daysAgo = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null)

const WINBACK_SYS = `Draft a short, warm win-back message from an HVAC company to a customer whose maintenance plan lapsed, inviting them to restart. Mention the plan by name if given. 2-3 sentences, honest and no pressure — remind them of the value, don't scare them. Ready for a person to review and send. No subject line.`

export default function WinBack({ orgId }) {
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!orgId || !open || rows != null) return
    let alive = true
    ;(async () => {
      const { data } = await supabase.from('maintenance_agreements')
        .select('id, status, price, billing_cycle, start_date, canceled_at, customer_id, customers(display_name, primary_phone), tier:maintenance_agreement_tiers(name)')
        .eq('org_id', orgId)
        .in('status', ['canceled', 'cancelled', 'expired'])
      if (!alive) return
      setRows(data || [])
    })()
    return () => { alive = false }
  }, [orgId, open, rows])

  const ranked = (rows || []).map((a) => {
    const monthly = String(a.billing_cycle || '').toLowerCase() === 'annual' ? Number(a.price || 0) / 12 : Number(a.price || 0)
    const since = daysAgo(a.canceled_at)
    const tenureDays = a.start_date && a.canceled_at ? Math.floor((new Date(a.canceled_at) - new Date(a.start_date)) / 86400000) : null
    // Best odds: lapsed recently, decent value, and were a customer a while.
    let score = monthly
    if (since != null) score += since <= 90 ? 40 : since <= 365 ? 15 : 0
    if (tenureDays != null && tenureDays >= 365) score += 20
    const reasons = []
    if (since != null) reasons.push(`lapsed ${since} day${since === 1 ? '' : 's'} ago`)
    if (monthly > 0) reasons.push(`was ${money(monthly)}/mo`)
    if (tenureDays != null && tenureDays >= 365) reasons.push(`${Math.round(tenureDays / 365)}+ yr customer`)
    return { ...a, monthly, since, reasons, score }
  }).sort((a, b) => b.score - a.score)

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, marginTop: 24, background: '#FBFCFE' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{ border: '1px solid #1B3A6B', background: '#fff', color: '#1B3A6B', fontWeight: 600, fontSize: 13, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
          {open ? 'Hide win-back list' : '↩️ Win back lapsed plans'}
        </button>
        {open && rows != null && <span style={{ fontSize: 12.5, color: 'var(--mist)', marginLeft: 'auto' }}>{ranked.length} lapsed plan{ranked.length === 1 ? '' : 's'}, best odds first</span>}
      </div>

      {open && (
        rows == null ? <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>Finding lapsed plans…</p> : ranked.length === 0 ? (
          <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>No lapsed plans — nothing to win back right now.</p>
        ) : (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ranked.slice(0, 50).map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #EEF2F8' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.customers?.display_name || 'Customer'} <span style={{ fontWeight: 400, color: 'var(--mist)' }}>· {a.tier?.name || 'Plan'}</span></div>
                  <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{a.reasons.join(' · ')}</div>
                </div>
                <AiAssist compact label="AI win-back" title={'Win-back · ' + (a.customers?.display_name || 'Customer')}
                  system={WINBACK_SYS}
                  prompt="Draft a short, honest win-back message inviting this customer to restart their lapsed maintenance plan."
                  context={{ customer: a.customers?.display_name, plan: a.tier?.name, lapsed_days_ago: a.since, monthly_value: a.monthly }} />
              </div>
            ))}
            {ranked.length > 50 && <div style={{ fontSize: 12, color: 'var(--mist)' }}>Showing top 50 of {ranked.length}.</div>}
          </div>
        )
      )}
    </div>
  )
}
