import { useState, useRef, useEffect } from 'react'

// Multi-select status dropdown, styled to match the Job Estimates status picker.
export default function StatusFilter({ options, value, onChange, allLabel = 'All statuses', noun = 'statuses' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  const label = value.length === options.length ? allLabel
    : value.length === 0 ? `No ${noun}`
    : `${value.length} of ${options.length} ${noun}`
  return (
    <div style={{ position: 'relative', marginBottom: 10 }} ref={ref}>
      <button type="button" className="logout-button" onClick={() => setOpen(!open)}>{label} ▾</button>
      {open && (
        <div className="org-picker-list" style={{ right: 'auto', left: 0, minWidth: 200 }}>
          <div style={{ display: 'flex', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
            <button type="button" className="logout-button" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onChange(options.slice())}>Show all</button>
            <button type="button" className="logout-button" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onChange([])}>Clear</button>
          </div>
          {options.map((o) => (
            <label key={o} className="org-picker-item" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
