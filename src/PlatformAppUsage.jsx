import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Distribution & Usage (Journey Platform, super admin only) — how well each subscriber is getting the
// Customer Portal app into customers' hands, and how those customers use it, overall and company by company.
// Funnel: active customers → portal logins → signed in → store app → choices saved → phones registered.
// Counts only: no customer names (each company's own customer-by-customer list is App Customers).
// REPORT ONLY: nothing here contacts a subscriber or changes their settings. Data: platform_app_usage().

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null)
const pctText = (n, d) => { const p = pct(n, d); return p == null ? '—' : `${p}%` }
const daysSince = (ts) => (ts ? (Date.now() - new Date(ts).getTime()) / 86400e3 : null)

function flagsFor(r) {
  const f = []
  const adoption = pct(r.portal_customers, r.active_customers)
  const live = r.billing_status !== 'canceled'
  if (r.push_suspended) f.push(['urgent', 'Customer app messages are suspended for this company'])
  if (r.phone_problems > 0) f.push(['urgent', `${r.phone_problems} customer${r.phone_problems === 1 ? "'s phone" : "s' phones"} couldn't register for notifications (see App Customers)`])
  if (live && r.active_customers >= 25 && r.portal_customers === 0) f.push(['warning', `None of ${r.active_customers.toLocaleString()} active customers has a portal login yet`])
  else if (live && r.active_customers >= 25 && adoption != null && adoption < 10 && (daysSince(r.first_login) ?? 0) >= 14) f.push(['warning', `Low distribution: only ${adoption}% of active customers have a portal login`])
  if (r.portal_customers - r.ever_signed_in > 0) f.push(['info', `${r.portal_customers - r.ever_signed_in} login${r.portal_customers - r.ever_signed_in === 1 ? ' was' : 's were'} created but never signed in`])
  if (r.ever_signed_in > 0 && r.choices_saved < r.ever_signed_in) f.push(['info', `${r.ever_signed_in - r.choices_saved} signed in but never saved notification choices`])
  if (r.portal_customers > 0 && r.phones === 0) f.push(['warning', 'No customer\'s phone gets notifications yet'])
  if (r.portal_customers > 0 && !r.texting_ready) f.push(['warning', 'No texting number: booking confirmations and feedback texts can\'t go out'])
  if (r.portal_customers > 0 && !r.email_ready) f.push(['info', 'Email sender not verified: invoices and office emails can\'t go out'])
  if (r.pushes_failed > 0) f.push(['warning', `${r.pushes_failed} notification${r.pushes_failed === 1 ? '' : 's'} failed to deliver`])
  if (r.browser_only > 0) f.push(['info', `${r.browser_only} customer${r.browser_only === 1 ? ' uses' : 's use'} a web browser, not the store app (no notifications)`])
  return f
}
const COLOR = { urgent: '#B42318', warning: '#B45309', info: '#1D5FA8' }
const BG = { urgent: '#FDECEC', warning: '#FFF6E5', info: '#EAF2FB' }
const ago = (ts) => {
  if (!ts) return 'never'
  const h = (Date.now() - new Date(ts).getTime()) / 3600e3
  return h < 1 ? 'within the hour' : h < 48 ? `${Math.round(h)} hr ago` : `${Math.round(h / 24)} days ago`
}

// One funnel row: steps with counts and the share of the step before.
function Funnel({ r }) {
  const steps = [
    ['Active customers', r.active_customers, null],
    ['Portal logins', r.portal_customers, r.active_customers],
    ['Signed in', r.ever_signed_in, r.portal_customers],
    ['Used the store app', r.store_app_users, r.ever_signed_in],
    ['Saved notification choices', r.choices_saved, r.ever_signed_in],
    ['Phones registered', r.phones, r.ever_signed_in],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, margin: '10px 0' }}>
      {steps.map(([label, n, of], i) => (
        <div key={label} style={{ background: 'var(--ink, #F4F6FA)', borderRadius: 8, padding: '8px 10px', borderLeft: `4px solid ${i === 0 ? '#94A3B8' : '#215F9A'}` }}>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{Number(n || 0).toLocaleString()}</div>
          <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{label}</div>
          {of != null && <div style={{ fontSize: 12, color: '#215F9A', fontWeight: 700 }}>{pctText(n, of)} of previous</div>}
        </div>
      ))}
    </div>
  )
}

export default function PlatformAppUsage({ profile }) {
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showCanceled, setShowCanceled] = useState(false)
  const [onlyFlagged, setOnlyFlagged] = useState(false)

  useEffect(() => { load() }, [days])
  async function load() {
    setLoading(true); setErr('')
    const { data, error } = await supabase.rpc('platform_app_usage', { p_days: days })
    if (error) setErr(error.message); else setRows(data || [])
    setLoading(false)
  }

  if (profile?.role !== 'super_admin') return <div><div className="page-title">Distribution & Usage</div><p>This page is for Journey Platform only.</p></div>

  const base = rows.filter((r) => showCanceled || r.billing_status !== 'canceled').map((r) => ({ ...r, flags: flagsFor(r) }))
  const list = base.filter((r) => !onlyFlagged || r.flags.some(([s]) => s !== 'info'))
  const sum = (k) => base.reduce((t, r) => t + Number(r[k] || 0), 0)
  const overall = {
    active_customers: sum('active_customers'), portal_customers: sum('portal_customers'), ever_signed_in: sum('ever_signed_in'),
    store_app_users: sum('store_app_users'), choices_saved: sum('choices_saved'), phones: sum('phones'),
  }
  const stat = (n, label) => <div style={{ minWidth: 110 }}><div style={{ fontSize: 18, fontWeight: 800 }}>{n}</div><div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{label}</div></div>

  return (
    <div>
      <div className="page-title">Distribution & Usage</div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 0 }}>
        How well each subscriber is getting the Customer Portal app to its customers, and how those customers use it. Counts only; each company's own customer-by-customer list is in <Link to="/app-customers">App Customers</Link>. Report only: nothing here contacts a subscriber. Store-app use is tracked from Nov 27, 2026.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, fontSize: 14 }}>
        <label>Activity in the last&nbsp;
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
            {[7, 30, 90, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> Only companies needing attention</label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={showCanceled} onChange={(e) => setShowCanceled(e.target.checked)} /> Show canceled</label>
        <button type="button" className="btn" onClick={load}>Refresh</button>
      </div>

      <div className="section-card" style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>All companies <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--mist)' }}>· {base.length} compan{base.length === 1 ? 'y' : 'ies'}</span></div>
        <Funnel r={overall} />
        <div style={{ fontSize: 13.5 }}>Overall distribution: <b>{pctText(overall.portal_customers, overall.active_customers)}</b> of active customers have a portal login.</div>
      </div>

      {err && <p style={{ color: '#B42318' }}>{err}</p>}
      {loading ? <p>Loading…</p> : !list.length ? <p style={{ color: 'var(--mist)' }}>Nothing to show.</p> : list.map((r) => (
        <div key={r.org_id} className="section-card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{r.org_name} <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--mist)' }}>· {r.billing_status}</span></div>
            <div style={{ fontSize: 13, color: 'var(--mist)' }}>Last app open: {ago(r.last_portal_open)}</div>
          </div>
          <Funnel r={r} />
          {r.flags.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '8px 0' }}>
              {r.flags.map(([sev, text]) => <div key={text} style={{ fontSize: 13.5, color: COLOR[sev], background: BG[sev], borderRadius: 6, padding: '5px 9px' }}>{text}</div>)}
            </div>
          )}
          <div style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--mist)', margin: '12px 0 4px' }}>Usage, last {days} days</div>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            {stat(r.portal_new, 'new portal logins')}
            {stat(r.signed_in_recent, 'signed in')}
            {stat(r.bookings, 'portal bookings')}
            {stat(r.filter_orders + (r.autoships ? ` + ${r.autoships}` : ''), r.autoships ? 'filter orders + auto-ships' : 'filter orders')}
            {stat(r.pushes_sent, 'notifications delivered')}
            {stat(r.campaigns, 'messages sent by office')}
            {stat(r.feedback_sent ? `${r.feedback_answered} of ${r.feedback_sent}` : r.feedback_answered, 'feedback answered')}
            {r.feedback_avg != null && stat(`${r.feedback_avg} ★`, 'feedback rating')}
            {stat(`${r.allow_service} / ${r.allow_greetings} / ${r.allow_news}`, 'allow Service / Goodwill / Optional')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 10 }}>
            Texting {r.texting_ready ? '✓ ready' : '✗ no number'} · Email {r.email_ready ? '✓ verified' : '✗ not verified'} · <Link to="/app-customers">App Customers</Link> (pick this company) · <Link to="/app-feedback">App Feedback</Link>
          </div>
        </div>
      ))}
    </div>
  )
}
