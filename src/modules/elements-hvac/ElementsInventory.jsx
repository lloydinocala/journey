// Elements-HVAC · Inventory Dashboard (module landing)
// At-a-glance operational health — Low Stock, Open POs, Variance, Valuation —
// each card links to its full screen. Below that: identity stats and the
// navigation cards for the rest of the module.
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getSettings, listItems, listLocations, listMaps,
  listReplenishment, listPurchaseOrders, valuation, variance,
} from './data'
import { useOrgSelector, OrgBar, EnabledPill, DisabledNotice } from './shared'
import QuincyBrief from '../../QuincyBrief'
import { can } from '../../utils/permissions'
import StationShell, { StationKpi } from '../../StationShell'
import { useSignals } from '../../signals/useSignals'

const money0 = (n) => (n == null || isNaN(n) ? '—' : `$${Math.round(Number(n)).toLocaleString()}`)
const signed0 = (n) => {
  if (n == null || isNaN(n)) return '—'
  const num = Math.round(Number(n))
  return `${num > 0 ? '+$' : num < 0 ? '-$' : '$'}${Math.abs(num).toLocaleString()}`
}
const fmtDate = (s) => {
  if (!s) return null
  try { return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) } catch { return null }
}

const OPEN_PO = ['ordered', 'partial']

const CARDS = [
  { path: '/elements/locations', title: 'Locations', desc: 'Warehouses and trucks; assign a technician to each truck.' },
  { path: '/elements/items', title: 'Item Catalog', desc: 'Parts and consumables — description, cost, vendor, units.' },
  { path: '/elements/stock', title: 'Stock & Receiving', desc: 'On-hand by location; receive stock into the ledger.' },
  { path: '/elements/cycle-counts', title: 'Cycle Counts', desc: 'Count a location or category and post the adjustments.' },
  { path: '/elements/purchasing', title: 'Purchase Orders', desc: 'Draft, order, and receive against vendor POs.' },
  { path: '/elements/service-map', title: 'Service → Part Mapping', desc: 'Link pricebook parts to inventory parts so invoices deduct stock.' },
  { path: '/elements/settings', title: 'Inventory Settings', desc: 'Enable the module, issue-day, and reorder defaults.' },
]

export default function ElementsInventory({ profile }) {
  const org = useOrgSelector(profile)
  const [stats, setStats] = useState({ enabled: false, items: 0, trucks: 0, warehouses: 0, mapped: 0 })
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [s, items, locs, maps, replen, pos, val, varr] = await Promise.all([
      getSettings(org.selectedOrg), listItems(org.selectedOrg), listLocations(org.selectedOrg), listMaps(org.selectedOrg),
      listReplenishment(org.selectedOrg).catch(() => []),
      listPurchaseOrders(org.selectedOrg).catch(() => []),
      valuation().catch(() => []),
      variance().catch(() => []),
    ])
    setStats({
      enabled: !!s?.enabled,
      items: items.length,
      trucks: locs.filter((l) => l.type === 'truck').length,
      warehouses: locs.filter((l) => l.type === 'warehouse').length,
      mapped: new Set(maps.map((m) => m.service_id)).size,
    })

    // Open POs (ordered / partial) + next expected delivery
    const openPos = (pos || []).filter((p) => OPEN_PO.includes(p.status))
    const upcoming = openPos
      .map((p) => p.expected_at)
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b))
    const openValue = openPos.reduce((sum, p) => sum + (Number(p.value) || 0), 0)

    // Valuation total
    const valValue = (val || []).reduce((sum, r) => sum + (Number(r.value) || 0), 0)
    const valParts = new Set((val || []).map((r) => r.item_id)).size

    // Variance — last 90 days
    const cutoff = Date.now() - 90 * 86400000
    const recentVar = (varr || []).filter((r) => {
      const t = r.at ? new Date(r.at).getTime() : null
      return t != null && t >= cutoff
    })
    const varNet = recentVar.reduce((sum, r) => sum + (Number(r.value_var) || 0), 0)

    setMetrics({
      lowStock: (replen || []).length,
      openPoCount: openPos.length,
      openPoNext: upcoming[0] || null,
      openPoValue: openValue,
      valValue,
      valParts,
      varNet,
      varCount: recentVar.length,
    })
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const Stat = ({ label, value }) => (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', minWidth: 120 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#1B3A6B' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--mist)' }}>{label}</div>
    </div>
  )

  // A big clickable metric card for the four reports.
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

  const nav = useNavigate()
  const sig = useSignals({ station: 'stock-purchasing' }, org.selectedOrg, nav)
  const m = metrics
  const lowAlert = !!m && m.lowStock > 0
  const isSuper = profile?.role === 'super_admin'
  const opsAdmin = isSuper || can(profile, 'view_operational_metrics')
  const ownerAdmin = isSuper || can(profile, 'view_owner_metrics')
  const officeSub = sig.loading ? 'Checking inventory…' : sig.total > 0 ? (<>Stock &amp; purchasing work — <b style={{ color: 'inherit' }}>{sig.total}</b> item{sig.total === 1 ? '' : 's'} need a hand.</>) : "You're all caught up — inventory's in good shape."
  const ownerCards = m ? (<>
    <StationKpi label="Inventory value" big={money0(m.valValue)} sub={`${m.valParts} part${m.valParts === 1 ? '' : 's'} on hand`} tone="opp" onClick={() => nav('/elements/valuation')} />
    <StationKpi label="Variance (90 days)" big={signed0(m.varNet)} sub={m.varCount ? `${m.varCount} exception${m.varCount === 1 ? '' : 's'}` : 'no exceptions'} tone={m.varNet < 0 ? 'alert' : undefined} onClick={() => nav('/elements/variance')} />
  </>) : null
  const opsCards = m ? <StationKpi label="Variance exceptions (90d)" big={String(m.varCount)} sub="discrepancies posted" tone={m.varCount > 0 ? 'alert' : undefined} onClick={() => nav('/elements/variance')} /> : null
  const nextTxt = m && m.openPoNext ? `Next delivery ${fmtDate(m.openPoNext) || '—'}` : (m && m.openPoCount > 0 ? 'No delivery date set' : 'None awaiting delivery')

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Inventory Dashboard</h2>
          <EnabledPill enabled={stats.enabled} />
        </div>
        <button className="logout-button" style={{ margin: 0 }} disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      <OrgBar {...org} />
      <div style={{ margin: '12px 0 16px' }}>
        <QuincyBrief kind="inventory" context={{
          lowStock: m ? m.lowStock : 0,
          openPurchaseOrders: m ? m.openPoCount : 0,
          nextDeliveryDate: m ? m.openPoNext : null,
          openPoValue: m ? m.openPoValue : 0,
          inventoryValue: m ? m.valValue : 0,
          partsInStock: m ? m.valParts : 0,
          variance90dNet: m ? m.varNet : 0,
          varianceExceptions90d: m ? m.varCount : 0,
          trucks: stats.trucks, warehouses: stats.warehouses, totalParts: stats.items, mappedServices: stats.mapped,
        }} />
      </div>
      <DisabledNotice enabled={stats.enabled} />

      <div style={{ margin: '4px 0 24px' }}>
        <StationShell
          eyebrow="Inventory Station"
          officeTitle="Your inventory tasks"
          adminTitle="Inventory health"
          officeSubtitle={officeSub}
          loading={sig.loading}
          signals={sig.signals}
          opsAdmin={opsAdmin} ownerAdmin={ownerAdmin}
          opsCards={opsCards} ownerCards={ownerCards}
          emptyHint="Stock levels, open POs, and variance are all in line."
          fanoutNote={<>Variance is <b style={{ color: 'var(--mist)' }}>a discrepancy to reconcile</b> for the office and <b style={{ color: 'var(--mist)' }}>dollars on your books</b> for you — same source, two views.</>}
        />
      </div>

      {/* Identity stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <Stat label="Trucks" value={stats.trucks} />
        <Stat label="Warehouses" value={stats.warehouses} />
        <Stat label="Parts" value={stats.items} />
        <Stat label="Mapped services" value={stats.mapped} />
      </div>

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
