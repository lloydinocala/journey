import { useState, useRef, useEffect } from 'react'
import { supabase } from './utils/supabase'

// Super-admin "Viewing organization" switcher, built to scale to any number of
// subscribers: it never loads the full org list. Typing runs a server-side
// name search (ILIKE, capped at 25 rows); the last pick persists per session so
// the choice carries across screens.
const STORE_KEY = 'journey_viewing_org'

export default function OrgSwitchPill({ value, orgName, pageLabel = 'HOME', onChange }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  // Close when clicking outside.
  useEffect(() => {
    function onDoc(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Debounced server search while the menu is open. Empty query = first 25 A–Z.
  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    const t = setTimeout(async () => {
      let sel = supabase.from('organizations').select('id, name').order('name').limit(25)
      if (q.trim()) sel = supabase.from('organizations').select('id, name').ilike('name', `%${q.trim()}%`).order('name').limit(25)
      const { data } = await sel
      if (alive) { setResults(data || []); setLoading(false) }
    }, 180)
    return () => { alive = false; clearTimeout(t) }
  }, [q, open])

  function choose(id) {
    try { localStorage.setItem(STORE_KEY, id) } catch (e) { /* ignore */ }
    onChange(id)
    setOpen(false)
    setQ('')
  }

  return (
    <span className="dash-pill dash-pill--switch" ref={wrapRef}>
      <button
        type="button"
        className="vieworg-trigger"
        onClick={() => { setOpen((o) => !o); setTimeout(() => inputRef.current && inputRef.current.focus(), 0) }}
        title="Switch organization"
      >
        {orgName || 'Select organization'} <span className="vieworg-caret" aria-hidden="true">▾</span>
      </button>
      <span className="vieworg-sep">/</span>
      <span className="vieworg-page">{pageLabel}</span>
      {open && (
        <div className="vieworg-menu">
          <input
            ref={inputRef}
            className="vieworg-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search organizations…"
          />
          <div className="vieworg-results">
            {loading && <div className="vieworg-result muted">Searching…</div>}
            {!loading && results.map((o) => (
              <div
                key={o.id}
                className={'vieworg-result' + (o.id === value ? ' active' : '')}
                onClick={() => choose(o.id)}
              >
                {o.name}
              </div>
            ))}
            {!loading && results.length === 0 && <div className="vieworg-result muted">No matches</div>}
          </div>
        </div>
      )}
    </span>
  )
}
