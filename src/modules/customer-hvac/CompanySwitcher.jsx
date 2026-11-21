import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'

// For customers of more than one HVAC company that uses Journey (same email at each).
// Their records belong to them, so they can flip between companies as often as they like.
// Shows nothing for customers of a single company.
export default function CompanySwitcher({ note }) {
  const [companies, setCompanies] = useState([])
  const [switching, setSwitching] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    supabase.rpc('customer_portal_list').then(({ data }) => { if (live) setCompanies(data || []) })
    return () => { live = false }
  }, [])

  async function switchTo(id) {
    setSwitching(id); setError('')
    const { error: err } = await supabase.rpc('customer_portal_switch', { p_customer: id })
    if (err) { setSwitching(''); setError(err.message); return }
    try { localStorage.removeItem('cp_brand'); localStorage.removeItem('cp_active_property') } catch (_) { /* ignore */ }
    // Reload on the same page so everything shows the chosen company's records.
    window.location.assign(window.location.pathname + window.location.search)
  }

  if (companies.length < 2) return null

  return (
    <div className="cp-card">
      <div className="cp-label" style={{ marginTop: 0 }}>Showing records from</div>
      {note && <p className="cp-note" style={{ marginTop: 2 }}>{note}</p>}
      <div className="cp-chips" style={{ marginTop: 8 }}>
        {companies.map((c) => (
          <button
            key={c.customer_id}
            type="button"
            className={'cp-chip' + (c.is_current ? ' on' : '')}
            disabled={!!switching}
            aria-pressed={c.is_current}
            onClick={() => { if (!c.is_current) switchTo(c.customer_id) }}
          >
            {c.org_name}{switching === c.customer_id ? ' …' : ''}
          </button>
        ))}
      </div>
      {error && <div className="cp-err" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  )
}
