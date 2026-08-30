// Elements-HVAC · Inventory Dashboard (module landing)
// At-a-glance operational health — Low Stock, Open POs, Variance, Valuation —
// each card links to its full screen. Below that: identity stats and the
// navigation cards for the rest of the module.
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  getSettings, listItems, listLocations, listMaps,
  listReplenishment, listPurchaseOrders, valuation, variance,
} from './data'
import { useOrgSelector, OrgBar, EnabledPill, DisabledNotice } from './shared'

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

  const m = metrics
  const lowAlert = !!m && m.lowStock > 0
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
      <DisabledNotice enabled={stats.enabled} />

      {/* At a glance — the four reports */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: 0.4, margin: '4px 0 8px' }}>At a glance</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Metric
          to="/elements/replenishment"
          label="Low stock"
          value={loading && !m ? '…' : String(m ? m.lowStock : 0)}
          sub={m && m.lowStock > 0 ? 'at or under reorder point' : 'everything above reorder'}
          accent={lowAlert ? '#B00020' : '#0B7A3B'}
          alert={lowAlert}
        />
        <Metric
          to="/elements/purchasing"
          label="Open purchase orders"
          value={loading && !m ? '…' : String(m ? m.openPoCount : 0)}
          sub={m ? (m.openPoCount > 0 ? `${nextTxt} · ${money0(m.openPoValue)} on order` : 'None awaiting delivery') : ''}
          accent="#1B3A6B"
        />
        <Metric
          to="/elements/variance"
          label="Variance (90 days)"
          value={loading && !m ? '…' : signed0(m ? m.varNet : 0)}
          sub={m ? (m.varCount > 0 ? `${m.varCount} exception${m.varCount === 1 ? '' : 's'}` : 'no exceptions') : ''}
          accent={m && m.varNet < 0 ? '#B00020' : '#132A4C'}
        />
        <Metric
          to="/elements/valuation"
          label="Inventory value"
          value={loading && !m ? '…' : money0(m ? m.valValue : 0)}
          sub={m ? `${m.valParts} part${m.valParts === 1 ? '' : 's'} in stock` : ''}
          accent="#132A4C"
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
