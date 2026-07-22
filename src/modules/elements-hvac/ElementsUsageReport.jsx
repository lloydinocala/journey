// Elements-HVAC · Usage report — parts consumed per truck / technician, from the ledger
import { useState, useEffect, useMemo } from 'react'
import { usageReport, listTechnicians } from './data'
import { useOrgSelector, OrgBar } from './shared'

function daysAgoIso(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function ElementsUsageReport({ profile }) {
  const org = useOrgSelector(profile)
  const [from, setFrom] = useState(daysAgoIso(30))
  const [to, setTo] = useState(daysAgoIso(0))
  const [rows, setRows] = useState([])
  const [techs, setTechs] = useState([])
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [r, t] = await Promise.all([
      usageReport(org.selectedOrg, `${from}T00:00:00`, `${to}T23:59:59`),
      listTechnicians(org.selectedOrg),
    ])
    setRows(r)
    setTechs(t)
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const techName = (id) => techs.find((t) => t.id === id)?.full_name || '—'

  // Aggregate by truck -> item
  const byTruck = useMemo(() => {
    const groups = {}
    rows.forEach((r) => {
      const truck = r.location?.name || 'Unassigned'
      const techId = r.location?.assigned_user_id
      const key = truck
      groups[key] = groups[key] || { truck, techId, items: {}, totalQty: 0, totalCost: 0 }
      const g = groups[key]
      const sku = r.item?.sku || '—'
      const qty = Math.abs(Number(r.qty_delta) || 0)
      const cost = qty * (Number(r.unit_cost) || 0)
      g.items[sku] = g.items[sku] || { sku, description: r.item?.description, qty: 0, cost: 0 }
      g.items[sku].qty += qty
      g.items[sku].cost += cost
      g.totalQty += qty
      g.totalCost += cost
    })
    return Object.values(groups).sort((a, b) => b.totalCost - a.totalCost)
  }, [rows])

  const grandCost = byTruck.reduce((s, g) => s + g.totalCost, 0)

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Parts Usage</h2>
          <span className="badge">{rows.length} consumption events</span>
        </div>
      </div>
      <OrgBar {...org} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button className="auth-button" style={{ width: 'auto' }} onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Run report'}</button>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--mist)' }}>Total parts cost consumed</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1B3A6B' }}>${grandCost.toFixed(2)}</div>
        </div>
      </div>

      {byTruck.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>
          No consumption recorded in this range. Once the module is enabled and invoiced parts are mapped to SKUs,
          usage appears here automatically.
        </p>
      ) : (
        byTruck.map((g) => (
          <div key={g.truck} style={{ border: '1px solid var(--border)', borderRadius: 12, marginBottom: 18, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8FAFC' }}>
              <div>
                <span style={{ fontWeight: 700 }}>{g.truck}</span>
                <span style={{ color: 'var(--mist)', marginLeft: 10, fontSize: 13 }}>{techName(g.techId)}</span>
              </div>
              <div style={{ fontWeight: 700, color: '#1B3A6B' }}>${g.totalCost.toFixed(2)}</div>
            </div>
            <table className="data-table" style={{ margin: 0 }}>
              <thead><tr><th>Part</th><th style={{ textAlign: 'right' }}>Qty used</th><th style={{ textAlign: 'right' }}>Cost</th></tr></thead>
              <tbody>
                {Object.values(g.items).sort((a, b) => b.cost - a.cost).map((it) => (
                  <tr key={it.sku}>
                    <td>{it.description || it.sku}</td>
                    <td style={{ textAlign: 'right' }}>{it.qty}</td>
                    <td style={{ textAlign: 'right' }}>${it.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
