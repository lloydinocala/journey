// Item Catalog duplicate-finder. Deterministic and review-only: it groups active
// items that share a barcode, vendor part number, description, or SKU and shows
// the clusters for a human to reconcile. It NEVER merges or edits anything — the
// master catalog is only ever changed by a person.
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'

const norm = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '')

function findClusters(items) {
  const out = []
  const seen = new Set()
  const byKey = (keyFn, reason) => {
    const m = new Map()
    items.forEach((it) => { const k = keyFn(it); if (k) (m.get(k) || m.set(k, []).get(k)).push(it) })
    for (const [k, list] of m) {
      if (list.length > 1) {
        const sig = list.map((x) => x.id).sort().join(',')
        if (!seen.has(sig)) { seen.add(sig); out.push({ reason, key: k, items: list }) }
      }
    }
  }
  byKey((it) => norm(it.barcode), 'same barcode')
  byKey((it) => norm(it.vendor_part_no), 'same vendor part #')
  byKey((it) => norm(it.description), 'same description')
  byKey((it) => norm(it.sku), 'same SKU')
  return out
}

export default function ItemDuplicates({ orgId }) {
  const [items, setItems] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!orgId || !open || items != null) return
    let alive = true
    ;(async () => {
      const { data } = await supabase.from('elements_items')
        .select('id, sku, description, category, barcode, vendor_part_no')
        .eq('org_id', orgId).eq('is_active', true)
      if (!alive) return
      setItems(data || [])
    })()
    return () => { alive = false }
  }, [orgId, open, items])

  const clusters = items ? findClusters(items) : []

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, margin: '8px 0', background: '#FBFCFE' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{ border: '1px solid #1B3A6B', background: '#fff', color: '#1B3A6B', fontWeight: 600, fontSize: 13, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
          {open ? 'Hide duplicate check' : '🔍 Find possible duplicates'}
        </button>
        {open && items != null && <span style={{ fontSize: 12.5, color: 'var(--mist)', marginLeft: 'auto' }}>{clusters.length} possible duplicate group{clusters.length === 1 ? '' : 's'} · review only, nothing is merged</span>}
      </div>

      {open && (
        items == null ? <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>Scanning catalog…</p> : clusters.length === 0 ? (
          <p style={{ color: 'var(--mist)', fontSize: 13, margin: '10px 2px 2px' }}>No obvious duplicates found (by barcode, vendor part #, description, or SKU).</p>
        ) : (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clusters.slice(0, 100).map((c, i) => (
              <div key={i} style={{ border: '1px solid #EEF2F8', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#B0600A', textTransform: 'uppercase', letterSpacing: '.03em' }}>{c.reason}</div>
                {c.items.map((it) => (
                  <div key={it.id} style={{ fontSize: 13, display: 'flex', gap: 8 }}>
                    <span style={{ fontWeight: 600, minWidth: 90 }}>{it.sku || '(no SKU)'}</span>
                    <span style={{ color: 'var(--mist)' }}>{it.description || '—'}{it.category ? ` · ${it.category}` : ''}</span>
                  </div>
                ))}
              </div>
            ))}
            {clusters.length > 100 && <div style={{ fontSize: 12, color: 'var(--mist)' }}>Showing first 100 groups of {clusters.length}.</div>}
          </div>
        )
      )}
    </div>
  )
}
