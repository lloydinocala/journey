import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './utils/supabase'

// Type-ahead customer picker. Never loads the full customer table — queries
// Supabase directly per keystroke (debounced), so this scales the same whether
// an org has 10 customers or 100,000.
//
// The results dropdown renders via a portal into document.body rather than
// inline, so it isn't clipped by any ancestor with overflow:hidden (e.g. mobile
// .section-card) — same reason native <select> dropdowns are never clipped by
// their container: they escape the normal layout/stacking context entirely.
export default function CustomerSearchSelect({ orgId, value, onChange, placeholder = 'Type a customer name…' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState(false)
  const [rect, setRect] = useState(null)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  // If a value is set from outside (editing an existing record) and we don't
  // have its label yet, fetch just that one row to display.
  useEffect(() => {
    if (!value) {
      setQuery('')
      return
    }
    setLoadingLabel(true)
    supabase
      .from('customers')
      .select('id, display_name')
      .eq('id', value)
      .single()
      .then(({ data }) => {
        if (data) setQuery(data.display_name)
        setLoadingLabel(false)
      })
  }, [value])

  useEffect(() => {
    function onClickOutside(e) {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target) &&
        !(e.target.closest && e.target.closest('.customer-search-portal'))
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
    if (value) onChange('', null) // typing invalidates the previous pick until they choose again

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!text.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, display_name, is_banned')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .ilike('display_name', `%${text.trim()}%`)
        .order('display_name')
        .limit(25)
      setResults(data || [])
    }, 250)
  }

  function pick(customer) {
    onChange(customer.id, customer)
    setQuery(customer.display_name)
    setResults([])
    setOpen(false)
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
        placeholder={loadingLabel ? 'Loading…' : placeholder}
        autoComplete="off"
      />
      {showDropdown &&
        rect &&
        createPortal(
          <div
            className="org-picker-list customer-search-portal"
            style={{
              position: 'fixed',
              top: rect.top,
              left: rect.left,
              width: rect.width,
              maxHeight: 260,
              zIndex: 9999,
            }}
          >
            {results.map((c) => (
              <div key={c.id} className="org-picker-item" onClick={() => pick(c)}>
                {c.is_banned ? '⚠️ DO NOT SERVICE — ' : ''}
                {c.display_name}
              </div>
            ))}
            {results.length === 0 && (
              <div className="org-picker-item" style={{ color: 'var(--mist)', cursor: 'default' }}>
                No matches
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
