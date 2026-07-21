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
import JobsManagement from './JobsManagement'
import PayrollCapture from './PayrollCapture'
import TimeClock from './TimeClock'
import EmployeePayroll from './EmployeePayroll'
import Vendors from './Vendors'
import VendorDetail from './VendorDetail'
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
import JoinPlan from './JoinPlan'
import SystemEstimate from './SystemEstimate'
import SessionLog from './SessionLog'
import CustomerImport from './CustomerImport'
import PricebookImport from './PricebookImport'
import EquipmentImport from './EquipmentImport'
import PropertyImport from './PropertyImport'
import JobImport from './JobImport'
import TechJobs from './TechJobs'
import TechJobCard from './TechJobCard'
import TechInvoice from './TechInvoice'
import TechEstimate from './TechEstimate'
import TechSystemEstimate from './TechSystemEstimate'
import TechSchedule from './TechSchedule'
import TechNewJob from './TechNewJob'
import TechApollo from './TechApollo'
import TechInvoiceView from './TechInvoiceView'
// import PayrollDashboard from './modules/rewards-hvac/PayrollDashboard';  // TODO: re-enable when rewards-hvac Payroll module is finished

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
    if (!session) return
    const interval = setInterval(async () => {
      const { data: active } = await supabase.rpc('check_active_status')
      if (active === false) {
        await supabase.auth.signOut()
      }
    }, 20000)
    return () => clearInterval(interval)
  }, [session])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    Promise.all([
      supabase.from('users').select('id, full_name, role, org_id, is_field_supervisor').eq('id', session.user.id).single(),
      supabase.from('user_permissions').select('permission_key').eq('user_id', session.user.id),
    ]).then(([userRes, permsRes]) => {
      if (!userRes.data) {
        setProfile(null)
        supabase.auth.signOut()
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
      <Route path="/tech" element={<TechJobs profile={profile} />} />
      <Route path="/tech/:jobId" element={<TechJobCard profile={profile} />} />
      <Route path="/tech/invoice/:jobId" element={<TechInvoice profile={profile} />} />
      <Route path="/tech/estimate/:jobId" element={<TechEstimate profile={profile} />} />
      <Route path="/tech/system-estimate/:jobId" element={<TechSystemEstimate profile={profile} />} />
      <Route path="/tech/schedule" element={<TechSchedule profile={profile} />} />
      <Route path="/tech/new-job" element={<TechNewJob profile={profile} mode="job" />} />
      <Route path="/tech/new-service-estimate" element={<TechNewJob profile={profile} mode="service-estimate" />} />
      <Route path="/tech/new-system-estimate" element={<TechNewJob profile={profile} mode="system-estimate" />} />
      <Route path="/tech/apollo" element={<TechApollo profile={profile} />} />
      <Route path="/tech/invoice-view/:invoiceId" element={<TechInvoiceView profile={profile} />} />
      <Route element={<Layout profile={profile} />}>
        {/* <Route path="/rewards-hvac" element={<PayrollDashboard />} /> */}  {/* TODO: re-enable with the import above when Payroll module is finished */}
        <Route path="/" element={profile.role === 'tech' ? <Navigate to="/tech" replace /> : <Dashboard profile={profile} />} />
        <Route path="/customers" element={<Customers profile={profile} />} />
        <Route path="/customers/:customerId" element={<CustomerHistory profile={profile} />} />
        <Route path="/jobs-management" element={<JobsManagement profile={profile} />} />
        <Route path="/payroll" element={<PayrollCapture profile={profile} />} />
        <Route path="/time-clock" element={<TimeClock profile={profile} />} />
        <Route path="/payroll/employee/:userId" element={<EmployeePayroll profile={profile} />} />
        <Route path="/vendors" element={<Vendors profile={profile} />} />
        <Route path="/vendors/:vendorId" element={<VendorDetail profile={profile} />} />
        <Route path="/properties" element={<Properties profile={profile} />} />
        <Route path="/jobs" element={<Jobs profile={profile} />} />
        <Route path="/settings" element={<Settings profile={profile} />} />
        <Route path="/team" element={<Team profile={profile} />} />
        <Route path="/session-log" element={<SessionLog profile={profile} />} />
        <Route path="/import/customers" element={<CustomerImport profile={profile} />} />
        <Route path="/import/properties" element={<PropertyImport profile={profile} />} />
        <Route path="/import/jobs" element={<JobImport profile={profile} />} />
        <Route path="/import/services-pricebook" element={<PricebookImport profile={profile} />} />
        <Route path="/import/systems-pricebook" element={<EquipmentImport profile={profile} />} />
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
        <Route path="/join-plan/:propertyId" element={<JoinPlan />} />
        <Route path="*" element={<AuthenticatedApp />} />
      </Routes>
    </BrowserRouter>
  )
}

