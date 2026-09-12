import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { can } from './utils/permissions'
import OrgPicker from './OrgPicker'
import QuincyBrief from './QuincyBrief'
import CustomKpis from './CustomKpis'

const BRAND = '#176E7A', FAINT = '#98A2AD'
const C = {
  green: '#2E7D52', greenBg: '#EAF3EC', greenLn: '#CADFCF',
  amber: '#B45309', amberBg: '#FBF3E2', amberLn: '#EAD8A8',
  orange: '#C2510C', orangeBg: '#FBEEE2', orangeLn: '#EEcCA6',
  red: '#B5462F', redBg: '#FBECE8', redLn: '#EAC5BC',
  teal: '#176E7A', tealBg: '#E7F0F1', tealLn: '#BCD7D9',
  blue: '#2F5DE3', blueBg: '#E9EEFB', blueLn: '#C6D3F5',
  slate: '#64748B', slateBg: '#EEF1F5', slateLn: '#D7DEE7',
  ink: '#1C2430',
}
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString()
const money1k = (n) => { n = Number(n) || 0; return Math.abs(n) >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + Math.round(n) }

export default function FinancialsDashboard({ profile }) {
  const nav = useNavigate()
  const isSuper = profile?.role === 'super_admin'
  const allowed = isSuper || can(profile, 'view_financials_dashboard')
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [isSuper])
  useEffect(() => { if (allowed && selectedOrg) load(); else setLoading(false) }, [allowed, selectedOrg]) // eslint-disable-line

  async function load() {
    setLoading(true)
    const org = selectedOrg
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const sixMoStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const [invRes, payRes, agrRes] = await Promise.all([
      supabase.from('invoices').select('kind, sent_at, paid_at, invoice_date, job_total, amount_due, total_paid, balance, profit, bills_to_customer_id, approval_status, is_filter_order, spawned_job_id, converted_to_job_id')
        .eq('org_id', org).is('deleted_at', null).eq('is_archived', false),
      supabase.from('invoice_payments').select('amount, recorded_at').eq('org_id', org).gte('recorded_at', sixMoStart.toISOString()),
      supabase.from('maintenance_agreements').select('price, billing_cycle, status').eq('org_id', org).eq('is_archived', false),
    ])
    const inv = invRes.data || [], pays = payRes.data || [], agr = agrRes.data || []
    const custIds = [...new Set(inv.filter((i) => i.kind === 'invoice').map((i) => i.bills_to_customer_id).filter(Boolean))]
    const { data: custs } = custIds.length ? await supabase.from('customers').select('id, display_name').in('id', custIds) : { data: [] }
    const custById = Object.fromEntries((custs || []).map((c) => [c.id, c.display_name]))

    const bal = (i) => { const b = Number(i.balance); return Number.isFinite(b) && b !== 0 ? b : (Number(i.amount_due || 0) - Number(i.total_paid || 0)) }
    const days = (dt) => Math.floor((now - new Date(dt)) / 86400000)
    const inMonth = (dt, ms) => { const x = new Date(dt); return x >= ms && x < new Date(ms.getFullYear(), ms.getMonth() + 1, 1) }

    // A/R + aging
    const unpaid = inv.filter((i) => i.kind === 'invoice' && !i.is_filter_order && i.sent_at && !i.paid_at && bal(i) > 0.5)
    const aging = [
      { key: 'current', label: 'Current (0\u201330d)', color: C.green, bg: C.greenBg, ln: C.greenLn, amt: 0, n: 0 },
      { key: 'b30', label: '31\u201360 days', color: C.amber, bg: C.amberBg, ln: C.amberLn, amt: 0, n: 0 },
      { key: 'b60', label: '61\u201390 days', color: C.orange, bg: C.orangeBg, ln: C.orangeLn, amt: 0, n: 0 },
      { key: 'b90', label: '90+ days', color: C.red, bg: C.redBg, ln: C.redLn, amt: 0, n: 0 },
    ]
    unpaid.forEach((i) => { const dd = days(i.sent_at); const b = bal(i); const k = dd <= 30 ? 0 : dd <= 60 ? 1 : dd <= 90 ? 2 : 3; aging[k].amt += b; aging[k].n += 1 })
    const arTotal = unpaid.reduce((s, i) => s + bal(i), 0)
    const overdue = aging[3].amt + aging[2].amt

    // collected / billed
    const collected = (since) => pays.filter((p) => new Date(p.recorded_at) >= since).reduce((s, p) => s + Number(p.amount || 0), 0)
    const collected30 = collected(new Date(now - 30 * 86400000))
    const collectedMTD = collected(monthStart)
    const paidInv = inv.filter((i) => i.kind === 'invoice' && !i.is_filter_order)
    const billedMTD = paidInv.filter((i) => i.invoice_date && inMonth(i.invoice_date, monthStart)).reduce((s, i) => s + Number(i.job_total || i.amount_due || 0), 0)

    // estimates $
    const estOut = inv.filter((i) => i.kind === 'estimate' && i.sent_at && (String(i.approval_status || '').toLowerCase() === 'pending' || !i.approval_status)).reduce((s, i) => s + Number(i.job_total || 0), 0)
    const estApproved = inv.filter((i) => i.kind === 'estimate' && String(i.approval_status || '').toLowerCase() === 'approved' && !i.spawned_job_id && !i.converted_to_job_id).reduce((s, i) => s + Number(i.job_total || 0), 0)

    // recurring revenue (MRR) from active agreements
    const active = agr.filter((a) => !['canceled', 'cancelled', 'expired'].includes(String(a.status || '').toLowerCase()))
    const mrr = active.reduce((s, a) => s + (String(a.billing_cycle || '').toLowerCase() === 'annual' ? Number(a.price || 0) / 12 : Number(a.price || 0)), 0)

    // margin MTD
    const profitMTD = paidInv.filter((i) => i.invoice_date && inMonth(i.invoice_date, monthStart)).reduce((s, i) => s + Number(i.profit || 0), 0)
    const marginPct = billedMTD > 0 ? (profitMTD / billedMTD) * 100 : null

    // top accounts to chase
    const byCust = {}
    unpaid.forEach((i) => { const c = i.bills_to_customer_id || '—'; if (!byCust[c]) byCust[c] = { amt: 0, oldest: 0 }; byCust[c].amt += bal(i); byCust[c].oldest = Math.max(byCust[c].oldest, days(i.sent_at)) })
    const topDebtors = Object.entries(byCust).map(([id, v]) => ({ id, ...v, name: custById[id] || 'Unknown' })).sort((a, b) => b.amt - a.amt).slice(0, 6)

    // 6-month collected vs billed
    const months = []
    for (let k = 5; k >= 0; k--) {
      const ms = new Date(now.getFullYear(), now.getMonth() - k, 1)
      const billed = paidInv.filter((i) => i.invoice_date && inMonth(i.invoice_date, ms)).reduce((s, i) => s + Number(i.job_total || i.amount_due || 0), 0)
      const coll = pays.filter((p) => inMonth(p.recorded_at, ms)).reduce((s, p) => s + Number(p.amount || 0), 0)
      months.push({ label: ms.toLocaleDateString('en-US', { month: 'short' }), billed, collected: coll })
    }

    setD({ arTotal, unpaidN: unpaid.length, aging, overdue, collected30, collectedMTD, billedMTD, estOut, estApproved, mrr, activeN: active.length, marginPct, profitMTD, topDebtors, months })
    setLoading(false)
  }

  if (!allowed) {
    return (
      <div style={{ padding: '48px 24px', maxWidth: 560 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, color: BRAND }}>Financials</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 10px' }}>Restricted</h2>
        <div style={{ background: C.slateBg, border: `1px solid ${C.slateLn}`, borderRadius: 12, padding: '16px 18px', fontSize: 14.5, color: C.ink, lineHeight: 1.5 }}>
          The Financials dashboard is limited to owners, department managers, and investors. If you should have access, ask an owner to grant the <b>Financials dashboard</b> permission to your tag under Roles &amp; Tags.
        </div>
      </div>
    )
  }

  const kpi = (label, value, sub, tone, onClick) => {
    const col = C[tone] || C.slate
    return (
      <div onClick={onClick} style={{ background: '#fff', border: '1px solid var(--border)', borderTop: `3px solid ${col}`, borderRadius: 12, padding: '14px 16px 13px', cursor: onClick ? 'pointer' : 'default', boxShadow: '0 1px 3px rgba(20,30,50,0.04)' }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, color: FAINT, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: col, margin: '4px 0 2px', letterSpacing: -0.5 }}>{value}</div>
        <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{sub}</div>
      </div>
    )
  }

  const maxMonth = d ? Math.max(1, ...d.months.map((m) => Math.max(m.billed, m.collected))) : 1
  const maxAge = d ? Math.max(1, ...d.aging.map((a) => a.amt)) : 1

  return (
    <div style={{ padding: '22px 24px 70px', maxWidth: 1040 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, color: BRAND }}>Financials</div>
          <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.5, margin: '4px 0 0' }}>Money in, money out</h2>
        </div>
        {isSuper && <div><div style={{ fontSize: 11.5, color: FAINT, marginBottom: 4, textAlign: 'right' }}>Organization</div><OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} /></div>}
      </div>

      {/* status banner + Quincy */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginTop: 14, padding: '11px 15px', borderRadius: 12, background: (d && d.overdue > 0) ? C.amberBg : C.tealBg, border: `1px solid ${(d && d.overdue > 0) ? C.amberLn : C.tealLn}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 999, background: '#fff', border: `1px solid ${(d && d.overdue > 0) ? C.amberLn : C.tealLn}`, color: (d && d.overdue > 0) ? C.amber : C.teal, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>{(d && d.overdue > 0) ? '!' : '\u2726'}</span>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: (d && d.overdue > 0) ? C.amber : C.teal }}>
            {loading ? 'Pulling the numbers\u2026' : !d ? 'No data yet.' : d.overdue > 0 ? `${money(d.overdue)} is 60+ days out \u2014 worth chasing first.` : 'Receivables are current \u2014 nothing badly overdue.'}
          </span>
        </div>
        <QuincyBrief kind="financials" org={selectedOrg} title="Financial briefing" />
      </div>

      {loading || !d ? (
        <div style={{ marginTop: 30, color: FAINT, fontSize: 14 }}>{loading ? 'Loading financials\u2026' : 'Select an organization to load its financials.'}</div>
      ) : (
        <>
          {/* KPI CARDS */}
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {kpi('A/R Outstanding', money(d.arTotal), `${d.unpaidN} unpaid invoice${d.unpaidN === 1 ? '' : 's'}`, d.arTotal > 0 ? 'red' : 'green', () => nav('/invoices'))}
            {kpi('Collected (30 days)', money(d.collected30), `${money(d.collectedMTD)} this month`, 'green')}
            {kpi('Billed this month', money(d.billedMTD), d.marginPct != null ? `${d.marginPct.toFixed(0)}% margin \u00b7 ${money(d.profitMTD)} profit` : 'revenue invoiced', 'blue')}
            {kpi('Recurring revenue', money(d.mrr) + '/mo', `${d.activeN} active agreement${d.activeN === 1 ? '' : 's'}`, 'teal')}
            {kpi('Estimates out', money(d.estOut), `${money(d.estApproved)} approved, not booked`, 'amber', () => nav('/estimates'))}
          </div>

          <CustomKpis org={selectedOrg} dashboard="financial" canManage={isSuper || can(profile, 'manage_kpis')} />

          <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
            {/* A/R AGING */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>A/R aging</h3>
                <span style={{ fontSize: 12.5, color: FAINT }}>{money(d.arTotal)} total</span>
              </div>
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: FAINT }}>How old the unpaid money is. Chase the red first.</p>
              {d.aging.map((a) => (
                <div key={a.key} style={{ marginBottom: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: a.color }}>{a.label}</span>
                    <span style={{ color: C.ink }}>{money(a.amt)} <span style={{ color: FAINT, fontSize: 12 }}>· {a.n}</span></span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: a.bg, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(a.amt > 0 ? 4 : 0, (a.amt / maxAge) * 100)}%`, height: '100%', background: a.color, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* COLLECTED VS BILLED */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Collected vs billed</h3>
                <span style={{ fontSize: 12, color: FAINT }}><span style={{ color: C.slate, fontWeight: 700 }}>▮</span> billed &nbsp;<span style={{ color: C.green, fontWeight: 700 }}>▮</span> collected</span>
              </div>
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: FAINT }}>Last 6 months — is cash keeping up with the work?</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150 }}>
                {d.months.map((m, idx) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, width: '100%', justifyContent: 'center' }}>
                      <div title={`Billed ${money(m.billed)}`} style={{ width: 14, height: `${Math.max(m.billed > 0 ? 3 : 0, (m.billed / maxMonth) * 100)}%`, background: C.slate, borderRadius: '3px 3px 0 0' }} />
                      <div title={`Collected ${money(m.collected)}`} style={{ width: 14, height: `${Math.max(m.collected > 0 ? 3 : 0, (m.collected / maxMonth) * 100)}%`, background: C.green, borderRadius: '3px 3px 0 0' }} />
                    </div>
                    <span style={{ fontSize: 11.5, color: FAINT }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TOP ACCOUNTS TO CHASE */}
          <div style={{ marginTop: 18, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Top accounts to chase</h3>
            <p style={{ margin: '0 0 12px', fontSize: 12.5, color: FAINT }}>Biggest balances owed, oldest first.</p>
            {d.topDebtors.length === 0 ? (
              <div style={{ background: C.greenBg, border: `1px solid ${C.greenLn}`, borderRadius: 10, padding: '13px 15px', fontSize: 13.5, color: C.green, fontWeight: 600 }}>Nothing outstanding — every invoice is paid.</div>
            ) : d.topDebtors.map((t) => {
              const tone = t.oldest > 90 ? C.red : t.oldest > 60 ? C.orange : t.oldest > 30 ? C.amber : C.green
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{t.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: tone, background: tone + '18', border: `1px solid ${tone}44`, borderRadius: 999, padding: '2px 9px' }}>{t.oldest}d</span>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: C.ink, minWidth: 76, textAlign: 'right' }}>{money(t.amt)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <p style={{ marginTop: 20, fontSize: 12, color: FAINT, maxWidth: 640 }}>
            More lands here as Bookkeeping comes online — full P&amp;L, cash-flow forecasting, and job-level profitability. For now these are the KPIs your live billing data supports.
          </p>
        </>
      )}
    </div>
  )
}
