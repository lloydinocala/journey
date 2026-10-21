// Payouts — the money on its way from Stripe to your bank.
//   • What's on the way: available balance, pending (not yet available) and instant-eligible.
//   • Pending payments: card/bank payments still clearing, matched to Journey jobs + customers.
//   • Payouts: every deposit Stripe has sent (Standard / Instant), click one to see what's in it.
//   • Payout settings: bank account, debit card, schedule and verification on file.
// Read-only: each company's Stripe account is its own, so bank / card changes are made in Stripe.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const money = (n) => (n == null || isNaN(n) ? '—' : (n < 0 ? '-' : '') + '$' + Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const day = (unix) => (unix ? new Date(unix * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
const STATUS = {
  paid: ['Deposited', '#E3F1E8', '#166534'], in_transit: ['On the way', '#E8F0FB', '#1D4ED8'], pending: ['Scheduled', '#F8EEDD', '#B0600A'],
  failed: ['Failed', '#FBE7E7', '#B00020'], canceled: ['Canceled', '#EEF1F6', '#475569'],
}
const DOW = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' }
function scheduleText(s) {
  if (!s) return '—'
  if (s.interval === 'manual') return 'Manual — you start each payout in Stripe'
  const lag = s.delay_days != null ? ` · funds available ${s.delay_days} day${s.delay_days === 1 ? '' : 's'} after payment` : ''
  if (s.interval === 'daily') return 'Every business day' + lag
  if (s.interval === 'weekly') return `Weekly on ${DOW[s.weekly_anchor] || s.weekly_anchor}` + lag
  if (s.interval === 'monthly') return `Monthly on day ${s.monthly_anchor}` + lag
  return s.interval
}

export default function Payouts({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [orgId, setOrgId] = useState(profile?.org_id || '')
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [method, setMethod] = useState('standard')
  const [open, setOpen] = useState(null)           // payout id expanded
  const [detail, setDetail] = useState({})         // payout id -> transactions | 'loading' | {error}
  const [showSettings, setShowSettings] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || []); if (!orgId && data?.length) setOrgId(data[0].id)
    })
  }, [])

  async function call(body) {
    const { data, error } = await supabase.functions.invoke('stripe-payouts', { body: { ...body, orgId } })
    if (error || data?.error) {
      let msg = data?.error
      if (!msg && error?.context?.json) { try { msg = (await error.context.json()).error } catch (e) { /* ignore */ } }
      throw new Error(msg || error?.message || 'Could not reach Stripe')
    }
    return data
  }
  async function load() {
    if (!orgId) return
    setLoading(true); setErr(''); setOpen(null); setDetail({})
    try { setD(await call({ action: 'summary' })) } catch (e) { setErr(e.message); setD(null) }
    setLoading(false)
  }
  useEffect(() => { load() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(p) {
    if (open === p.id) { setOpen(null); return }
    setOpen(p.id)
    if (detail[p.id]) return
    setDetail((x) => ({ ...x, [p.id]: 'loading' }))
    try { const r = await call({ action: 'payout', payoutId: p.id }); setDetail((x) => ({ ...x, [p.id]: r.transactions })) }
    catch (e) { setDetail((x) => ({ ...x, [p.id]: { error: e.message } })) }
  }

  const tile = { flex: '1 1 200px', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: '#fff' }
  const s = d?.settings
  const list = (d?.payouts || []).filter((p) => (method === 'instant' ? p.method === 'instant' : p.method !== 'instant'))
  const shown = showAll ? list : list.slice(0, 12)

  return (
    <div className="page">
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Payouts</h2>
          {isSuper && <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="logout-button" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
          {d?.connected && <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowSettings(true)}>Payout settings</button>}
        </div>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 820 }}>
        Money from card and bank payments on its way to your bank account. Payments clear first, then Stripe deposits them on your payout schedule. Click a payout to see exactly which payments are in it.
      </p>
      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      {loading && !d ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : d && !d.connected ? (
        <div className="section-card" style={{ padding: 20, maxWidth: 560 }}>
          <b>Card payments aren't connected yet.</b>
          <p style={{ color: 'var(--mist)', fontSize: 13.5 }}>Connect your Stripe account to take card and bank payments — payouts show here once it's set up.</p>
          <Link to="/settings?section=financials" className="auth-button" style={{ display: 'inline-block', width: 'auto' }}>Connect payments</Link>
        </div>
      ) : d && (
        <>
          {s && (!s.payouts_enabled || s.past_due > 0 || s.currently_due > 0) && (
            <div style={{ background: '#FBE7E7', border: '1px solid #F0B4B4', color: '#8A1C1C', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13.5 }}>
              <b>Stripe needs something from you{s.payouts_enabled ? '' : ' — payouts are paused'}.</b> {s.past_due + s.currently_due} item{s.past_due + s.currently_due === 1 ? '' : 's'} to complete (identity or business details). Sign in to your Stripe dashboard to finish.
              {' '}<a href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer">Open Stripe ↗</a>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={tile}><div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Clearing (pending)</div><div style={{ fontSize: 24, fontWeight: 800 }}>{money(d.balance.pending)}</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>Recent payments not yet available</div></div>
            <div style={tile}><div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Ready for next payout</div><div style={{ fontSize: 24, fontWeight: 800 }}>{money(d.balance.available)}</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>{scheduleText(s?.schedule)}</div></div>
            {d.balance.instant_available > 0 && <div style={tile}><div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Available instantly</div><div style={{ fontSize: 24, fontWeight: 800 }}>{money(d.balance.instant_available)}</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>Instant payout from Stripe (Stripe charges a fee)</div></div>}
          </div>

          {/* Pending payments */}
          <div className="section-card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 6px', fontWeight: 800, fontSize: 15 }}>Payments clearing <span className="badge">{d.pending.length}</span></div>
            {!d.pending.length ? <p style={{ color: 'var(--mist)', padding: '0 16px 14px', margin: 0, fontSize: 13.5 }}>Nothing clearing right now — every payment has reached your balance.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead><tr><th>Paid</th><th>Method</th><th>Job #</th><th>Customer</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Fee</th><th style={{ textAlign: 'right' }}>You get</th><th>Available</th></tr></thead>
                  <tbody>
                    {d.pending.map((t) => (
                      <tr key={t.id}>
                        <td>{day(t.created)}</td><td>{t.method || t.type}</td>
                        <td>{t.job_id ? <Link to={`/jobs?job=${t.job_id}`}>{t.job_number}</Link> : (t.invoice_number || '—')}</td>
                        <td>{t.customer || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{money(t.amount)}</td><td style={{ textAlign: 'right', color: 'var(--mist)' }}>{money(-t.fee)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(t.net)}</td><td>{day(t.available_on)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payouts */}
          <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px 8px', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Deposits to your bank</div>
              <div style={{ display: 'inline-flex', background: '#EEF1F6', borderRadius: 999, padding: 3 }}>
                {[['standard', 'Standard'], ['instant', 'Instant']].map(([k, l]) => (
                  <button key={k} onClick={() => { setMethod(k); setShowAll(false) }} style={{ border: 'none', borderRadius: 999, padding: '5px 14px', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: method === k ? '#fff' : 'transparent', color: method === k ? '#101418' : 'var(--mist)', boxShadow: method === k ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>{l}</button>
                ))}
              </div>
            </div>
            {!list.length ? <p style={{ color: 'var(--mist)', padding: '0 16px 14px', margin: 0, fontSize: 13.5 }}>No {method} payouts yet.</p> : (
              <table className="data-table" style={{ margin: 0 }}>
                <thead><tr><th>Arrives</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th><th /></tr></thead>
                <tbody>
                  {shown.map((p) => {
                    const [label, bg, c] = STATUS[p.status] || [p.status, '#EEF1F6', '#475569']
                    const det = detail[p.id]
                    return [
                      <tr key={p.id} onClick={() => toggle(p)} style={{ cursor: 'pointer' }}>
                        <td>{day(p.arrival_date)}</td>
                        <td><span className="badge" style={{ background: bg, color: c }}>{label}</span>{p.failure && <span style={{ fontSize: 12, color: '#B00020', marginLeft: 6 }}>{p.failure}</span>}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(p.amount)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--mist)', width: 30 }}>{open === p.id ? '▴' : '▾'}</td>
                      </tr>,
                      open === p.id && (
                        <tr key={p.id + ':d'}><td colSpan="4" style={{ background: '#F8FAFC', padding: '8px 16px' }}>
                          {det === 'loading' ? <span style={{ color: 'var(--mist)' }}>Loading…</span> : det?.error ? <span className="auth-error">{det.error}</span> : !det?.length ? <span style={{ color: 'var(--mist)' }}>No itemized payments for this payout.</span> : (
                            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                              <tbody>
                                {det.map((t) => (
                                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '5px 8px 5px 0' }}>{day(t.created)}</td>
                                    <td style={{ padding: '5px 8px' }}>{t.type}{t.method ? ` · ${t.method}` : ''}</td>
                                    <td style={{ padding: '5px 8px' }}>{t.job_id ? <Link to={`/jobs?job=${t.job_id}`}>Job {t.job_number}</Link> : t.invoice_number || ''}</td>
                                    <td style={{ padding: '5px 8px' }}>{t.customer || t.description || ''}</td>
                                    <td style={{ padding: '5px 0', textAlign: 'right' }}>{money(t.amount)} <span style={{ color: 'var(--mist)' }}>({money(-t.fee)} fee)</span> → <b>{money(t.net)}</b></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td></tr>
                      ),
                    ]
                  })}
                </tbody>
              </table>
            )}
            {list.length > 12 && <div style={{ padding: 10, textAlign: 'center' }}><button className="logout-button" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show fewer' : `See all ${list.length}`}</button></div>}
          </div>
        </>
      )}

      {/* Payout settings side panel */}
      {showSettings && s && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)} style={{ justifyContent: 'flex-end', alignItems: 'stretch' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(400px, 100%)', background: '#fff', height: '100%', overflowY: 'auto', boxShadow: '-6px 0 24px rgba(0,0,0,.15)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Payout settings</h3>
              <button className="logout-button" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <Section title="Standard payouts" note="Card payments usually reach your bank in about 2 business days; bank (ACH) payments take longer.">
              <Row icon="🏦" main={s.bank ? s.bank.name : (s.external_visible ? 'No bank account on file' : 'Bank account on file in Stripe')} sub={s.bank ? `•••• ${s.bank.last4}` : 'Not shared with Journey'} />
              <Row icon="📅" main="Schedule" sub={scheduleText(s.schedule)} />
            </Section>
            <Section title="Instant payouts" note="Sent to a debit card in minutes, for a fee charged by Stripe.">
              <Row icon="⚡" main={s.debit_card ? `${s.debit_card.brand} debit card` : 'No debit card on file'} sub={s.debit_card ? `•••• ${s.debit_card.last4}${s.debit_card.instant ? '' : ' · not eligible for instant'}` : 'Add one in Stripe to use instant payouts'} />
            </Section>
            <Section title="Identity verification">
              <Row icon={s.payouts_enabled && !s.past_due ? '✅' : '⚠️'} main={s.payouts_enabled && !s.past_due ? 'Verified' : 'Action needed'}
                sub={[s.business, s.account_type ? `Account type: ${s.account_type}` : null, s.currently_due + s.past_due ? `${s.currently_due + s.past_due} item(s) to complete` : null].filter(Boolean).join(' · ')} />
            </Section>
            <div style={{ fontSize: 12.5, color: 'var(--mist)', margin: '14px 0' }}>
              Your Stripe account belongs to your company. To change the bank account, add a debit card, turn on instant payouts or change the schedule, sign in to Stripe — the change shows here automatically.
            </div>
            <a href="https://dashboard.stripe.com/settings/payouts" target="_blank" rel="noreferrer" className="auth-button" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Change in Stripe ↗</a>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, note, children }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '14px 0' }}>
      <div style={{ fontWeight: 800 }}>{title}</div>
      {note && <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 8 }}>{note}</div>}
      {children}
    </div>
  )
}
function Row({ icon, main, sub }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '6px 0' }}>
      <span style={{ fontSize: 18, width: 24 }}>{icon}</span>
      <div><div style={{ fontWeight: 600 }}>{main}</div>{sub && <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{sub}</div>}</div>
    </div>
  )
}
