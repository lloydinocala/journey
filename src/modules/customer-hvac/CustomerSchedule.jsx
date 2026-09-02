import { useNavigate } from 'react-router-dom'

// TODO: replace with the Air-Care Connect office number (digits only).
const OFFICE = '3525550100'

function Ic({ d }) {
  return (
    <svg className="cp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  )
}
function Glyph({ d }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
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
        <a className="cp-contactbtn text" href={`sms:${OFFICE}`}>
          <Glyph d={<><path d="M4 5h16a1 1 0 011 1v9a1 1 0 01-1 1H9l-4 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></>} />
          <span>Text Us</span>
        </a>
        <a className="cp-contactbtn call" href={`tel:${OFFICE}`}>
          <Glyph d={<><path d="M4 4h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 6a2 2 0 012-2z" /></>} />
          <span>Call Us</span>
        </a>
      </div>
    </div>
  )
}
