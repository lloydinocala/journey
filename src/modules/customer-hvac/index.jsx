import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
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
import CustomerQuincy from './CustomerQuincy'
import CustomerServiceRequests from './CustomerServiceRequests'

// Self-contained customer app. Mounted at /portal/* in App.jsx, OUTSIDE the
// staff AuthenticatedApp — its own auth context, its own data boundary (RLS).
export default function CustomerPortal() {
  const [session, setSession] = useState(undefined)
  const [customer, setCustomer] = useState(undefined) // undefined=loading, null=unrecognized
  const [properties, setProperties] = useState([])
  const [activePropertyId, setActivePropertyId] = useState(null)

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

  useEffect(() => {
    if (!properties.length) { setActivePropertyId(null); return }
    setActivePropertyId((cur) => {
      if (cur && properties.some((p) => p.id === cur)) return cur
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('cp_active_property') : null
      return properties.some((p) => p.id === saved) ? saved : properties[0].id
    })
  }, [properties])
  useEffect(() => { if (activePropertyId && typeof localStorage !== 'undefined') localStorage.setItem('cp_active_property', activePropertyId) }, [activePropertyId])

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

  const activeProperty = properties.find((p) => p.id === activePropertyId) || properties[0] || null

  return (
    <div className="cp-app">
      <div className="cp-scroll">
        <Routes>
          <Route index element={<CustomerHome customer={customer} properties={properties} activePropertyId={activePropertyId} setActivePropertyId={setActivePropertyId} />} />
          <Route path="records" element={<CustomerRecords customer={customer} properties={properties} />} />
          <Route path="equipment" element={<CustomerEquipment customer={customer} properties={properties} activePropertyId={activePropertyId} />} />
          <Route path="schedule" element={<CustomerSchedule />} />
          <Route path="book/:type" element={<CustomerBook customer={customer} properties={properties} activePropertyId={activePropertyId} />} />
          <Route path="request/:type" element={<CustomerRequest customer={customer} properties={properties} />} />
          <Route path="filters" element={<CustomerFilters customer={customer} properties={properties} activePropertyId={activePropertyId} />} />
          <Route path="profile" element={<CustomerProfile customer={customer} properties={properties} />} />
          <Route path="plan" element={<CustomerPlan customer={customer} properties={properties} activeProperty={activeProperty} />} />
          <Route path="quincy" element={<CustomerQuincy />} />
          <Route path="requests" element={<CustomerServiceRequests />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </div>
    </div>
  )
}
