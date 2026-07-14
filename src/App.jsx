import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import Login from './Login'
import SetPassword from './SetPassword'
import Layout from './Layout'
import Dashboard from './Dashboard'
import Organizations from './Organizations'
import Customers from './Customers'
import CustomerHistory from './CustomerHistory'
import Properties from './Properties'
import Jobs from './Jobs'
import Settings from './Settings'
import Team from './Team'
import Calendar from './Calendar'
import Pricebook from './Pricebook'
import SystemsPricebook from './SystemsPricebook'
import MaintenanceAgreementTiers from './MaintenanceAgreementTiers'
import MaintenanceAgreements from './MaintenanceAgreements'
import Invoice from './Invoice'
import Invoices from './Invoices'
import Estimate from './Estimate'
import Estimates from './Estimates'
import Announcements from './Announcements'
import PublicInvoice from './PublicInvoice'
import SystemEstimate from './SystemEstimate'

async function logSignIn(userId) {
  const { data } = await supabase.from('users').select('org_id').eq('id', userId).single()
  await supabase.from('session_log').insert({
    org_id: data?.org_id || null,
    user_id: userId,
    event: 'sign_in',
    source: 'desktop',
  })
}

function AuthenticatedApp() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [needsPassword, setNeedsPassword] = useState(
    window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery')
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'SIGNED_IN' && newSession?.user) {
        logSignIn(newSession.user.id)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    Promise.all([
      supabase.from('users').select('full_name, role, org_id').eq('id', session.user.id).single(),
      supabase.from('user_permissions').select('permission_key').eq('user_id', session.user.id),
    ]).then(([userRes, permsRes]) => {
      if (!userRes.data) {
        setProfile(null)
        return
      }
      setProfile({
        ...userRes.data,
        permissions: (permsRes.data || []).map((p) => p.permission_key),
      })
    })
  }, [session])

  if (session === undefined) return null
  if (!session) return <Login />
  if (needsPassword) return <SetPassword onDone={() => setNeedsPassword(false)} />
  if (!profile) return null

  return (
    <Routes>
      <Route element={<Layout profile={profile} />}>
        <Route path="/" element={<Dashboard profile={profile} />} />
        <Route path="/customers" element={<Customers profile={profile} />} />
        <Route path="/customers/:customerId" element={<CustomerHistory profile={profile} />} />
        <Route path="/properties" element={<Properties profile={profile} />} />
        <Route path="/jobs" element={<Jobs profile={profile} />} />
        <Route path="/settings" element={<Settings profile={profile} />} />
        <Route path="/team" element={<Team profile={profile} />} />
        <Route path="/calendar" element={<Calendar profile={profile} />} />
        <Route path="/pricebook" element={<Pricebook profile={profile} />} />
        <Route path="/systems-pricebook" element={<SystemsPricebook profile={profile} />} />
        <Route path="/maintenance-tiers" element={<MaintenanceAgreementTiers profile={profile} />} />
        <Route path="/maintenance-agreements" element={<MaintenanceAgreements profile={profile} />} />
        <Route path="/invoice/:jobId" element={<Invoice profile={profile} />} />
        <Route path="/estimate/:jobId" element={<Estimate profile={profile} />} />
        <Route path="/system-estimate/:jobId" element={<SystemEstimate profile={profile} />} />
        <Route path="/estimates" element={<Estimates profile={profile} />} />
        <Route path="/invoices" element={<Invoices profile={profile} />} />
        {profile.role === 'super_admin' && (
          <Route path="/announcements" element={<Announcements />} />
        )}
        {profile.role === 'super_admin' && (
          <Route path="/organizations" element={<Organizations />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/view-invoice/:invoiceId" element={<PublicInvoice />} />
        <Route path="*" element={<AuthenticatedApp />} />
      </Routes>
    </BrowserRouter>
  )
}
