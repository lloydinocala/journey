// Elements-HVAC · Report · Inventory Valuation (current value)
// What your stock on hand is worth right now, valued at cost (average, else last,
// else standard). Summary by location and by category, plus a full item detail.
import { useState, useEffect, useMemo } from 'react'
import { valuation } from './data'
import { useOrgSelector, OrgBar } from './shared'

const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

export default function ElementsValuation({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [groupBy, setGroupBy] = useState('location') // location | category

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    setRows(await valuation())
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const totals = useMemo(() => {
    const value = rows.reduce((s, r) => s + (Number(r.value) || 0), 0)
    const items = new Set(rows.map((r) => r.item_id)).size
    const locations = new Set(rows.map((r) => r.location_id)).size
    const unvalued = rows.filter((r) => r.unit_cost == null).length
    return { value, items, locations, unvalued, lines: rows.length }
  }, [rows])

  const groups = useMemo(() => {
    const by = {}
    rows.forEach((r) => {
      const key = groupBy === 'location' ? (r.location_name || 'Unassigned') : (r.category || 'Uncategorized')
      by[key] = by[key] || { key, value: 0, lines: 0 }
      by[key].value += Number(r.value) || 0
      by[key].lines += 1
    })
    return Object.values(by).sort((a, b) => b.value - a.value)
  }, [rows, groupBy])

  const detail = useMemo(() => [...rows].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)), [rows])

  return (
    <div>
      <div className="page-header-bar">
        <h2>Inventory Valuation</h2>
        <button className="logout-button" style={{ margin: 0 }} disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 800 }}>
        What your stock on hand is worth right now, valued at cost. This is a live, current-value snapshot — refresh any time.
      </p>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          ['Total value', money(totals.value)],
          ['Parts in stock', String(totals.items)],
          ['Locations', String(totals.locations)],
        ].map(([label, val], i) => (
          <div key={i} style={{ flex: '1 1 160px', border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, padding: '12px 16px', background: '#FBFCFE' }}>
            <div style={{ fontSize: 12, color: 'var(--mist)' }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#132A4C', marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>

      {totals.unvalued > 0 && (
        <div style={{ marginBottom: 16, background: '#F8EEDD', border: '1px solid #E4B36B', color: '#B0600A', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>
          {totals.unvalued} stock line{totals.unvalued === 1 ? '' : 's'} could not be valued — no cost on record. Set a cost in the Item Catalog to include {totals.unvalued === 1 ? 'it' : 'them'} in the total.
        </div>
      )}

      {loading ? (
        <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--mist)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--mist)' }}>
          No stock on hand to value yet. Receive stock (Stock & Receiving or a purchase order) and it will show up here.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Breakdown */}
          <div style={{ flex: '1 1 300px', minWidth: 280, maxWidth: 420 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {[['location', 'By location'], ['category', 'By category']].map(([k, l]) => (
                <button key={k} onClick={() => setGroupBy(k)} className={groupBy === k ? 'auth-button' : 'logout-button'}
                  style={{ width: 'auto', margin: 0, padding: '6px 12px', fontSize: 13 }}>{l}</button>
              ))}
            </div>
            <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%', margin: 0 }}>
                <thead><tr><th>{groupBy === 'location' ? 'Location' : 'Category'}</th><th style={{ textAlign: 'right' }}>Value</th></tr></thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.key}>
                      <td style={{ fontWeight: 600, color: '#152238' }}>{g.key}<span style={{ color: 'var(--mist)', fontWeight: 400, fontSize: 12 }}> · {g.lines}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(g.value)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#F8FAFC' }}>
                    <td style={{ fontWeight: 700 }}>Total</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#1B3A6B' }}>{money(totals.value)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail */}
          <div style={{ flex: '2 1 460px', minWidth: 320 }}>
            <div style={{ overflowX: 'auto', border: '1px solid var(--line, #E2E8F0)', borderRadius: 10 }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Location</th>
                    <th style={{ textAlign: 'right' }}>On hand</th>
                    <th style={{ textAlign: 'right' }}>Unit cost</th>
                    <th style={{ textAlign: 'right' }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((r) => (
                    <tr key={r.item_id + '-' + r.location_id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#152238' }}>{r.description}</div>
                        <div style={{ fontSize: 11, color: 'var(--mist)' }}>{r.category || 'Uncategorized'}</div>
                      </td>
                      <td style={{ color: 'var(--mist)' }}>{r.location_name}</td>
                      <td style={{ textAlign: 'right', color: Number(r.on_hand) < 0 ? '#B00020' : undefined }}>{r.on_hand}</td>
                      <td style={{ textAlign: 'right' }}>{r.unit_cost == null ? <span style={{ color: '#B0600A' }}>no cost</span> : money(r.unit_cost)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.value == null ? '—' : money(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <p style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 10 }}>
        Each part is valued at its average cost, falling back to last cost, then standard cost. Negative on-hand (a data issue to fix with a count) reduces the total. This is current value only — it isn’t stored as a weekly history.
      </p>
    </div>
  )
}
