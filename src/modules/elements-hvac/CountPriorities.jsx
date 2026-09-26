// Risk-based count priorities for Cycle Counts. Self-contained and deterministic:
// ranks items by value-on-hand and their real variance history (how often past
// counts posted an adjustment), so the office counts the high-value / high-shrink
// items more often. Every number shown is real — nothing is inferred by a model.
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'

const money = (n) => (n == null || isNaN(n) ? '$0' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`)

export default function CountPriorities({ orgId }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!orgId || !open || data != null) return
    let alive = true
    ;(async () => {
      const [{ data: items }, { data: levels }, { data: lines }] = await Promise.all([
        supabase.from('elements_items').select('id, sku, description, avg_cost, last_cost, standard_cost').eq('org_id', orgId).eq('is_active', true),
        supabase.from('elements_stock_levels').select('item_id, on_hand').eq('org_id', orgId),
        supabase.from('elements_cycle_count_lines').select('item_id, posted_delta').eq('org_id', orgId),
      ])
      if (!alive) return
      const onHand = {}
      ;(levels || []).forEach((l) => { onHand[l.item_id] = (onHand[l.item_id] || 0) + Number(l.on_hand || 0) })
      const varCount = {}; const counted = {}
      ;(lines || []).forEach((l) => {
        counted[l.item_id] = (counted[l.item_id] || 0) + 1
        if (Number(l.posted_delta || 0) !== 0) varCount[l.item_id] = (varCount[l.item_id] || 0) + 1
      })
      const ranked = (items || []).map((it) => {
        const qty = onHand[it.id] || 0
        const cost = Number(it.avg_cost || it.last_cost || it.standard_cost || 0)
        const value = qty * cost
        const variances = varCount[it.id] || 0
        const everCounted = (counted[it.id] || 0) > 0
        // Value drives it; frequent past variances multiply; never-counted stock gets a nudge.
        const score = value * (1 + variances * 0.5) + (!everCounted && value > 0 ? value * 0.25 : 0)
        const reasons = []
        if (variances > 0) reasons.push(`${variances} past variance${variances === 1 ? '' : 's'}`)
        if (!everCounted && qty > 0) reasons.push('never counted')
        return { id: it.id, sku: it.sku, description: it.description, qty, value, variances, everCounted, score, reasons }
      }).filter((r) => r.value > 0 || r.variances > 0).sort((a, b) => b.score - a.score)
      setData(ranked)
    })()
    return () => { alive = false }
  }, [orgId, open, data])

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, margin: '8px 0 16px', background: '#FBFCFE' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{ border: '1px solid #1B3A6B', background: '#fff', color: '#1B3A6B', fontWeight: 600, fontSize: 13, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
          {open ? 'Hide count priorities' : '🎯 Count priorities'}
        </button>
        {open && data != null && <span style={{ fontSize: 12.5, color: 'var(--mist)', marginLeft: 'auto' }}>highest value / most variance first — count these more often</span>}
      </div>

      {open && (
        data == null ? <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>Ranking items…</p> : data.length === 0 ? (
          <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>No stocked value on hand to prioritize yet.</p>
        ) : (
          <div style={{ marginTop: 10 }}>
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>On hand</th><th style={{ textAlign: 'right' }}>Value</th><th>Why</th></tr></thead>
              <tbody>
                {data.slice(0, 40).map((r) => (
                  <tr key={r.id}>
                    <td><span style={{ fontWeight: 600 }}>{r.sku || '(no SKU)'}</span> <span style={{ color: 'var(--mist)' }}>{r.description || ''}</span></td>
                    <td style={{ textAlign: 'right' }}>{r.qty}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.value)}</td>
                    <td style={{ color: 'var(--mist)' }}>{r.reasons.join(' · ') || 'high value on hand'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 40 && <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 4 }}>Showing top 40 of {data.length}.</div>}
          </div>
        )
      )}
    </div>
  )
}
