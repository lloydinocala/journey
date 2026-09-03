import { useState, useRef, useEffect } from 'react'

// The super-admin "Viewing organization" choice persists across screens for the
// session, so switching org on one screen carries to the next instead of each
// screen silently resetting to the login org (which made boards look empty).
const STORE_KEY = 'journey_viewing_org'

export default function OrgPicker({ orgs, value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const selected = orgs.find((o) => o.id === value)

  // On mount, adopt the previously-picked org if this screen defaulted elsewhere.
  useEffect(() => {
    const stored = localStorage.getItem(STORE_KEY)
    if (stored && stored !== value) onChange(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function choose(id) {
    localStorage.setItem(STORE_KEY, id)
    onChange(id)
    setOpen(false)
    setQuery('')
  }

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
              onClick={() => choose(o.id)}
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
