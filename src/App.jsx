 import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { loadOrgTz } from './utils/tz'
import { loadPermissions } from './utils/permissions'
import PartsCatalog from './PartsCatalog'
import PartsCatalogImport from './PartsCatalogImport'
import VendorPriceImport from './VendorPriceImport'
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
import Tasks from './Tasks'
import VendorDetail from './VendorDetail'
import Properties from './Properties'
import Jobs from './Jobs'
import Settings from './Settings'
import Team from './Team'
import Calendar from './Calendar'
import Pricebook from './Pricebook'
import SystemsPricebook from './SystemsPricebook'
import SpecialFeatures from './SpecialFeatures'
import SystemEstimateSetup from './SystemEstimateSetup'
import PMChecklists from './PMChecklists'
import TechPMChecklist from './TechPMChecklist'
import DiscountCatalog from './DiscountCatalog'
import OnCallSchedule from './OnCallSchedule'
import RolesConfig from './RolesConfig'
import MySchedule from './MySchedule'
import MaintenanceAgreementTiers from './MaintenanceAgreementTiers'
import ChecklistTemplates from './ChecklistTemplates'
import MaintenanceAgreements from './MaintenanceAgreements'
import MaintenanceDue from './MaintenanceDue'
import MaintenanceDashboard from './MaintenanceDashboard'
import Invoice from './Invoice'
import Invoices from './Invoices'
import Estimate from './Estimate'
import NewFollowupEstimate from './NewFollowupEstimate'
import Estimates from './Estimates'
import Announcements from './Announcements'
import PublicInvoice from './PublicInvoice'
import JoinPlan from './JoinPlan'
import SystemEstimate from './SystemEstimate'
import NewSystemEstimate from './NewSystemEstimate'
import SystemEstimates from './SystemEstimates'
import OperationsDashboard from './OperationsDashboard'
import SessionLog from './SessionLog'
import CustomerImport from './CustomerImport'
import PricebookImport from './PricebookImport'
import EquipmentImport from './EquipmentImport'
import PropertyImport from './PropertyImport'
import JobImport from './JobImport'
import TechJobs from './TechJobs'
import TheTower from './TheTower'
import TechJobCard from './TechJobCard'
import TechTaskCard from './TechTaskCard'
import TechInvoice from './TechInvoice'
import TechEstimate from './TechEstimate'
import TechNewEstimate from './TechNewEstimate'
import TechSystemEstimate from './TechSystemEstimate'
import TechSchedule from './TechSchedule'
import TechNewJob from './TechNewJob'
import TechApollo from './TechApollo'
import TechInvoiceView from './TechInvoiceView'
import TechMessages from './TechMessages'
import TextArchive from './TextArchive'
import TechGate from './TechGate'
import TechSettings from './TechSettings'
// Elements · Inventory retired in favor of the native Parts Catalog module.
// Fleet remains. (ELEMENTS_ROUTES intentionally no longer rendered.)
import { ELEMENTS_FLEET_ROUTES } from './modules/elements-hvac'
import { REWARDS_HR_ROUTES, REWARDS_PAYROLL_ROUTES, REWARDS_CERT_ROUTES, MyPortal } from './modules/rewards-hvac'
import { MARKETING_ROUTES } from './modules/marketing-hvac'
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
    supabase
      .from('users')
      .select('id, full_name, role, org_id, is_field_supervisor')
      .eq('id', session.user.id)
      .single()
      .then(async (userRes) => {
        if (!userRes.data) {
          setProfile(null)
          supabase.auth.signOut()
          return
        }
        const [permsRes, elemRes, rewardsRes, mktRes, effPerms] = await Promise.all([
          supabase.from('user_permissions').select('permission_key').eq('user_id', session.user.id),
          userRes.data.org_id
            ? supabase.from('elements_settings').select('entitled').eq('org_id', userRes.data.org_id).maybeSingle()
            : Promise.resolve({ data: null }),
          userRes.data.org_id
            ? supabase.from('rewards_settings').select('entitled').eq('org_id', userRes.data.org_id).maybeSingle()
            : Promise.resolve({ data: null }),
          userRes.data.org_id
            ? supabase.from('marketing_settings').select('entitled').eq('org_id', userRes.data.org_id).maybeSingle()
            : Promise.resolve({ data: null }),
          loadPermissions(session.user.id, userRes.data.org_id),
        ])
        // Prime the active org timezone so all times render/parse in the
        // organization's zone, not the viewer's device zone. Super-admins have
        // no org of their own; their per-page org pickers set it instead.
        if (userRes.data.org_id) loadOrgTz(userRes.data.org_id)
        setProfile({
          ...userRes.data,
          permissions: (permsRes.data || []).map((p) => p.permission_key),
          permKeys: effPerms.keys,   // resolved effective permissions (tags + live on-call elevation)
          onCall: effPerms.onCall,   // { until, as } while on-call now, else null
          elementsEntitled: !!elemRes?.data?.entitled,   // Elements-HVAC subscription gate
          rewardsEntitled: !!rewardsRes?.data?.entitled,  // Rewards-HVAC subscription gate
          marketingEntitled: !!mktRes?.data?.entitled,   // Marketing-HVAC subscription gate
        })
      })
  }, [session])

  if (session === undefined) return null
  if (!session) return <Login />
  if (needsPassword) return <SetPassword onDone={() => setNeedsPassword(false)} />
  if (!profile) return null

  return (
    <Routes>
      {/* All mobile field views sit behind the terms consent gate. */}
      <Route element={<TechGate profile={profile} />}>
        <Route path="/tech" element={<TechJobs profile={profile} />} />
        <Route path="/tech/tower" element={<TheTower profile={profile} />} />
        <Route path="/tech/settings" element={<TechSettings profile={profile} />} />
        <Route path="/tech/task/:taskId" element={<TechTaskCard profile={profile} />} />
        <Route path="/tech/:jobId" element={<TechJobCard profile={profile} />} />
        <Route path="/tech/invoice/:jobId" element={<TechInvoice profile={profile} />} />
        <Route path="/tech/estimate/:jobId" element={<TechEstimate profile={profile} />} />
        <Route path="/tech/new-followup-estimate" element={<TechNewEstimate profile={profile} />} />
        <Route path="/tech/system-estimate/:jobId" element={<TechSystemEstimate profile={profile} />} />
        <Route path="/tech/system-estimate-p/:estimateId" element={<TechSystemEstimate profile={profile} />} />
        <Route path="/tech/schedule" element={<TechSchedule profile={profile} />} />
        <Route path="/tech/my-schedule" element={<MySchedule profile={profile} />} />
        <Route path="/tech/new-job" element={<TechNewJob profile={profile} mode="job" />} />
        <Route path="/tech/new-service-estimate" element={<TechNewJob profile={profile} mode="service-estimate" />} />
        <Route path="/tech/new-system-estimate" element={<TechNewJob profile={profile} mode="system-estimate" />} />
        <Route path="/tech/apollo" element={<TechApollo profile={profile} />} />
        <Route path="/tech/invoice-view/:invoiceId" element={<TechInvoiceView profile={profile} />} />
        <Route path="/tech/messages/:jobId" element={<TechMessages profile={profile} />} />
        <Route path="/tech/pm-checklist/:instanceId" element={<TechPMChecklist profile={profile} />} />
      </Route>
      {/* Rewards-HVAC · employee self-service portal — any logged-in employee, own data only (RLS) */}
      <Route path="/my" element={<MyPortal profile={profile} />} />
      <Route element={<Layout profile={profile} />}>
        {/* <Route path="/rewards-hvac" element={<PayrollDashboard />} /> */}  {/* TODO: re-enable with the import above when Payroll module is finished */}
        <Route path="/" element={profile.role === 'tech' ? <Navigate to="/tech" replace /> : <Dashboard profile={profile} />} />
        <Route path="/customers" element={<Customers profile={profile} />} />
        <Route path="/customers/:customerId" element={<CustomerHistory profile={profile} />} />
        <Route path="/text-archive" element={<TextArchive profile={profile} />} />
        <Route path="/jobs-management" element={<JobsManagement profile={profile} />} />
        <Route path="/tasks" element={<Tasks profile={profile} />} />
        <Route path="/payroll" element={<PayrollCapture profile={profile} />} />
        <Route path="/time-clock" element={<TimeClock profile={profile} />} />
        <Route path="/payroll/employee/:userId" element={<EmployeePayroll profile={profile} />} />
        <Route path="/vendors" element={<Vendors profile={profile} />} />
        <Route path="/vendors/:vendorId" element={<VendorDetail profile={profile} />} />
        <Route path="/properties" element={<Properties profile={profile} />} />
        <Route path="/jobs" element={<Jobs profile={profile} />} />
        <Route path="/parts-catalog" element={<PartsCatalog profile={profile} />} />
        <Route path="/settings" element={<Settings profile={profile} />} />
        <Route path="/team" element={<Team profile={profile} />} />
        <Route path="/on-call" element={<OnCallSchedule profile={profile} />} />
        <Route path="/roles" element={<RolesConfig profile={profile} />} />
        <Route path="/session-log" element={<SessionLog profile={profile} />} />
        <Route path="/import/customers" element={<CustomerImport profile={profile} />} />
        <Route path="/import/properties" element={<PropertyImport profile={profile} />} />
        <Route path="/import/jobs" element={<JobImport profile={profile} />} />
        <Route path="/import/services-pricebook" element={<PricebookImport profile={profile} />} />
        <Route path="/import/parts-catalog" element={<PartsCatalogImport profile={profile} />} />
        <Route path="/import/vendor-prices" element={<VendorPriceImport profile={profile} />} />
        <Route path="/import/systems-pricebook" element={<EquipmentImport profile={profile} />} />
        <Route path="/calendar" element={<Calendar profile={profile} />} />
        <Route path="/pricebook" element={<Pricebook profile={profile} />} />
        <Route path="/systems-pricebook" element={<SystemsPricebook profile={profile} />} />
        <Route path="/special-features" element={<SpecialFeatures profile={profile} />} />
        <Route path="/system-estimate-setup" element={<SystemEstimateSetup profile={profile} />} />
        <Route path="/pm-checklists" element={<PMChecklists profile={profile} />} />
        <Route path="/discount-catalog" element={<DiscountCatalog profile={profile} />} />
        <Route path="/maintenance-tiers" element={<MaintenanceAgreementTiers profile={profile} />} />
        <Route path="/checklists" element={<ChecklistTemplates profile={profile} />} />
        <Route path="/maintenance-agreements" element={<MaintenanceAgreements profile={profile} />} />
        <Route path="/maintenance-due" element={<MaintenanceDue profile={profile} />} />
        <Route path="/maintenance-dashboard" element={<MaintenanceDashboard profile={profile} />} />
        <Route path="/invoice/:jobId" element={<Invoice profile={profile} />} />
        <Route path="/estimate/:jobId" element={<Estimate profile={profile} />} />
        <Route path="/system-estimate/:jobId" element={<SystemEstimate profile={profile} />} />
        <Route path="/system-estimate-p/:estimateId" element={<SystemEstimate profile={profile} />} />
        <Route path="/new-system-estimate" element={<NewSystemEstimate profile={profile} />} />
        <Route path="/estimates" element={<Estimates profile={profile} />} />
        <Route path="/system-estimates" element={<SystemEstimates profile={profile} />} />
        <Route path="/operations" element={<OperationsDashboard profile={profile} />} />
        <Route path="/new-followup-estimate" element={<NewFollowupEstimate profile={profile} />} />
        <Route path="/invoices" element={<Invoices profile={profile} />} />
        {/* Elements-HVAC · Inventory + Fleet — gated on subscription (super admin) or entitlement */}
        {(profile.role === 'super_admin' || profile.elementsEntitled) && [...ELEMENTS_FLEET_ROUTES].map((r) => (
          <Route key={r.path} path={r.path} element={<r.Component profile={profile} />} />
        ))}
        {/* Rewards-HVAC · People (HR) + Payroll — gated on subscription (super admin) or entitlement */}
        {(profile.role === 'super_admin' || profile.rewardsEntitled) && [...REWARDS_HR_ROUTES, ...REWARDS_PAYROLL_ROUTES, ...REWARDS_CERT_ROUTES].map((r) => (
          <Route key={r.path} path={r.path} element={<r.Component profile={profile} />} />
        ))}
        {/* Marketing-HVAC · AI marketing — gated on subscription (super admin) or entitlement */}
        {(profile.role === 'super_admin' || profile.marketingEntitled) && MARKETING_ROUTES.map((r) => (
          <Route key={r.path} path={r.path} element={<r.Component profile={profile} />} />
        ))}
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

