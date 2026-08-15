import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './utils/supabase'

// Type-ahead ADDRESS picker for the New Job flow. A dispatcher who only has the
// service address can find the job's target without first knowing the customer
// name. Queries properties by street address (debounced, per keystroke) and
// carries the owning customer along, so one pick resolves BOTH property and
// customer. Mirrors CustomerSearchSelect (portal dropdown so it isn't clipped).
export default function PropertySearchSelect({ orgId, onPick, placeholder = 'Type a service address…' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target) &&
        !(e.target.closest && e.target.closest('.property-search-portal'))
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (!open) return
    function updateRect() {
      if (inputRef.current) {
        const r = inputRef.current.getBoundingClientRect()
        setRect({ top: r.bottom, left: r.left, width: r.width })
      }
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [open])

  function handleInput(text) {
    setQuery(text)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!text.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('properties')
        .select('id, street_address, unit, city, customer_id, customers!properties_customer_id_fkey(display_name, is_banned)')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .ilike('street_address', `%${text.trim()}%`)
        .order('street_address')
        .limit(25)
      setResults(data || [])
    }, 250)
  }

  function label(p) {
    const addr = [p.street_address, p.unit].filter(Boolean).join(' — ')
    return `${addr} · ${p.customers?.display_name || 'Unknown customer'}`
  }

  function pick(p) {
    setQuery(label(p))
    setResults([])
    setOpen(false)
    onPick(p)
  }

  const showDropdown = open && (results.length > 0 || query.trim())

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => query.trim() && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {showDropdown &&
        rect &&
        createPortal(
          <div
            className="org-picker-list property-search-portal"
            style={{
              position: 'fixed',
              top: rect.top,
              left: rect.left,
              width: rect.width,
              maxHeight: 260,
              zIndex: 9999,
            }}
          >
            {results.map((p) => (
              <div key={p.id} className="org-picker-item" onClick={() => pick(p)}>
                {p.customers?.is_banned ? '⚠️ DO NOT SERVICE — ' : ''}
                {label(p)}
              </div>
            ))}
            {results.length === 0 && (
              <div className="org-picker-item" style={{ color: 'var(--mist)', cursor: 'default' }}>
                No matching address
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
