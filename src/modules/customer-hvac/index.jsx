import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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
        .select('id, first_name, last_name, display_name, email_1')
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
    <div className="cp-root">
      <header className="cp-head">
        <div>
          <h1>Air-Care Connect</h1>
          <div className="cp-sub">{customer.first_name ? `${customer.first_name}${customer.last_name ? ' ' + customer.last_name : ''}` : (customer.display_name || 'Your account')}</div>
        </div>
        <button className="cp-signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>
      <Routes>
        <Route path="/portal" element={<CustomerHome customer={customer} properties={properties} />} />
        <Route path="/portal/records" element={<CustomerRecords customer={customer} properties={properties} />} />
        <Route path="/portal/equipment" element={<CustomerEquipment />} />
        <Route path="/portal/schedule" element={<CustomerSchedule />} />
        <Route path="/portal/book/:type" element={<CustomerBook customer={customer} properties={properties} />} />
        <Route path="/portal/request/:type" element={<CustomerRequest customer={customer} properties={properties} />} />
        <Route path="/portal/filters" element={<CustomerFilters customer={customer} properties={properties} />} />
        <Route path="/portal/profile" element={<CustomerProfile customer={customer} properties={properties} />} />
        <Route path="/portal/plan" element={<CustomerPlan customer={customer} properties={properties} />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    </div>
  )
}
