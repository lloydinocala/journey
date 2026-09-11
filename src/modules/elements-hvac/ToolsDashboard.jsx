// Tools Management · Dashboard (module landing)
// At-a-glance tool health — where tools are, what's flagged, what's in the shop —
// plus the QuincyAI briefing scoped to tools. Enable toggle lives here too.
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toolsDashboardData, getToolsSettings, upsertToolsSettings } from './toolsData'
import { useOrgSelector, OrgBar, EnabledPill } from './shared'
import { can } from '../../utils/permissions'
import StationShell, { StationKpi } from '../../StationShell'
import { useSignals } from '../../signals/useSignals'
import QuincyBrief from '../../QuincyBrief'

const money0 = (n) => (n == null || isNaN(n) ? '—' : `$${Math.round(Number(n)).toLocaleString()}`)

const CARDS = [
  { path: '/tools/catalog', title: 'Tool Catalog', desc: 'Add tools, assign to trucks/techs, inspect, and see each tool’s history.' },
  { path: '/tools/orders', title: 'Orders & Receipts', desc: 'Record PO orders, card purchases, and rentals — Quincy can read a receipt.' },
  { path: '/tools/reconcile', title: 'Reconcile', desc: 'Match card purchases to your bank statement — no PO needed.' },
  { path: '/tools/maintenance', title: 'Maintenance', desc: 'Tools in the shop for repair — record and verify work before redeploying.' },
]

export default function ToolsDashboard({ profile }) {
  const org = useOrgSelector(profile)
  const [d, setD] = useState(null)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savingEnable, setSavingEnable] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [data, s] = await Promise.all([toolsDashboardData(org.selectedOrg), getToolsSettings(org.selectedOrg)])
    setD(data); setEnabled(!!s?.enabled); setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  async function toggleEnabled() {
    setSavingEnable(true)
    await upsertToolsSettings(org.selectedOrg, { enabled: !enabled })
    setEnabled((e) => !e); setSavingEnable(false)
  }

  const Metric = ({ to, label, value, sub, accent, alert }) => (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        border: `1px solid ${alert ? '#E3B0B0' : 'var(--line, #E2E8F0)'}`,
        background: alert ? '#FCEFEF' : '#FBFCFE',
        borderRadius: 12, padding: '14px 16px', height: '100%',
      }}>
        <div style={{ fontSize: 12, color: 'var(--mist)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: accent || '#132A4C', marginTop: 4 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 4, minHeight: 16 }}>{sub}</div>
      </div>
    </Link>
  )

  const flaggedAlert = !!d && d.flaggedCount > 0
  const nav = useNavigate()
  const sig = useSignals({ station: 'tools' }, org.selectedOrg, nav)
  const isSuper = profile?.role === 'super_admin'
  const opsAdmin = isSuper || can(profile, 'view_operational_metrics')
  const ownerAdmin = isSuper || can(profile, 'view_owner_metrics')
  const toolSub = sig.loading ? 'Checking tools…' : sig.total > 0 ? (<>Tools needing attention — <b style={{ color: 'inherit' }}>{sig.total}</b> across {sig.needing.length} area{sig.needing.length === 1 ? '' : 's'}.</>) : "Every tool is in service or accounted for."
  const toolOwnerCards = d ? <StationKpi label="Tool value on hand" big={money0(d.totalCost)} sub="total purchase cost" tone="opp" onClick={() => nav('/tools/catalog')} /> : null
  const toolOpsCards = d ? (<>
    <StationKpi label="In the shop" big={String(d.inShop)} sub="available to deploy" onClick={() => nav('/tools/catalog')} />
    <StationKpi label="In maintenance" big={String(d.inMaintenance)} sub="in the shop for repair" tone={d.inMaintenance > 0 ? 'alert' : undefined} onClick={() => nav('/tools/maintenance')} />
  </>) : null

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Tools Dashboard</h2>
          <EnabledPill enabled={enabled} />
        </div>
        <button className="logout-button" style={{ margin: 0 }} disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      <OrgBar {...org} />

      <div style={{ margin: '12px 0 16px' }}>
        <QuincyBrief kind="tools" context={{
          totalTools: d ? d.total : 0,
          inShop: d ? d.inShop : 0,
          onTrucksOrTechs: d ? d.assigned : 0,
          inMaintenance: d ? d.inMaintenance : 0,
          flaggedNeedsMaintenance: d ? d.flaggedCount : 0,
          openMaintenanceRecords: d ? d.openMaintenanceCount : 0,
          followUpNeeded_pastAnticipatedReturn: d ? d.followUpCount : 0,
          followUpTools: d ? d.followUp.map((f) => ({ tool: f.label, expectedReturn: f.expected, daysLate: f.daysLate })) : [],
          rentalsOverdue: d ? d.rentalsOverdueCount : 0,
          overdueRentals: d ? d.rentalsOverdue.map((r) => ({ vendor: r.vendor, dueBack: r.due, daysLate: r.daysLate })) : [],
          cardChargesAwaitingReceiptMatch: d ? d.unreconciledChargeCount : 0,
          toolsOnOrder_awaitingReceipt: d ? d.onOrderCount : 0,
        }} />
      </div>

      {!enabled && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', padding: '10px 14px', borderRadius: 10, marginBottom: 18, fontSize: 14 }}>
          Tools &amp; Office Equipment Management is currently <strong>disabled</strong> for this organization.{' '}
          <button onClick={toggleEnabled} disabled={savingEnable} style={{ color: '#9A3412', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            {savingEnable ? 'Enabling…' : 'Enable it'}
          </button>{' '}to start tracking tools.
        </div>
      )}

      <div style={{ margin: '4px 0 24px' }}>
        <StationShell
          eyebrow="Tools Station"
          officeTitle="Your tools & equipment tasks"
          adminTitle="Tools health"
          officeSubtitle={toolSub}
          loading={sig.loading}
          signals={sig.signals}
          opsAdmin={opsAdmin} ownerAdmin={ownerAdmin}
          opsCards={toolOpsCards} ownerCards={toolOwnerCards}
          emptyHint="Nothing flagged, no overdue returns, and orders are current."
        />
      </div>

      {/* Follow-up needed — past anticipated return-to-service date */}
      {d && d.followUp.length > 0 && (
        <div style={{ border: '1px solid #E3B0B0', background: '#FCEFEF', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontWeight: 800, color: '#B00020', marginBottom: 8 }}>Follow-up needed — overdue return to service</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.followUp.map((f) => (
              <div key={f.id} style={{ fontSize: 14 }}>
                {f.label} <span style={{ color: 'var(--mist)' }}>· due back {new Date(f.expected).toLocaleDateString()} · {f.daysLate} day{f.daysLate === 1 ? '' : 's'} late</span>
              </div>
            ))}
          </div>
          <Link to="/tools/maintenance" style={{ color: '#B00020', fontWeight: 700, fontSize: 13, marginTop: 10, display: 'inline-block' }}>Go to Maintenance →</Link>
        </div>
      )}

      {/* Rentals overdue for return */}
      {d && d.rentalsOverdue.length > 0 && (
        <div style={{ border: '1px solid #E3B0B0', background: '#FCEFEF', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontWeight: 800, color: '#B00020', marginBottom: 8 }}>Rentals overdue for return</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.rentalsOverdue.map((r) => (
              <div key={r.id} style={{ fontSize: 14 }}>
                {r.vendor} <span style={{ color: 'var(--mist)' }}>· due back {new Date(r.due).toLocaleDateString()} · {r.daysLate} day{r.daysLate === 1 ? '' : 's'} late</span>
              </div>
            ))}
          </div>
          <Link to="/tools/orders" style={{ color: '#B00020', fontWeight: 700, fontSize: 13, marginTop: 10, display: 'inline-block' }}>Go to Orders &amp; Receipts →</Link>
        </div>
      )}

      {/* Flagged list */}
      {d && d.flagged.length > 0 && (
        <div style={{ border: '1px solid #E3B0B0', background: '#FCEFEF', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontWeight: 800, color: '#B00020', marginBottom: 8 }}>Flagged for maintenance</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.flagged.map((t) => (
              <div key={t.id} style={{ fontSize: 14 }}>
                {t.label} <span style={{ color: 'var(--mist)' }}>· {t.status === 'in_maintenance' ? 'in the shop' : 'still deployed — pull it in'}</span>
              </div>
            ))}
          </div>
          <Link to="/tools/maintenance" style={{ color: '#B00020', fontWeight: 700, fontSize: 13, marginTop: 10, display: 'inline-block' }}>Go to Maintenance →</Link>
        </div>
      )}

      {/* Navigation cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {CARDS.map((c) => (
          <Link key={c.path} to={c.path} style={{ textDecoration: 'none' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 18, height: '100%' }}>
              <div style={{ fontWeight: 700, color: '#1B3A6B', marginBottom: 6 }}>{c.title}</div>
              <div style={{ color: 'var(--mist)', fontSize: 13 }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
