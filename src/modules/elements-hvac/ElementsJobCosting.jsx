// Elements-HVAC · P5d · Job Costing
// Actual material cost per invoice (from recorded parts-used) against the billed
// amount, so the office sees material spend and margin by job. Labor is not
// included — this is material vs revenue, not full job profit.
import { useState, useEffect, useMemo } from 'react'
import { jobCosting } from './data'
import { useOrgSelector, OrgBar } from './shared'

const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const fmtDate = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString() : '')
const RANGES = [[90, '90 days'], [180, '6 months'], [365, '1 year'], [3650, 'All time']]

// Material as a share of billed → a friendly color. Lower is better for the shop.
function pctColor(pct) {
  if (pct == null) return { bg: '#EEF1F6', c: '#475569' }
  if (pct <= 35) return { bg: '#E3F1E8', c: '#166534' }
  if (pct <= 55) return { bg: '#F8EEDD', c: '#B0600A' }
  return { bg: '#FBE7E7', c: '#B00020' }
}

export default function ElementsJobCosting({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [days, setDays] = useState(180)
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    setRows(await jobCosting(days))
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg, days])

  const totals = useMemo(() => {
    const billed = rows.reduce((s, r) => s + Number(r.billed || 0), 0)
    const material = rows.reduce((s, r) => s + Number(r.material_cost || 0), 0)
    return { billed, material, margin: billed - material, pct: billed > 0 ? (material / billed) * 100 : null, jobs: rows.length }
  }, [rows])

  return (
    <div>
      <div className="page-header-bar">
        <h2>Job Costing</h2>
        <div className="field" style={{ marginBottom: 0 }}>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 800 }}>
        What each job actually cost you in parts, next to what you billed. Only jobs where parts were recorded (via Record
        Parts Used) appear here. Material % is parts as a share of the billed amount — the rest covers labor, overhead, and profit.
      </p>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          ['Jobs costed', String(totals.jobs)],
          ['Billed', money(totals.billed)],
          ['Material cost', money(totals.material)],
          ['After materials', money(totals.margin)],
          ['Material % of billed', totals.pct == null ? '—' : `${totals.pct.toFixed(1)}%`],
        ].map(([label, val], i) => (
          <div key={i} style={{ flex: '1 1 150px', border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, padding: '12px 14px', background: '#FBFCFE' }}>
            <div style={{ fontSize: 12, color: 'var(--mist)' }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#132A4C', marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--mist)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--mist)' }}>
          No costed jobs in this window yet. Record the parts used on an invoice (Record Parts Used) and it will show up here.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--line, #E2E8F0)', borderRadius: 10 }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Job</th>
                <th style={{ textAlign: 'right' }}>Billed</th>
                <th style={{ textAlign: 'right' }}>Material</th>
                <th style={{ textAlign: 'right' }}>After materials</th>
                <th style={{ width: 110 }}>Material %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const billed = Number(r.billed || 0)
                const mat = Number(r.material_cost || 0)
                const pct = billed > 0 ? (mat / billed) * 100 : null
                const col = pctColor(pct)
                return (
                  <tr key={r.invoice_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#152238' }}>{r.invoice_number || '(no #)'}</div>
                      <div style={{ fontSize: 11, color: 'var(--mist)' }}>{fmtDate(r.invoice_date)}</div>
                    </td>
                    <td>{r.customer_name || '—'}</td>
                    <td style={{ color: 'var(--mist)' }}>{r.job_number || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{money(billed)}</td>
                    <td style={{ textAlign: 'right' }}>{money(mat)}<div style={{ fontSize: 11, color: 'var(--mist)' }}>{r.material_lines} part{r.material_lines === 1 ? '' : 's'}</div></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: billed - mat >= 0 ? '#166534' : '#B00020' }}>{money(billed - mat)}</td>
                    <td>{pct == null ? <span style={{ color: 'var(--mist)' }}>—</span> : <span className="badge" style={{ background: col.bg, color: col.c }}>{pct.toFixed(0)}%</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 10 }}>
        "Billed" is the pre-tax invoice subtotal. "Material" values each part at its recorded cost (falling back to average or last cost). Labor and overhead aren't included.
      </p>
    </div>
  )
}
