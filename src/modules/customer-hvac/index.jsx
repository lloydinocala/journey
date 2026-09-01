import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import './portal.css'
import CustomerLogin from './CustomerLogin'
import CustomerHome from './CustomerHome'
import CustomerRecords from './CustomerRecords'
import CustomerRequest from './CustomerRequest'
import CustomerPlan from './CustomerPlan'
import CustomerSchedule from './CustomerSchedule'
import CustomerBook from './CustomerBook'
import CustomerEquipment from './CustomerEquipment'
import CustomerFilters from './CustomerFilters'
import CustomerProfile from './CustomerProfile'

function QuincyPlaceholder() {
  const nav = useNavigate()
  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">Ask Quincy</h2>
      <p className="cp-lead">Quincy is your Air-Care AI helper — ask about your system, an odd noise or smell, or what a recent visit covered.</p>
      <div className="cp-card"><p style={{ margin: 0, fontSize: 14.5 }}>Quincy is being set up for the homeowner app and will be here shortly. In the meantime, our team is glad to help — book a visit and we'll take care of it.</p></div>
      <button className="cp-btn" onClick={() => nav('/portal/schedule')}>Schedule a visit</button>
    </div>
  )
}

// Self-contained customer app. Mounted at /portal/* in App.jsx, OUTSIDE the
// staff AuthenticatedApp — its own auth context, its own data boundary (RLS).
export default function CustomerPortal() {
  const [session, setSession] = useState(undefined)
  const [customer, setCustomer] = useState(undefined) // undefined=loading, null=unrecognized
  const [properties, setProperties] = useState([])

  // Give the homeowner portal its OWN installable identity while mounted, so the
  // phone treats it as a separate app from the staff (Tech) app on the same domain:
  // its own manifest, home-screen icon (apple-touch-icon), app name, and theme.
  useEffect(() => {
    const setLink = (rel, href) => {
      let el = document.querySelector(`link[rel="${rel}"]`)
      const prev = el ? el.getAttribute('href') : null
      const created = !el
      if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el) }
      el.setAttribute('href', href)
      return () => { if (prev != null) el.setAttribute('href', prev); else if (created) el.remove() }
    }
    const setMeta = (name, content) => {
      let el = document.querySelector(`meta[name="${name}"]`)
      const prev = el ? el.getAttribute('content') : null
      const created = !el
      if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el) }
      el.setAttribute('content', content)
      return () => { if (prev != null) el.setAttribute('content', prev); else if (created) el.remove() }
    }
    const restores = [
      setLink('manifest', '/portal.webmanifest'),
      setLink('apple-touch-icon', '/portal-icon.png'),
      setMeta('apple-mobile-web-app-title', 'Air-Care Connect'),
      setMeta('apple-mobile-web-app-capable', 'yes'),
      setMeta('theme-color', '#4E95D9'),
    ]
    const prevTitle = document.title
    document.title = 'Air-Care Connect'
    return () => { restores.forEach(r => r && r()); document.title = prevTitle }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setCustomer(undefined); return }
    let live = true
    ;(async () => {
      // Link this auth user to their customer record (idempotent), then load it.
      await supabase.rpc('claim_customer_portal')
      const { data: cust } = await supabase
        .from('customers')
        .select('id, first_name, last_name, display_name, company, primary_phone, secondary_phone, email_1, email_2')
        .eq('auth_user_id', session.user.id)
        .maybeSingle()
      if (!live) return
      if (!cust) { setCustomer(null); return }
      const { data: props } = await supabase
        .from('properties')
        .select('id, street_address, unit, city, state, zip')
        .eq('is_active', true)
      if (!live) return
      setProperties(props || [])
      setCustomer(cust)
    })()
    return () => { live = false }
  }, [session])

  if (session === undefined) return null
  if (!session) return <CustomerLogin />
  if (customer === undefined) return <div className="cp-root"><div className="cp-center">Loading your account…</div></div>

  if (customer === null) return (
    <div className="cp-root">
      <div className="cp-center">
        <div style={{ fontSize: 42 }}>🔎</div>
        <h2 className="cp-h2">We couldn’t find your account</h2>
        <p className="cp-lead" style={{ maxWidth: 340 }}>
          The email you used isn’t on file yet. Please use the same address you gave us for
          service, or give the office a call and we’ll get you set up.
        </p>
        <button className="cp-btn ghost" style={{ maxWidth: 240 }} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  )

  return (
    <div className="cp-app">
      <div className="cp-scroll">
        <Routes>
          <Route index element={<CustomerHome customer={customer} properties={properties} />} />
          <Route path="records" element={<CustomerRecords customer={customer} properties={properties} />} />
          <Route path="equipment" element={<CustomerEquipment />} />
          <Route path="schedule" element={<CustomerSchedule />} />
          <Route path="book/:type" element={<CustomerBook customer={customer} properties={properties} />} />
          <Route path="request/:type" element={<CustomerRequest customer={customer} properties={properties} />} />
          <Route path="filters" element={<CustomerFilters customer={customer} properties={properties} />} />
          <Route path="profile" element={<CustomerProfile customer={customer} properties={properties} />} />
          <Route path="plan" element={<CustomerPlan customer={customer} properties={properties} />} />
          <Route path="quincy" element={<QuincyPlaceholder />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </div>
      <PortalNav />
    </div>
  )
}

function NIc({ d }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
}
function PortalNav() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const tabs = [
    { to: '/portal', label: 'Home', d: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></> },
    { to: '/portal/schedule', label: 'Schedule', d: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></> },
    { to: '/portal/records', label: 'Records', d: <><path d="M6 2h9l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" /><path d="M14 2v6h6" /></> },
    { to: '/portal/quincy', label: 'Quincy', d: <><path d="M12 3l2.1 4.9L19 9l-4 3.2L16 18l-4-2.6L8 18l1-5.8L5 9z" /></> },
  ]
  const active = (to) => to === '/portal' ? pathname === '/portal' : pathname.startsWith(to)
  return (
    <nav className="cp-bnav">
      {tabs.map(t => (
        <button key={t.to} className={active(t.to) ? 'on' : ''} onClick={() => nav(t.to)}>
          <NIc d={t.d} /><span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
