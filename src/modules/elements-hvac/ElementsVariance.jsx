// Elements-HVAC · Report · Inventory Variance (count + purchase)
// Two kinds of variance in one place:
//  • Count variance  — what posted cycle counts adjusted vs. what the system
//    expected, valued at the item's cost. Negative = shrink (loss).
//  • Purchase variance — where a vendor invoice line billed a different unit
//    price or quantity than its purchase order. Positive = paid over PO.
import { useState, useEffect, useMemo } from 'react'
import { variance } from './data'
import { useOrgSelector, OrgBar } from './shared'

const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const signed = (n) => {
  if (n == null || isNaN(n)) return '—'
  const num = Number(n)
  const abs = Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${num > 0 ? '+$' : num < 0 ? '-$' : '$'}${abs}`
}
const qty = (n) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString())
const signedQty = (n) => (n == null || isNaN(n) ? '—' : `${Number(n) > 0 ? '+' : ''}${Number(n).toLocaleString()}`)

const RANGES = [
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days'],
  ['365', 'Last year'],
  ['all', 'All time'],
]

export default function ElementsVariance({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [kind, setKind] = useState('all') // all | count | purchase
  const [range, setRange] = useState('90')

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    setRows(await variance())
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const cutoff = useMemo(() => {
    if (range === 'all') return null
    const d = new Date()
    d.setDate(d.getDate() - Number(range))
    return d.getTime()
  }, [range])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false
      if (cutoff != null) {
        const t = r.at ? new Date(r.at).getTime() : null
        if (t == null || t < cutoff) return false
      }
      return true
    })
  }, [rows, kind, cutoff])

  const totals = useMemo(() => {
    const net = filtered.reduce((s, r) => s + (Number(r.value_var) || 0), 0)
    const count = filtered.filter((r) => r.kind === 'count').reduce((s, r) => s + (Number(r.value_var) || 0), 0)
    const purchase = filtered.filter((r) => r.kind === 'purchase').reduce((s, r) => s + (Number(r.value_var) || 0), 0)
    return { net, count, purchase, exceptions: filtered.length }
  }, [filtered])

  const detail = useMemo(
    () => [...filtered].sort((a, b) => Math.abs(Number(b.value_var) || 0) - Math.abs(Number(a.value_var) || 0)),
    [filtered]
  )

  const fmtDate = (s) => {
    if (!s) return '—'
    try { return new Date(s).toLocaleDateString() } catch { return '—' }
  }

  return (
    <div>
      <div className="page-header-bar">
        <h2>Inventory Variance</h2>
        <button className="logout-button" style={{ margin: 0 }} disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 820 }}>
        Where reality didn't match the plan. Count variance is what a posted cycle count changed versus the system's expected quantity. Purchase variance is where a vendor invoice billed a different price or quantity than its purchase order. Both are valued in dollars so you can see the money impact.
      </p>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          ['Net variance', signed(totals.net), '#132A4C'],
          ['Count adjustments', signed(totals.count), totals.count < 0 ? '#B00020' : '#132A4C'],
          ['Purchase variance', signed(totals.purchase), totals.purchase > 0 ? '#B00020' : '#132A4C'],
          ['Exceptions', String(totals.exceptions), '#132A4C'],
        ].map(([label, val, color], i) => (
          <div key={i} style={{ flex: '1 1 160px', border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, padding: '12px 16px', background: '#FBFCFE' }}>
            <div style={{ fontSize: 12, color: 'var(--mist)' }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {[['all', 'All'], ['count', 'Count'], ['purchase', 'Purchase']].map(([k, l]) => (
          <button key={k} onClick={() => setKind(k)} className={kind === k ? 'auth-button' : 'logout-button'}
            style={{ width: 'auto', margin: 0, padding: '6px 12px', fontSize: 13 }}>{l}</button>
        ))}
        <span style={{ flex: 1 }} />
        <select value={range} onChange={(e) => setRange(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line, #CBD5E1)', fontSize: 13, background: '#fff' }}>
          {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--mist)' }}>Loading…</div>
      ) : detail.length === 0 ? (
        <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--mist)' }}>
          No variance in this window. Count variance appears once you post a cycle count with adjustments; purchase variance appears once a vendor invoice is matched to a PO with a price or quantity difference.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line, #E2E8F0)', borderRadius: 10 }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Item</th>
                <th>Where</th>
                <th style={{ textAlign: 'right' }}>Expected</th>
                <th style={{ textAlign: 'right' }}>Actual</th>
                <th style={{ textAlign: 'right' }}>Qty Δ</th>
                <th style={{ textAlign: 'right' }}>Value impact</th>
              </tr>
            </thead>
            <tbody>
              {detail.map((r, i) => {
                const isCount = r.kind === 'count'
                const v = Number(r.value_var) || 0
                return (
                  <tr key={(r.ref_id || '') + '-' + (r.item_id || '') + '-' + i}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--mist)' }}>{fmtDate(r.at)}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: isCount ? '#E8F0FE' : '#F3ECFB', color: isCount ? '#1B3A6B' : '#5B2A86',
                      }}>{isCount ? 'Count' : 'Purchase'}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#152238' }}>{r.item || 'Unknown item'}</div>
                      <div style={{ fontSize: 11, color: 'var(--mist)' }}>
                        {r.category || 'Uncategorized'}
                        {!isCount && r.doc_number ? ` · Inv ${r.doc_number}` : ''}
                      </div>
                    </td>
                    <td style={{ color: 'var(--mist)' }}>{isCount ? (r.location || '—') : (r.vendor || '—')}</td>
                    <td style={{ textAlign: 'right' }}>
                      {isCount ? qty(r.expected_qty) : (
                        <span title="PO">{qty(r.expected_qty)} @ {money(r.expected_cost)}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isCount ? qty(r.actual_qty) : (
                        <span title="Invoice">{qty(r.actual_qty)} @ {money(r.actual_cost)}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', color: Number(r.qty_var) < 0 ? '#B00020' : Number(r.qty_var) > 0 ? '#0B7A3B' : undefined }}>
                      {signedQty(r.qty_var)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: v < 0 ? '#B00020' : v > 0 ? '#0B7A3B' : '#334155' }}>
                      {signed(v)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 10, maxWidth: 820 }}>
        Count value impact = adjusted quantity × item cost (average, else last, else standard). Purchase value impact = (invoiced unit price − PO unit price) × invoiced quantity. For counts, a negative number is shrink (inventory worth less than the books said); for purchases, a positive number means the invoice cost more than the PO. This is computed live from posted counts and matched invoices — refresh any time.
      </p>
    </div>
  )
}
