import { useState, useEffect, useRef } from 'react'
import { supabase } from './utils/supabase'

// Search-as-you-type picker for catalog items. Queries the server (search_parts)
// so it scales to tens of thousands of parts instead of rendering a giant <select>.
// onSelect receives the full item row (id, generic_name, base_unit, sell_unit_factor,
// is_inventory, ...) or null when cleared.
export default function ItemSearchSelect({ orgId, valueLabel, onSelect, placeholder = 'Search parts…', autoFocus = false }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase.rpc('search_parts', {
        p_org: orgId, p_q: q.trim(), p_filter: 'all', p_limit: 20, p_offset: 0,
      })
      setResults(data || []); setActive(0); setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [q, open, orgId])

  useEffect(() => {
    function onDoc(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function pick(it) { onSelect(it); setOpen(false); setQ('') }

  // Collapsed state: show the chosen item with a "change" affordance.
  if (valueLabel && !open) {
    return (
      <div ref={boxRef} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 170 }}>
        <span style={{ fontWeight: 600, color: '#002060', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }} title={valueLabel}>{valueLabel}</span>
        <button type="button" onClick={() => { setOpen(true); setQ('') }}
          style={{ background: 'none', border: 'none', color: '#215F9A', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}>change</button>
      </div>
    )
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', minWidth: 200 }}>
      <input
        autoFocus={autoFocus}
        value={q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
        style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border,#ccc)', fontSize: 13 }}
      />
      {open && (q.trim() || results.length > 0) && (
        <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d7dbe2', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 280, overflowY: 'auto', marginTop: 2 }}>
          {loading && <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--mist,#777)' }}>Searching…</div>}
          {!loading && results.length === 0 && q.trim() && <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--mist,#777)' }}>No matches.</div>}
          {results.map((it, i) => (
            <div key={it.id}
              onMouseDown={(e) => { e.preventDefault(); pick(it) }}
              onMouseEnter={() => setActive(i)}
              style={{ padding: '7px 10px', cursor: 'pointer', background: i === active ? '#EEF3FB' : '#fff', borderTop: i ? '1px solid #f0f1f4' : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#002060' }}>{it.generic_name}</div>
              <div style={{ fontSize: 11, color: 'var(--mist,#777)' }}>
                {it.category || 'Uncategorized'}{it.model_number ? ` · ${it.model_number}` : ''}{it.base_unit ? ` · base ${it.base_unit}` : ''}{Number(it.on_hand) > 0 ? ` · ${it.on_hand} on hand` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
