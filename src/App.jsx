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
import TechJobs from './TechJobs'
import TechJobCard from './TechJobCard'
import TechInvoice from './TechInvoice'
import TechEstimate from './TechEstimate'
import TechSystemEstimate from './TechSystemEstimate'

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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    supabase
      .from('users')
      .select('full_name, role, org_id')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [session])

  if (session === undefined) return null
  if (!session) return <Login />
  if (needsPassword) return <SetPassword onDone={() => setNeedsPassword(false)} />
  if (!profile) return null

  return (
    <Routes>
      <Route path="/tech" element={<TechJobs profile={profile} />} />
      <Route path="/tech/:jobId" element={<TechJobCard profile={profile} />} />
      <Route path="/tech/invoice/:jobId" element={<TechInvoice profile={profile} />} />
      <Route path="/tech/estimate/:jobId" element={<TechEstimate profile={profile} />} />
      <Route path="/tech/system-estimate/:jobId" element={<TechSystemEstimate profile={profile} />} />
      <Route element={<Layout profile={profile} />}>
        <Route path="/" element={profile.role === 'tech' ? <Navigate to="/tech" replace /> : <Dashboard profile={profile} />} />
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
