import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { can } from './utils/permissions'
import AnnouncementBanner from './AnnouncementBanner'
import ClockWidget from './ClockWidget'
import ClockInPrompt from './ClockInPrompt'
import HelpDrawer from './HelpDrawer'
import { ELEMENTS_NAV, ELEMENTS_FLEET_NAV, TOOLS_NAV } from './modules/elements-hvac'
import { REFRIGERANT_NAV } from './modules/refrigerant-hvac'
import { SUPPLIES_NAV } from './modules/supplies-hvac'
import { REWARDS_HR_NAV, REWARDS_PAYROLL_NAV, REWARDS_CERT_NAV } from './modules/rewards-hvac'
import { MARKETING_NAV } from './modules/marketing-hvac'

const CATEGORIES = [
  { key: 'operations', label: 'Operations', items: [
    { label: 'Operations Dashboard', path: '/operations' },
    { label: 'Call Console', path: '/call' },
    { label: 'Service Requests', path: '/service-requests' },
    { label: 'Calendar', path: '/calendar' },
    { label: 'Dispatch Map', path: '/dispatch-map' },
    { label: 'Jobs', path: '/jobs' },
    { label: 'Jobs Management', path: '/jobs-management' },
    { label: 'Tasks', path: '/tasks' },
    { label: 'Customers', path: '/customers' },
    { label: 'Properties', path: '/properties' },
    { label: 'Job Estimates', path: '/estimates' },
    { label: 'System Estimates', path: '/system-estimates' },
    { label: 'Warranty Registrations', path: '/warranty-registrations' },
    { label: 'Vendors', path: '/vendors' },
    { label: 'Text Archive', path: '/text-archive' },
    { label: 'Filter Orders', path: '/filter-orders' },
  ]},
  { key: 'maintenance', label: 'Maintenance', items: [
    { label: 'Maintenance Dashboard', path: '/maintenance-dashboard', perm: 'view_maintenance_dashboard' },
    { label: 'Maintenance Agreements', path: '/maintenance-agreements' },
    { label: 'Maintenance Due', path: '/maintenance-due' },
    { label: 'Maintenance Tiers', path: '/maintenance-tiers' },
  ]},
  { key: 'financials', label: 'Financials', items: [
    { label: 'Invoices', path: '/invoices' },
    { label: 'Pricebook', path: '/pricebook' },
    { label: 'Systems Pricebook', path: '/systems-pricebook' },
    { label: 'Special Features', path: '/special-features' },
    { label: 'Discount Catalog', path: '/discount-catalog' },
    { label: 'PM Checklists', path: '/pm-checklists' },
    { label: 'System Estimate Setup', path: '/system-estimate-setup' },
  ]},
  { key: 'admin', label: 'Admin', items: [
    { label: 'Team', path: '/team' },
    { label: 'Roles & Tags', path: '/roles' },
    { label: 'On-Call Schedule', path: '/on-call' },
    { label: 'Checklists', path: '/checklists' },
    { label: 'Time Clock', path: '/time-clock' },
    { label: 'Payroll Capture', path: '/payroll' },
    { label: 'Sign-In Log', path: '/session-log' },
    { label: 'Settings', path: '/settings' },
  ]},
  // Bulk Import is now a tile dashboard (/import). Clicking the rail entry opens it;
  // the individual import tools live as cards there instead of a long nav dropdown.
  { key: 'import', label: 'Bulk Import', items: [] },
]

const PLATFORM_CATEGORY = { key: 'platform', label: 'Platform', items: [
  { label: 'Organizations', path: '/organizations' },
  { label: 'Announcements', path: '/announcements' },
]}

const PERSONAL_CATEGORY = { key: 'personal', label: 'Personal', items: [
  { label: 'My Pay & Benefits', path: '/my' },
]}

// Clicking a section title in the rail opens that section's dashboard (and
// still expands its panel). Sections whose key is absent here just expand.
const DASH_BY_KEY = {
  operations: '/operations',
  maintenance: '/maintenance-dashboard',
  financials: '/financials',
  admin: '/admin',
  elements: '/elements',
  fleet: '/fleet',
  refrigerant: '/refrigerant',
  supplies: '/supplies',
  tools: '/tools',
  rewards: '/rewards',
  'rewards-payroll': '/rewards/payroll',
  marketing: '/marketing',
  import: '/import',
}
// Optional sub-section headers with their own dashboard (kept generic for any
// future grouped nav; the current Inventory/Fleet/Tools units are top-level).
const HEADER_DASH = {
  'Inventory Management': '/elements',
  'Fleet Management': '/fleet',
}

function getCategoryForPath(pathname) {
  if (pathname === '/' || pathname === '/home') return null
  if (pathname.startsWith('/financials')) return 'financials'
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/maintenance')) return 'maintenance'
  if (pathname.startsWith('/calendar') || pathname.startsWith('/jobs') || pathname.startsWith('/tasks') || pathname.startsWith('/properties') || pathname.startsWith('/customers') || pathname.startsWith('/text-archive') || pathname.startsWith('/filter-orders') || pathname.startsWith('/dispatch-map') || pathname.startsWith('/call') || pathname.startsWith('/service-requests')) return 'operations'
  if (pathname.startsWith('/invoice') || pathname.startsWith('/pricebook') || pathname.startsWith('/systems-pricebook') || pathname.startsWith('/special-features') || pathname.startsWith('/system-estimate-setup') || pathname.startsWith('/pm-checklists') || pathname.startsWith('/discount-catalog')) return 'financials'
  if (pathname.startsWith('/estimate')) return 'operations'
  if (pathname.startsWith('/team') || pathname.startsWith('/roles') || pathname.startsWith('/checklists') || pathname.startsWith('/on-call') || pathname.startsWith('/settings') || pathname.startsWith('/session-log')) return 'admin'
  if (pathname.startsWith('/elements')) return 'elements'
  if (pathname.startsWith('/fleet')) return 'fleet'
  if (pathname.startsWith('/refrigerant')) return 'refrigerant'
  if (pathname.startsWith('/supplies')) return 'supplies'
  if (pathname.startsWith('/tools')) return 'tools'
  if (pathname.startsWith('/rewards/payroll')) return 'rewards-payroll'
  if (pathname.startsWith('/rewards/certified')) return 'rewards-cert'
  if (pathname.startsWith('/rewards')) return 'rewards'
  if (pathname.startsWith('/marketing')) return 'marketing'
  if (pathname.startsWith('/import')) return 'import'
  if (pathname.startsWith('/organizations') || pathname.startsWith('/announcements')) return 'platform'
  if (pathname.startsWith('/my')) return 'personal'
  return null
}

export default function Layout({ profile }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isSuperAdmin = profile?.role === 'super_admin'
  // Elements-HVAC appears only for the platform owner or an entitled subscriber.
  const showElements = profile?.role !== 'tech'
  // HR and Payroll are two separately-sold modules. HR is the fuller module and
  // implies payroll access; Payroll can stand alone for smaller orgs.
  const notTech = profile?.role !== 'tech'
  const showHR = notTech && (isSuperAdmin || profile?.hrEntitled)
  const showPayroll = notTech && (isSuperAdmin || profile?.payrollEntitled || profile?.hrEntitled)
  // Inventory + Fleet are core (any non-tech office role). Tools is an optional
  // module, gated by entitlement like Marketing. Each is its own nav unit now.
  const showTools = notTech && (isSuperAdmin || profile?.toolsEntitled)
  // Refrigerant/EPA compliance is core (Section 608 applies to all work), so it
  // rides alongside Inventory + Fleet for any non-tech office role — no gate.
  const withInvFleet = showElements ? [...CATEGORIES, ELEMENTS_NAV, ELEMENTS_FLEET_NAV, REFRIGERANT_NAV, SUPPLIES_NAV] : CATEGORIES
  const withElements = showTools ? [...withInvFleet, TOOLS_NAV] : withInvFleet
  const withHR = showHR ? [...withElements, REWARDS_HR_NAV] : withElements
  // Payroll staff work the employee pay/tax profile too, so surface Employees at
  // the top of the Payroll section whenever Payroll is shown (essential for
  // Payroll-only orgs, convenient for everyone else).
  const payrollNav = showPayroll
    ? { ...REWARDS_PAYROLL_NAV, items: [{ label: 'Employees', path: '/rewards/employees' }, ...REWARDS_PAYROLL_NAV.items] }
    : REWARDS_PAYROLL_NAV
  const baseCategories = showPayroll ? [...withHR, payrollNav, REWARDS_CERT_NAV] : withHR
  // Marketing-HVAC — platform owner or an entitled subscriber.
  const showMarketing = profile?.role !== 'tech' && (isSuperAdmin || profile?.marketingEntitled)
  const withMarketing = showMarketing ? [...baseCategories, MARKETING_NAV] : baseCategories
  const withPersonal = (showHR || showPayroll) ? [...withMarketing, PERSONAL_CATEGORY] : withMarketing
  const allCategories = isSuperAdmin ? [...withPersonal, PLATFORM_CATEGORY] : withPersonal

  // Employees maps to the HR category by default; for a payroll-only org (no HR
  // section) keep the Payroll panel open when they're on that shared screen.
  const resolveCat = (path) => {
    const c = getCategoryForPath(path)
    if (c === 'rewards' && !showHR && showPayroll) return 'rewards-payroll'
    return c
  }
  const [expandedCategory, setExpandedCategory] = useState(resolveCat(location.pathname))
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [logoutShiftId, setLogoutShiftId] = useState(null)  // open shift id when logging out
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const cat = resolveCat(location.pathname)
    if (cat) setExpandedCategory(cat)
  }, [location.pathname])

  async function handleLogout() {
    // If they're clocked in (open shift), show a colorful prompt offering to
    // clock out too — catches the common forgotten-clock-out at end of day.
    try {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData?.user?.id
      if (uid) {
        const { data: openShifts } = await supabase
          .from('time_clock_events')
          .select('id')
          .eq('user_id', uid)
          .is('clock_out', null)
          .limit(1)
        if (openShifts && openShifts.length > 0) {
          setLogoutShiftId(openShifts[0].id)  // open the styled modal; it finishes logout
          return
        }
      }
    } catch (e) { /* don't block sign-out on a clock hiccup */ }
    finishLogout(false, null)
  }

  async function finishLogout(alsoClockOut, shiftId) {
    setLoggingOut(true)
    try {
      if (alsoClockOut && shiftId) {
        // End any open break first, then close the shift.
        const { data: openBreaks } = await supabase
          .from('clock_breaks')
          .select('id')
          .eq('clock_event_id', shiftId)
          .is('break_end', null)
          .limit(1)
        if (openBreaks && openBreaks.length > 0) {
          await supabase.from('clock_breaks').update({ break_end: new Date().toISOString() }).eq('id', openBreaks[0].id)
        }
        await supabase.from('time_clock_events').update({ clock_out: new Date().toISOString() }).eq('id', shiftId)
      }
    } catch (e) { /* ignore clock hiccup */ }

    const { data } = await supabase.auth.getUser()
    if (data?.user) {
      await supabase.from('session_log').insert({
        org_id: profile?.org_id || null,
        user_id: data.user.id,
        event: 'sign_out',
        source: 'desktop',
      })
    }
    await supabase.auth.signOut()
    try {
      Object.keys(sessionStorage).forEach((k) => { if (k.startsWith('clockPromptSeen:')) sessionStorage.removeItem(k) })
    } catch (e) { /* ignore */ }
  }

  const activeCategoryData = allCategories.find((c) => c.key === expandedCategory)

  return (
    <div className="app-shell-v2">
      <ClockInPrompt profile={profile} />
      {logoutShiftId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', zIndex: 4500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 0, maxWidth: 440, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ background: '#B00020', color: '#fff', padding: '18px 24px', fontSize: 20, fontWeight: 800, textAlign: 'center' }}>
              ⏱ You're still clocked in
            </div>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ color: '#334155', marginTop: 0, marginBottom: 24, fontSize: 15 }}>
                You're about to sign out but you haven't clocked out. Do you want to clock out now too?
              </p>
              <button
                onClick={async () => { await finishLogout(true, logoutShiftId); setLogoutShiftId(null) }}
                disabled={loggingOut}
                style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: '#B00020', color: '#fff', fontWeight: 800, fontSize: 17, cursor: 'pointer', marginBottom: 10 }}
              >
                {loggingOut ? 'Clocking out…' : 'Yes — Clock Out & Sign Out'}
              </button>
              <button
                onClick={async () => { await finishLogout(false, logoutShiftId); setLogoutShiftId(null) }}
                disabled={loggingOut}
                style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #CBD5E1', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                No — Stay Clocked In, Just Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
      <AnnouncementBanner profile={profile} />
      <div className="shell-body">
        <div className="sidebar-rail">
          <div className="rail-brand">Journey<br />HVAC</div>
          <Link to="/home" className={'rail-item' + (location.pathname === '/home' ? ' active' : '')}>
            Home
          </Link>
          {allCategories.map((cat) => (
            <button
              key={cat.key}
              className={'rail-item' + (expandedCategory === cat.key ? ' active' : '')}
              onClick={() => {
                setExpandedCategory(cat.key)
                if (DASH_BY_KEY[cat.key]) navigate(DASH_BY_KEY[cat.key])
              }}
            >
              {cat.label}
            </button>
          ))}
          <div className="rail-spacer" />
          {!isSuperAdmin && profile?.id && profile?.org_id && (
            <div style={{ marginBottom: 12 }}>
              <ClockWidget userId={profile.id} orgId={profile.org_id} variant="desktop" />
            </div>
          )}
          {isSuperAdmin && <span className="badge" style={{ marginBottom: 12 }}>Super Admin</span>}
          <button className="rail-item" onClick={() => window.location.reload(true)}>Refresh</button>
          <button className="rail-item" onClick={handleLogout}>Sign out</button>
        </div>

        {activeCategoryData && activeCategoryData.items.length > 0 && (
          panelCollapsed ? (
            <button className="sidebar-panel-reopen" onClick={() => setPanelCollapsed(false)} title="Show menu" aria-label="Show menu">›</button>
          ) : (
          <div className="sidebar-panel">
            <div className="sidebar-panel-head">
              <h3 style={{ margin: 0 }}>{activeCategoryData.label}</h3>
              <button className="sidebar-panel-toggle" onClick={() => setPanelCollapsed(true)} title="Hide menu" aria-label="Hide menu">‹</button>
            </div>
            {activeCategoryData.items.filter((item) => !item.perm || isSuperAdmin || can(profile, item.perm)).map((item) => (
              item.header ? (
                HEADER_DASH[item.header] ? (
                  <Link
                    key={item.header}
                    to={HEADER_DASH[item.header]}
                    style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A6', fontWeight: 700, margin: '16px 0 4px', textDecoration: 'none', cursor: 'pointer' }}
                  >
                    {item.header}
                  </Link>
                ) : (
                  <div key={item.header} style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8A93A6', fontWeight: 700, margin: '16px 0 4px' }}>
                    {item.header}
                  </div>
                )
              ) : (
                <Link
                  key={item.path}
                  to={item.path}
                  className={'sidebar-panel-link' + (location.pathname.startsWith(item.path) ? ' active' : '')}
                >
                  {item.label}
                </Link>
              )
            ))}
          </div>
          )
        )}

        <div className="main-content-area">
          <Outlet />
        </div>
        <HelpDrawer />
      </div>
    </div>
  )
}
