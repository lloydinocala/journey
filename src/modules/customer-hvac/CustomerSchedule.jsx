import { useNavigate } from 'react-router-dom'

// "Schedule an Appointment" hub — mirrors the mockup grouping. Each option
// deep-links to the shared request form with the right type.
function Ic({ d }) {
  return (
    <svg className="cp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  )
}
const OPTS = [
  { type: 'repair', label: 'Service Call', sub: 'Something isn’t working right',
    d: <><path d="M14 7a4 4 0 00-5 5l-6 6 2 2 6-6a4 4 0 005-5l-2 2-2-2 2-2z" /></> },
  { type: 'system_quote', label: 'Free Estimate', sub: 'New system, upgrade or add-on',
    d: <><rect x="3" y="5" width="18" height="10" rx="2" /><path d="M7 20h10M12 15v5M7 9h4" /></> },
  { type: 'duct_cleaning', label: 'Duct Cleaning', sub: 'Cleaner air throughout the home',
    d: <><path d="M4 8h10a4 4 0 010 8H8" /><path d="M4 8v8M8 12h.01M11 12h.01" /></> },
  { type: 'pm', label: 'Preventive Maintenance', sub: 'Keep your system tuned up',
    d: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></> },
]

export default function CustomerSchedule() {
  const nav = useNavigate()
  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">Schedule an Appointment</h2>
      <p className="cp-lead">Tell us what you need — we’ll confirm a time that works for you.</p>
      <div className="cp-grid">
        {OPTS.map(o => (
          <button key={o.type} className="cp-tile" onClick={() => nav(`/portal/book/${o.type}`)}>
            <div className="cp-ic"><Ic d={o.d} /></div>
            <div><b>{o.label}</b><span>{o.sub}</span></div>
          </button>
        ))}
      </div>
    </div>
  )
}
