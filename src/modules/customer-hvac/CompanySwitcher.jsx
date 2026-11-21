import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'

// Records page only. A customer belongs to ONE HVAC company at a time (the one with the most
// recent activity); that company is the only one that can contact them or take orders.
// Their service history is theirs, though, so if they've used more than one company on Journey
// they can LOOK at the other company's past records here. Viewing never changes their company.
// Shows nothing for customers of a single company.
export default function CompanySwitcher({ viewing, onView }) {
  const [companies, setCompanies] = useState([])

  useEffect(() => {
    let live = true
    supabase.rpc('customer_portal_list').then(({ data }) => { if (live) setCompanies(data || []) })
    return () => { live = false }
  }, [])

  if (companies.length < 2) return null
  const current = companies.find((c) => c.is_current)

  return (
    <div className="cp-card">
      <div className="cp-label" style={{ marginTop: 0 }}>Showing records from</div>
      <p className="cp-note" style={{ marginTop: 2 }}>
        Your service history belongs to you. Tap a company to see the records it kept for you.
        {current ? ` ${current.org_name} is your current company.` : ''}
      </p>
      <div className="cp-chips" style={{ marginTop: 8 }}>
        {companies.map((c) => {
          const on = viewing ? viewing === c.customer_id : c.is_current
          return (
            <button key={c.customer_id} type="button" className={'cp-chip' + (on ? ' on' : '')} aria-pressed={on}
              onClick={() => onView(c.is_current ? null : c.customer_id)}>
              {c.org_name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
