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

function QuincyPlaceholder() {
  const nav = useNavigate()
  return (
    <div className="cp-wrap cp-quincy">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <textarea className="cp-qbox" rows={7} placeholder="Describe the problem and see what Quincy recommends …" />
      <div className="cp-qhead">“Hey Quincy! What’s wrong with my Air Conditioner?”</div>
      <div className="cp-qrow">
        <span className="cp-qbadge">
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGgAAABpCAYAAADWQGYEAAAjQ0lEQVR42u2deZRdV3Xmf/ucO7xXazYy/ysW645EIQVIQfeANi6nUXHly3LuA493KccwnW/B2muG+gjFCIUPiCnhUwzM8Td/HcFUPDJ0vKMRhe1tOtpD9q5fNEW4Kfyz7vUvRcNH+VsaCaSpHZsah3yCGGP5sF/wq1Zt6AJLbxvYj1CIuHcAhSg+Bf0Z/97PRi8fc/nb9gA5l7PpmmP5MHvwBRvyRA5HfEPczMRPWApP/RtL336f/eZ6j/3k8vt4eHhKQifmJ9150PTgyOxMPF/TdO8kcbx9TxV3LSw5mWOhp8718VcXi0sHi8VycfnY39ssKISeaQX76fN+LcBz/cK7+WUxYS6420vv1v+QTjZGMPe/2BlJTKeLrqG+liJx1SS/qWKaBh9zW0vuqIdQncPu9OyU/RB8esXn0dQmWAtzrTRR//QAN+K5WeGhxVN/9NCFOVJs3XA3FYDM8GW8NRy1+7eRXj3rain2zL/Wzcl31niWh4em4eGK//Dpvek7ymx93FV3dDi78OpM99aQ8/gEby1LGd1pmNZ3PH5hGNjcZNosfkDtzcDBzDGUwkZZqmGVm0h133znooGKM3a+MwGyIvUwKyeShZidWMMR3EI+XmVzRm4j9FfE3Z1e7FwZecBgeLGaDazb1Jd1TClJf1kVTcI2ZtxJpdMSn9ocTpETx5xF7cgd7rscUywbLuZd8/IuhQni88JX43ZZM0FZNwq6xAMBrho/lv83lI6IUx4hDTHpyYcfsLvTxqa4aUG/dx6M/PoWtzos8/SgHqKBpVCa8OHKLl5LRZW6eMILWz4EFPefzQIpmIj/vLMOQCtra/T6+tbCjJMPSqYJj1ag33RYFUukZERTQ5oSkefgM2MVCSRjHgBNzkctRSCntJeHMI1Oc/Waq5sMdRo+J9e7i7whet3Av7RxRf1/2e3tBO37AaquJJENHsc4uopKr1/N5qKz/abNNCTP0OEkmHpfotT0FcCCTyRZJR2FAPSuru5rvwkEt7q44MwXewCdvKg+CcxtfK/ALVRkySyMSuP4ojiAjgfYdPMP3qPRLfhMyJKI1Sq0IVLGZP8bvwFwjCB3OkJYGmGYlzD66YYkFakbJYXpDhgtTW1p6kmanY57Lrjy4xkcfem1rafzi3lk929e1nu2FfcNPf1e6JLv5wu6kxfZy7ZaIGffDvxcaqp0iaBqKfDBJWlOKqQRAKH5aoZa7DrkjdQLQgTdGXm8Cnss/Gab8l/lsobI3XnhOTJe8KnEglfTxgkcHh9fn0fcX92FyvXvZQftYNkWwqj9h+fBCIOj8x5JYH2oX6Sip8Ct8bRSoMj4v5RvnAiAYcaJoLq/gY38lOQT8ZUzbixDJRyWDPvkU7vJoaZLu1n6P2UzQit93FfY3moehhDJ3HVG8/C6VAkcGSUbG0QzULMUJfJq3PBtuuANAJjgDyhBkAIbRO7lihqWNTz0B23MIqqBmByrmvHafoByKnDXlNkCKwKkQ/BFpKUoCMHTodm3rZHVN8H5/c6GgFxLcDrWe0RhA97Hr48HDWK/ceExRI38J4OY0/89on4zcC/9tH8MAReFI7wKN6tvExwRDE0ahJp3vG7WMv8wAAAAAElFTkSuQmCC" alt="Quincy" />
        </span>
        <svg className="cp-qmic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0012 0M12 17v4M9 21h6" />
        </svg>
      </div>
      <button className="cp-btn" onClick={() => { window.location.href = 'tel:3524846341' }}>Call for Service</button>
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
          <Route path="equipment" element={<CustomerEquipment customer={customer} properties={properties} />} />
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
    </div>
  )
}
