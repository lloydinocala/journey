import { useNavigate } from 'react-router-dom'

function Ic({ d }) {
  return (
    <svg className="cp-ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  )
}
const ICONS = {
  schedule: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M8 14h3" /></>,
  records: <><path d="M6 2h9l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>,
  equip: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4M8 8h4" /></>,
  filter: <><path d="M3 5h18l-7 8v6l-4-2v-4z" /></>,
  plan: <><path d="M9 12l2 2 4-4" /><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></>,
  quincy: <><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" opacity="0" /><path d="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1H9l-4 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></>,
}

// Home = the customer's ID card, then the 2-column menu, in the mockup's order.
export default function CustomerHome({ customer, properties }) {
  const nav = useNavigate()
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.display_name || 'Your account'
  const prop = properties[0]

  const tiles = [
    { k: 'schedule', label: 'Schedule an Appointment', to: '/portal/schedule' },
    { k: 'records',  label: 'Access Your Service Records', to: '/portal/records' },
    { k: 'equip',    label: 'See Your Equipment Details', to: '/portal/equipment' },
    { k: 'filter',   label: 'Order AC Filters', to: '/portal/filters' },
    { k: 'plan',     label: 'Preventive Maintenance', to: '/portal/plan' },
    { k: 'quincy',   label: 'Ask Quincy', to: '/portal/quincy' },
  ]

  return (
    <div className="cp-wrap">
      <button className="cp-idcard" onClick={() => nav('/portal/profile')}>
        <div className="cp-idmain">
          <b>{name}</b>
          {prop && (
            <span>
              {[prop.street_address, prop.unit].filter(Boolean).join(' ')}
              {(prop.city || prop.state || prop.zip) && <><br />{[prop.city, prop.state].filter(Boolean).join(', ')} {prop.zip}</>}
            </span>
          )}
          {customer.primary_phone && <span>{customer.primary_phone}</span>}
          {customer.email_1 && <span>{customer.email_1}</span>}
        </div>
        <span className="cp-editlink">Edit ›</span>
      </button>

      <div className="cp-grid">
        {tiles.map(t => (
          <button key={t.k} className="cp-tile" onClick={() => nav(t.to)}>
            <div className="cp-ic"><Ic d={ICONS[t.k]} /></div>
            <b>{t.label}</b>
          </button>
        ))}
      </div>
    </div>
  )
}
