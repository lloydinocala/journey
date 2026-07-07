import { useState, useRef, useEffect } from 'react'

export default function OrgPicker({ orgs, value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const selected = orgs.find((o) => o.id === value)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = query
    ? orgs.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : orgs

  return (
    <div className="org-picker-wrap" ref={wrapRef}>
      <input
        type="text"
        value={open ? query : (selected?.name || '')}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        placeholder="Search organizations…"
      />
      {open && (
        <div className="org-picker-list">
          {filtered.map((o) => (
            <div
              key={o.id}
              className="org-picker-item"
              onClick={() => { onChange(o.id); setOpen(false); setQuery('') }}
            >
              {o.name}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="org-picker-item" style={{ color: 'var(--mist)' }}>No matches</div>
          )}
        </div>
      )}
    </div>
  )
}
