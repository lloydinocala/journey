import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const REVIEW_URL = 'https://g.page/r/CerYus2UsCxUEAI/review'

function Ic({ d, cls = 'cp-ic' }) {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  )
}
const ICONS = {
  plan: <><path d="M9 12l2 2 4-4" /><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></>,
  filter: <><path d="M3 5h18l-7 8v6l-4-2v-4z" /></>,
  equip: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4M8 8h4" /></>,
  schedule: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M8 14h3" /></>,
  records: <><path d="M6 2h9l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  pay: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  star: <><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.8 6.2 21.9l1.1-6.5L2.6 9.8l6.5-.9z" /></>,
  bell: <><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></>,
  chev: <path d="M9 6l6 6-6 6" />,
}

export default function CustomerHome({ customer, properties }) {
  const nav = useNavigate()
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    let live = true
    async function load() {
      const [invRes, agRes, vsRes] = await Promise.all([
        supabase.from('invoices').select('id, kind, invoice_number, amount_due, approval_status'),
        supabase.from('maintenance_agreements').select('id, status').eq('customer_id', customer.id),
        supabase.from('maintenance_visits')
          .select('id, status, due_date, completed_date').eq('customer_id', customer.id),
      ])
      if (!live) return
      const invoices = invRes.data || []
      const a = []
      const pendingEst = invoices.filter(i => i.kind === 'estimate' && (i.approval_status || '').toLowerCase() === 'pending')
      if (pendingEst.length)
        a.push({ tone: 'amber', title: `${pendingEst.length} estimate${pendingEst.length > 1 ? 's' : ''} waiting for you`,
          sub: 'Review and approve to get on the schedule', to: '/portal/records?tab=estimates' })
      const due = invoices.filter(i => Number(i.amount_due) > 0 && i.kind !== 'estimate')
      if (due.length) {
        const total = due.reduce((s, i) => s + Number(i.amount_due || 0), 0)
        a.push({ tone: 'pay', title: `Balance due: $${total.toFixed(2)}`,
          sub: `${due.length} invoice${due.length > 1 ? 's' : ''} ready to pay`, to: '/portal/records?tab=pay' })
      }
      const hasPlan = (agRes.data || []).some(x => x.status === 'active')
      if (!hasPlan)
        a.push({ tone: '', title: 'You don\u2019t have a maintenance plan yet',
          sub: 'Priority service and member savings \u2014 see plans', to: '/portal/plan' })
      const upcoming = (vsRes.data || []).filter(v => v.status && v.status !== 'completed')
      if (upcoming.length)
        a.push({ tone: '', title: 'Maintenance visit on the calendar',
          sub: 'View your upcoming service', to: '/portal/plan' })
      setAlerts(a)
    }
    load()
    return () => { live = false }
  }, [customer.id])

  // Tile labels mirror Lloyd's mockup.
  const tiles = [
    { k: 'plan',     label: 'Preventive Maintenance', sub: 'Your plan & visits',       to: '/portal/plan' },
    { k: 'filter',   label: 'Order AC Filters',       sub: 'Your sizes, delivered',    to: '/portal/filters' },
    { k: 'equip',    label: 'Equipment Details',      sub: 'Systems & warranty',       to: '/portal/equipment' },
    { k: 'schedule', label: 'Schedule an Appointment', sub: 'Service, estimate & more', to: '/portal/schedule' },
    { k: 'records',  label: 'Service Records',        sub: 'History & invoices',       to: '/portal/records' },
    { k: 'profile',  label: 'Edit Personal Info',     sub: 'Keep your details current', to: '/portal/profile' },
  ]

  const name = customer.first_name || customer.display_name || 'there'

  return (
    <div className="cp-wrap">
      <div className="cp-hero">
        <div className="cp-hi">Hi {name} 👋</div>
        <div className="cp-tag">Your Home · Your Comfort · Your Health · Your Money</div>
      </div>

      {alerts.length > 0 && (
        <div className="cp-alerts">
          {alerts.map((al, i) => (
            <button key={i} className={`cp-alert ${al.tone}`} onClick={() => nav(al.to)}>
              <Ic d={ICONS.bell} cls="cp-ai" />
              <div>
                <b>{al.title}</b>
                <span>{al.sub}</span>
              </div>
              <Ic d={ICONS.chev} cls="cp-chev" />
            </button>
          ))}
        </div>
      )}

      <div className="cp-grid">
        {tiles.map(t => (
          <button key={t.k} className="cp-tile" onClick={() => nav(t.to)}>
            <div className="cp-ic"><Ic d={ICONS[t.k]} /></div>
            <div>
              <b>{t.label}</b>
              <span>{t.sub}</span>
            </div>
          </button>
        ))}
        <button className="cp-tile cp-wide cp-pay" onClick={() => nav('/portal/records?tab=pay')}>
          <div className="cp-ic"><Ic d={ICONS.pay} /></div>
          <div><b>Make a Payment</b><span>Pay an invoice securely online</span></div>
        </button>
        <a className="cp-tile cp-wide cp-review" href={REVIEW_URL} target="_blank" rel="noreferrer"
          style={{ textDecoration: 'none' }}>
          <div className="cp-ic"><Ic d={ICONS.star} /></div>
          <div><b>Leave us a review</b><span>It really helps our small business</span></div>
        </a>
      </div>

      {properties.length > 1 && (
        <p className="cp-note" style={{ marginTop: 16 }}>
          You have {properties.length} properties on file — you'll choose which one applies
          when you request service or filters.
        </p>
      )}
    </div>
  )
}
