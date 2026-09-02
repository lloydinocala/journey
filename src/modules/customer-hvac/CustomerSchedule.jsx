import { useNavigate } from 'react-router-dom'

const OFFICE = '3524846341'

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
    <div className="cp-wrap cp-schedscreen">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">Schedule an Appointment</h2>
      <p className="cp-lead">Tell us what you need — we’ll confirm a time that works for you.</p>

      <div className="cp-grid cp-schedgrid">
        {OPTS.map(o => (
          <button
            key={o.type}
            className={'cp-tile' + (o.type === 'repair' ? ' emergency' : '')}
            onClick={() => nav(`/portal/book/${o.type}`)}
          >
            <div className="cp-ic"><Ic d={o.d} /></div>
            <div><b>{o.label}</b><span>{o.sub}</span></div>
          </button>
        ))}
      </div>

      <div className="cp-contact">
        <a className="cp-contacticon" href={`sms:${OFFICE}`}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 2H4a2 2 0 00-2 2v12a2 2 0 002 2h3v4l5-4h8a2 2 0 002-2V4a2 2 0 00-2-2z" /></svg>
          <span>Text Us</span>
        </a>
        <a className="cp-contacticon" href={`tel:${OFFICE}`}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.4 21 3 13.6 3 4.5 3 3.95 3.45 3.5 4 3.5h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
          <span>Call Us</span>
        </a>
      </div>
    </div>
  )
}
