// Margin watch for the Pricebook. Self-contained: loads the org's priced service
// lines and flags any selling below a target gross margin, with the actual price,
// cost, and computed margin shown beside each (honest — the numbers are real, and
// lines with no cost on file are called out as a data gap rather than guessed).
import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

const money = (n) => (n == null || isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`)

export default function MarginWatch({ orgId }) {
  const [rows, setRows] = useState(null)
  const [target, setTarget] = useState(40) // target gross margin %
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!orgId || !open || rows != null) return
    let alive = true
    ;(async () => {
      const { data } = await supabase
        .from('service_prices')
        .select('id, price, cost, customer_display, services!inner(name, category, org_id, is_active)')
        .eq('services.org_id', orgId)
        .eq('services.is_active', true)
      if (!alive) return
      setRows(data || [])
    })()
    return () => { alive = false }
  }, [orgId, open, rows])

  const analyzed = (rows || []).map((r) => {
    const price = Number(r.price) || 0
    const cost = Number(r.cost) || 0
    const hasCost = cost > 0
    const margin = hasCost && price > 0 ? ((price - cost) / price) * 100 : null
    return {
      id: r.id,
      label: r.customer_display || r.services?.name || 'Item',
      category: r.services?.category || '',
      price, cost, hasCost, margin,
    }
  })
  const below = analyzed.filter((r) => r.margin != null && r.margin < target).sort((a, b) => a.margin - b.margin)
  const noCost = analyzed.filter((r) => !r.hasCost && r.price > 0)

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, margin: '0 0 16px', background: '#FBFCFE' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{ border: '1px solid #1B3A6B', background: '#fff', color: '#1B3A6B', fontWeight: 600, fontSize: 13, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
          {open ? 'Hide margin watch' : '⚖️ Margin watch'}
        </button>
        {open && (
          <label style={{ fontSize: 13, color: 'var(--mist)' }}>
            Target gross margin:&nbsp;
            <input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)}
              style={{ width: 60, padding: '4px 6px', border: '1px solid #D5DAE1', borderRadius: 6 }} />%
          </label>
        )}
        {open && rows != null && (
          <span style={{ fontSize: 12.5, color: 'var(--mist)', marginLeft: 'auto' }}>
            {below.length} below target · {noCost.length} missing cost · {analyzed.length} priced lines
          </span>
        )}
      </div>

      {open && (
        rows == null ? <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>Scanning pricebook…</p> : (
          <div style={{ marginTop: 10 }}>
            {below.length === 0 ? (
              <p style={{ color: 'var(--mist)', fontSize: 13, margin: '2px' }}>No lines below {target}% margin. {noCost.length > 0 ? `(${noCost.length} lines have no cost on file, so their margin can’t be checked — add cost to include them.)` : ''}</p>
            ) : (
              <>
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead><tr><th>Item</th><th>Category</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Cost</th><th style={{ textAlign: 'right' }}>Margin</th></tr></thead>
                  <tbody>
                    {below.slice(0, 100).map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.label}</td>
                        <td style={{ color: 'var(--mist)' }}>{r.category}</td>
                        <td style={{ textAlign: 'right' }}>{money(r.price)}</td>
                        <td style={{ textAlign: 'right' }}>{money(r.cost)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: r.margin < 0 ? '#B00020' : '#B0600A' }}>{r.margin.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {below.length > 100 && <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 4 }}>Showing 100 of {below.length}.</div>}
              </>
            )}
            {noCost.length > 0 && below.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 6 }}>{noCost.length} more line{noCost.length === 1 ? '' : 's'} have no cost on file and can’t be margin-checked — add cost to include them.</div>
            )}
          </div>
        )
      )}
    </div>
  )
}
