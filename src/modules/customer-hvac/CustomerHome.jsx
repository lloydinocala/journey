import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

function Ic({ d }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  )
}
const I = {
  schedule: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
  plan: <><path d="M9 12l2 2 4-4" /><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></>,
  quincy: <><path d="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1H9l-4 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></>,
  equip: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  filter: <><path d="M3 5h18l-7 8v6l-4-2v-4z" /></>,
  records: <><path d="M6 2h9l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>,
  pin: <><path d="M12 21s-7-5.2-7-11a7 7 0 0114 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  phone: <><path d="M4 4h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 6a2 2 0 012-2z" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
}

// Home = the customer's OWN home photo, their ID card, then the feature menu.
// "This is about you." Street View fills the hero automatically once a Google
// Maps key is set (VITE_GOOGLE_MAPS_KEY); until then it falls back to the sky.
export default function CustomerHome({ customer, properties }) {
  const nav = useNavigate()
  const prop = properties[0]
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.display_name || 'Your account'
  const initials = ((customer.first_name || customer.display_name || '?')[0] + (customer.last_name ? customer.last_name[0] : '')).toUpperCase()

  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY
  const addr = prop ? [prop.street_address, prop.city, prop.state, prop.zip].filter(Boolean).join(', ') : ''
  const heroBg = key && addr
    ? `url(https://maps.googleapis.com/maps/api/streetview?size=760x420&location=${encodeURIComponent(addr)}&key=${key})`
    : 'linear-gradient(135deg,#5EA6E6 0%,#3E86D0 55%,#00B0F0 100%)'

  const feats = [
    { k: 'equip', tone: '', label: 'See My Equipment Details', sub: 'Your system, warranties & coverage at a glance', to: '/portal/equipment' },
    { k: 'schedule', tone: '', label: 'Schedule My Appointment', sub: 'Repair, tune-up, or estimate — booked in a minute', to: '/portal/schedule' },
    { k: 'plan', tone: 'pm', label: 'Preventive Maintenance', sub: 'Protect your comfort, avoid surprise breakdowns', to: '/portal/plan' },
    { k: 'records', tone: '', label: 'Access My Service Records', sub: 'Every visit, invoice & estimate in one place', to: '/portal/records' },
    { k: 'filter', tone: '', label: 'Order My AC Filters', sub: 'The exact filter for your system, delivered', to: '/portal/filters' },
    { k: 'quincy', tone: 'q', label: 'Ask Quincy: Why?', sub: 'Your AI helper for anything about your home’s air', to: '/portal/quincy' },
  ]

  return (
    <>
      <div className="cp-hero">
        <div className="cp-heroimg" style={{ backgroundImage: heroBg }} />
        <div className="cp-brandtag">AIR-CARE CONNECT</div>
        <button className="cp-hero-signout" onClick={() => supabase.auth.signOut()}>Sign Out</button>
        <div className="cp-yourhome">YOUR HOME</div>
      </div>

      <div className="cp-idcard">
        <div className="cp-idhead">
          <div className="cp-avatar">{initials}</div>
          <div className="cp-nm">{name}</div>
          <button className="cp-editbtn" onClick={() => nav('/portal/profile')}>Edit</button>
        </div>
        {prop && (
          <div className="cp-idrow"><Ic d={I.pin} /><div>{[prop.street_address, prop.unit].filter(Boolean).join(' ')}{(prop.city || prop.state || prop.zip) && <><br />{[prop.city, prop.state].filter(Boolean).join(', ')} {prop.zip}</>}</div></div>
        )}
        {customer.primary_phone && <div className="cp-idrow"><Ic d={I.phone} /><div>{customer.primary_phone}</div></div>}
        {customer.email_1 && <div className="cp-idrow"><Ic d={I.mail} /><div>{customer.email_1}</div></div>}
      </div>

      <div className="cp-sec">How can we help?</div>
      <div className="cp-feats">
        {feats.map(f => (
          <button key={f.k} className="cp-feat" onClick={() => nav(f.to)}>
            <div className={'cp-fic ' + f.tone}><Ic d={I[f.k]} /></div>
            <div className="cp-ftext"><b>{f.label}</b><span>{f.sub}</span></div>
            <div className="cp-fchev">›</div>
          </button>
        ))}
      </div>
    </>
  )
}
