// Elements-HVAC · P5c · Inventory Health (anomaly detection)
// A live diagnostic that surfaces the inventory problems worth acting on —
// negative stock, stockouts, cost outliers, dead stock, usage spikes, and
// shrinkage from cycle counts. Each flag clears itself once the issue is fixed.
import { useState, useEffect, useMemo } from 'react'
import { listAnomalies } from './data'
import { useOrgSelector, OrgBar } from './shared'

const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '')
const SEV = {
  high: { t: 'High', bg: '#FBE7E7', c: '#B00020', dot: '#DC2626' },
  medium: { t: 'Medium', bg: '#F8EEDD', c: '#B0600A', dot: '#D97706' },
  low: { t: 'Low', bg: '#EEF1F6', c: '#475569', dot: '#94A3B8' },
}
const SEV_RANK = { high: 0, medium: 1, low: 2 }

// Per-kind metadata: heading, what it means, and how to compose each row's line.
const KIND = {
  negative_on_hand: {
    label: 'Negative on-hand', sev: 'high',
    blurb: "On-hand dropped below zero — parts were used or moved without being recorded. Run a cycle count to reset the true quantity.",
    line: (a) => `On-hand is ${a.metric} at ${a.location_name || 'a location'}`,
  },
  stockout: {
    label: 'Stockouts', sev: 'medium',
    blurb: 'Stocked parts sitting at zero where a reorder point is set — you may be caught short on the next job. Reorder or transfer.',
    line: (a) => `Out of stock at ${a.location_name || 'a location'} (reorder point ${a.metric})`,
  },
  cost_outlier: {
    label: 'Cost outliers', sev: 'medium',
    blurb: 'A recent receipt was priced well off the expected cost — worth checking the invoice or PO for an overcharge or a keying error.',
    line: (a) => {
      const pct = a.metric2 ? Math.round(((a.metric - a.metric2) / a.metric2) * 100) : 0
      return `Received at ${money(a.metric)} vs expected ${money(a.metric2)} (${pct > 0 ? '+' : ''}${pct}%)${a.occurred_at ? ` on ${fmtDate(a.occurred_at)}` : ''}`
    },
  },
  consumption_spike: {
    label: 'Usage spikes', sev: 'medium',
    blurb: 'Usage in the last 30 days ran well above the recent average — could be a big job, unusual waste, or shrinkage. Worth a look.',
    line: (a) => `Used ${a.metric} in the last 30 days vs ~${a.metric2}/mo average`,
  },
  shrinkage: {
    label: 'Shrinkage (from counts)', sev: 'medium',
    blurb: 'Recent cycle counts came up short for these parts — persistent shortages can mean miscounts, unrecorded usage, or loss.',
    line: (a) => `Cycle counts short ${Math.abs(a.metric)} unit(s) in the last 180 days${a.location_name ? ` at ${a.location_name}` : ''}`,
  },
  dead_stock: {
    label: 'Dead stock', sev: 'low',
    blurb: "On-hand parts with no usage in 180+ days — cash sitting on the shelf. Consider returning to the vendor or lowering the par level.",
    line: (a) => `${a.metric} on-hand, no usage in 180+ days${a.metric2 ? ` (~${money(a.metric2)} tied up)` : ''}`,
  },
  missing_cost: {
    label: 'Missing cost', sev: 'low',
    blurb: "These parts have stock but no cost on record, so inventory can't be valued. Set a standard cost in the Item Catalog.",
    line: (a) => `${a.metric} on-hand but no cost on record`,
  },
}
const KIND_ORDER = ['negative_on_hand', 'stockout', 'cost_outlier', 'consumption_spike', 'shrinkage', 'dead_stock', 'missing_cost']

export default function ElementsAnomalies({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [sevFilter, setSevFilter] = useState('all')

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    setRows(await listAnomalies())
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const counts = useMemo(() => {
    const c = { total: rows.length, high: 0, medium: 0, low: 0 }
    rows.forEach((r) => { c[r.severity] = (c[r.severity] || 0) + 1 })
    return c
  }, [rows])

  const groups = useMemo(() => {
    const visible = rows.filter((r) => sevFilter === 'all' || r.severity === sevFilter)
    const by = {}
    visible.forEach((r) => { (by[r.kind] = by[r.kind] || []).push(r) })
    return KIND_ORDER.filter((k) => by[k]?.length).map((k) => ({ kind: k, meta: KIND[k], items: by[k] }))
      .sort((a, b) => SEV_RANK[a.meta.sev] - SEV_RANK[b.meta.sev])
  }, [rows, sevFilter])

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Inventory Health</h2>
          {counts.high > 0 && <span className="badge" style={{ background: SEV.high.bg, color: SEV.high.c }}>{counts.high} high</span>}
          {counts.medium > 0 && <span className="badge" style={{ background: SEV.medium.bg, color: SEV.medium.c }}>{counts.medium} medium</span>}
          {counts.low > 0 && <span className="badge" style={{ background: SEV.low.bg, color: SEV.low.c }}>{counts.low} low</span>}
        </div>
        <button className="logout-button" style={{ margin: 0 }} disabled={loading} onClick={load}>{loading ? 'Checking…' : 'Refresh'}</button>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 780 }}>
        A live scan for inventory problems worth your attention. Nothing here changes your data — fix the underlying issue
        (reorder a part, run a count, correct a cost) and the flag clears itself on the next refresh.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[['all', `All (${counts.total})`], ['high', `High (${counts.high})`], ['medium', `Medium (${counts.medium})`], ['low', `Low (${counts.low})`]].map(([k, label]) => (
          <button key={k} onClick={() => setSevFilter(k)} className={sevFilter === k ? 'auth-button' : 'logout-button'}
            style={{ width: 'auto', margin: 0, padding: '6px 12px', fontSize: 13 }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--mist)' }}>Scanning inventory…</div>
      ) : groups.length === 0 ? (
        <div style={{ border: '1px solid #BBE3C8', background: '#F1FAF4', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: '#166534', fontWeight: 600 }}>
          {rows.length === 0 ? 'No anomalies — inventory looks healthy. ✓' : 'Nothing at this severity.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map((g) => {
            const sev = SEV[g.meta.sev]
            return (
              <div key={g.kind} style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #EEF1F6', background: '#FBFCFE' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: sev.dot, display: 'inline-block' }} />
                    <span style={{ fontWeight: 700, color: '#132A4C' }}>{g.meta.label}</span>
                    <span className="badge" style={{ background: sev.bg, color: sev.c }}>{g.items.length}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 4 }}>{g.meta.blurb}</div>
                </div>
                <div>
                  {g.items.map((a, i) => (
                    <div key={a.item_id + '-' + a.kind + '-' + (a.location_id || '') + '-' + i}
                      style={{ padding: '10px 16px', borderBottom: i < g.items.length - 1 ? '1px solid #F1F5F9' : 'none', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 600, color: '#152238', flex: '1 1 220px' }}>{a.item_description || '(item)'}</div>
                      <div style={{ fontSize: 13, color: '#334155', flex: '2 1 320px' }}>{g.meta.line(a)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
