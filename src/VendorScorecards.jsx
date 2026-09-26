// Vendor scorecards — self-contained. Computes each vendor's real purchasing
// performance from your purchase-order history (lead time, on-time %, fill rate,
// spend) so buying decisions are evidence-based, not habit. Every figure is
// computed from actual POs; an optional AI note summarizes it in plain English.
import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import AiAssist from './AiAssist'

const money = (n) => (n == null || isNaN(n) ? '$0' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`)
const days = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 86400000) : null)

const SYS = `You advise an HVAC contractor's purchasing. From the vendor scorecards given (lead time, on-time %, fill rate, spend, PO count), write a few plain lines: which vendors are most reliable, which are slow or under-filling orders, and any concrete purchasing suggestion. Use ONLY the numbers provided — do not invent vendors or figures.`

export default function VendorScorecards({ orgId }) {
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!orgId || !open || rows != null) return
    let alive = true
    ;(async () => {
      const [{ data: vendors }, { data: pos }, { data: lines }] = await Promise.all([
        supabase.from('vendors').select('id, name').eq('org_id', orgId),
        supabase.from('elements_purchase_orders').select('id, vendor_id, ordered_at, expected_at, received_at, status').eq('org_id', orgId),
        supabase.from('elements_po_lines').select('po_id, qty_ordered, qty_received, unit_cost').eq('org_id', orgId),
      ])
      if (!alive) return
      const vName = Object.fromEntries((vendors || []).map((v) => [v.id, v.name]))
      const linesByPo = {}
      ;(lines || []).forEach((l) => { (linesByPo[l.po_id] = linesByPo[l.po_id] || []).push(l) })
      const agg = {}
      ;(pos || []).forEach((po) => {
        const v = po.vendor_id; if (!v) return
        const a = agg[v] || (agg[v] = { poCount: 0, leadDays: [], onTime: 0, onTimeElig: 0, ordered: 0, received: 0, spend: 0 })
        a.poCount++
        const lead = days(po.ordered_at, po.received_at)
        if (lead != null && lead >= 0) a.leadDays.push(lead)
        if (po.received_at && po.expected_at) { a.onTimeElig++; if (new Date(po.received_at) <= new Date(po.expected_at)) a.onTime++ }
        ;(linesByPo[po.id] || []).forEach((l) => {
          a.ordered += Number(l.qty_ordered || 0)
          a.received += Number(l.qty_received || 0)
          a.spend += Number(l.qty_received || 0) * Number(l.unit_cost || 0)
        })
      })
      const out = Object.entries(agg).map(([vid, a]) => ({
        vendor: vName[vid] || 'Vendor',
        poCount: a.poCount,
        avgLead: a.leadDays.length ? Math.round(a.leadDays.reduce((s, d) => s + d, 0) / a.leadDays.length) : null,
        onTimePct: a.onTimeElig ? Math.round((a.onTime / a.onTimeElig) * 100) : null,
        fillPct: a.ordered ? Math.round((a.received / a.ordered) * 100) : null,
        spend: a.spend,
      })).sort((x, y) => y.spend - x.spend)
      setRows(out)
    })()
    return () => { alive = false }
  }, [orgId, open, rows])

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, margin: '8px 0 16px', background: '#FBFCFE' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{ border: '1px solid #1B3A6B', background: '#fff', color: '#1B3A6B', fontWeight: 600, fontSize: 13, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
          {open ? 'Hide vendor scorecards' : '📊 Vendor scorecards'}
        </button>
        {open && rows != null && rows.length > 0 && (
          <AiAssist compact title="Vendor performance summary" system={SYS}
            prompt="Summarize these vendor scorecards and give a purchasing suggestion, using only the numbers."
            context={{ vendors: rows.map((r) => ({ vendor: r.vendor, pos: r.poCount, avg_lead_days: r.avgLead, on_time_pct: r.onTimePct, fill_pct: r.fillPct, spend: Math.round(r.spend) })) }} />
        )}
      </div>

      {open && (
        rows == null ? <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>Computing from purchase-order history…</p> : rows.length === 0 ? (
          <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>No purchase-order history yet to score vendors.</p>
        ) : (
          <table className="data-table" style={{ fontSize: 13, marginTop: 10 }}>
            <thead><tr><th>Vendor</th><th style={{ textAlign: 'right' }}>POs</th><th style={{ textAlign: 'right' }}>Avg lead</th><th style={{ textAlign: 'right' }}>On-time</th><th style={{ textAlign: 'right' }}>Fill rate</th><th style={{ textAlign: 'right' }}>Spend</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{r.vendor}</td>
                  <td style={{ textAlign: 'right' }}>{r.poCount}</td>
                  <td style={{ textAlign: 'right' }}>{r.avgLead == null ? '—' : `${r.avgLead}d`}</td>
                  <td style={{ textAlign: 'right' }}>{r.onTimePct == null ? '—' : `${r.onTimePct}%`}</td>
                  <td style={{ textAlign: 'right' }}>{r.fillPct == null ? '—' : `${r.fillPct}%`}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  )
}
