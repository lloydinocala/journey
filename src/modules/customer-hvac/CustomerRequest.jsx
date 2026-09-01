import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const TYPES = {
  pm: { title: 'Schedule maintenance', lead: 'Book a maintenance tune-up for your system.', cta: 'Request my tune-up' },
  repair: { title: 'Request a repair', lead: 'Tell us what’s going on and we’ll get a technician out.', cta: 'Request service' },
  system_quote: { title: 'New system quote', lead: 'Looking to replace or upgrade? We’ll set up a free quote visit.', cta: 'Request my quote' },
  duct_cleaning: { title: 'Duct cleaning quote', lead: 'We’ll get you a quote for duct cleaning.', cta: 'Request a quote' },
}
const WINDOWS = ['As soon as possible', 'Weekday mornings', 'Weekday afternoons', 'Weekends', 'I’ll pick a time by phone']

export default function CustomerRequest({ customer, properties }) {
  const { type } = useParams()
  const nav = useNavigate()
  const cfg = TYPES[type] || TYPES.repair
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '')
  const [details, setDetails] = useState('')
  const [win, setWin] = useState(WINDOWS[0])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true); setError('')
    const { error: err } = await supabase.rpc('submit_customer_request', {
      p_property_id: propertyId || null,
      p_type: type in TYPES ? type : 'other',
      p_details: details,
      p_window: win,
    })
    setBusy(false)
    if (err) setError(err.message)
    else setDone(true)
  }

  if (done) return (
    <div className="cp-center">
      <div style={{ fontSize: 46 }}>✅</div>
      <h2 className="cp-h2">We’ve got your request</h2>
      <p className="cp-lead" style={{ maxWidth: 340 }}>
        Thanks{customer.first_name ? `, ${customer.first_name}` : ''}! Our office will reach out
        shortly to confirm a time that works for you.
      </p>
      <button className="cp-btn" style={{ maxWidth: 260 }} onClick={() => nav('/portal')}>Back to home</button>
    </div>
  )

  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">{cfg.title}</h2>
      <p className="cp-lead">{cfg.lead}</p>

      {properties.length > 1 && (
        <>
          <div className="cp-label">Which property?</div>
          <select className="cp-sel" value={propertyId} onChange={e => setPropertyId(e.target.value)}>
            {properties.map(p => (
              <option key={p.id} value={p.id}>
                {[p.street_address, p.unit, p.city].filter(Boolean).join(', ') || 'My property'}
              </option>
            ))}
          </select>
        </>
      )}

      <div className="cp-label">
        {type === 'repair' ? 'What’s happening?' : 'Anything we should know?'}
      </div>
      <textarea className="cp-ta" value={details} onChange={e => setDetails(e.target.value)}
        placeholder={type === 'repair'
          ? 'e.g. AC is running but not cooling, started yesterday…'
          : 'Optional — the more you tell us, the better we can prepare.'} />

      <div className="cp-label">When works best?</div>
      <div className="cp-chips">
        {WINDOWS.map(w => (
          <button key={w} className={`cp-chip ${win === w ? 'on' : ''}`} onClick={() => setWin(w)}>{w}</button>
        ))}
      </div>

      {error && <div className="cp-err">{error}</div>}
      <div style={{ height: 18 }} />
      <button className="cp-btn" onClick={submit} disabled={busy}>{busy ? 'Sending…' : cfg.cta}</button>
      <p className="cp-note">This sends a request to our office — it doesn’t book a time slot yet.
        We’ll confirm the appointment with you directly.</p>
    </div>
  )
}
