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

// Human page titles for the top-bar "Viewing Organization" pill. Longest-prefix
// match, with a title-cased fallback so newly-added pages still read cleanly.
const PAGE_TITLES = {
  '/': 'Home', '/home': 'Home',
  '/train-station': 'Train Station', '/dispatch': 'Dispatch Station',
  '/call': 'Call Console', '/call-log': 'Call Log', '/known-contacts': 'Known Others', '/service-requests': 'Service Requests',
  '/calendar': 'Calendar', '/dispatch-map': 'Map View', '/filter-orders': 'Filter Orders',
  '/text-archive': 'Text Archive', '/on-call': 'On-Call Schedule',
  '/jobs-dash': 'Jobs Dashboard', '/jobs-management': 'Jobs Management', '/jobs': 'Jobs',
  '/tasks': 'Tasks', '/to-do': 'To-Do', '/customers': 'Customers', '/properties': 'Properties',
  '/system-estimates': 'System Estimates', '/estimates': 'Job Estimates', '/invoices': 'Invoices',
  '/maintenance-station': 'Maintenance Station', '/maintenance-dashboard': 'Maintenance Dashboard',
  '/maintenance-agreements': 'Maintenance Agreements', '/maintenance-due': 'Maintenance Due',
  '/maintenance-tiers': 'Maintenance Tiers', '/filter-subscriptions': 'Filter Subscriptions',
  '/inventory-central': 'Inventory Central', '/workforce': 'WorkForce', '/elements': 'Inventory',
  '/fleet': 'Fleet', '/refrigerant': '608 Compliance', '/supplies': 'Supplies', '/tools': 'Tools',
  '/rewards': 'Human Resources', '/marketing': 'Marketing', '/permits': 'Permits',
  '/building-authorities': 'Building Authorities', '/warranty-registrations': 'Warranty Registrations',
  '/import': 'Data Station', '/pricebook': 'Pricebook', '/systems-pricebook': 'Systems Pricebook',
  '/settings': 'Settings', '/team': 'Team', '/roles': 'Roles & Tags', '/time-clock': 'Time Clock',
  '/payroll': 'Payroll Capture', '/session-log': 'Sign-In Log',
  '/organizations': 'Organizations', '/announcements': 'Announcements', '/my': 'My Pay & Benefits',
}
function pageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const hit = Object.keys(PAGE_TITLES)
    .filter((k) => k !== '/' && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0]
  if (hit) return PAGE_TITLES[hit]
  const seg = pathname.split('/').filter(Boolean)[0] || 'Home'
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Rail visuals for the redesign: per-category icon, display-label overrides, and
// top ordering to match the mockup. Underlying category keys/links are unchanged
// (the full 5-group regroup is deferred to the nav mockup).
const RAIL_LABELS = { start: 'Train Station', dispatch: 'Dispatch Station', workforce: 'WorkForce' }
const RAIL_ORDER = {
  dispatch: 1, start: 2, 'inventory-central': 3, workforce: 4, work: 5, maintenance: 6,
  permitting: 40, import: 41, marketing: 42, financials: 90, admin: 91, personal: 92, platform: 93,
}
function railRank(key) { return RAIL_ORDER[key] ?? 50 }
const RAIL_ICON_PATHS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  dispatch: 'M4 5h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 7a2 2 0 011-2z',
  start: 'M7 4h10v9a3 3 0 01-3 3h-4a3 3 0 01-3-3zM8 20l2-3M16 20l-2-3M9 8h6',
  'inventory-central': 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
  workforce: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M17 11a3 3 0 003-3 3 3 0 00-3-3M16 20a6 6 0 018-4',
  work: 'M4 7h16v13H4zM9 7V5a2 2 0 012-2h2a2 2 0 012 2v2',
  maintenance: 'M14 6a4 4 0 01-5.2 5.2L5 15l4 4 3.8-3.8A4 4 0 0018 10l-2 2-2-2 2-2z',
  permitting: 'M7 3h7l4 4v14H7zM14 3v4h4M9 12h6M9 16h6',
  import: 'M12 3v10m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2',
  marketing: 'M4 10v4h3l5 4V6l-5 4H4zM17 8a5 5 0 010 8',
  financials: 'M12 3v18M8 8h6a2 2 0 010 4H9a2 2 0 000 4h7',
  admin: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z',
  personal: 'M12 12a4 4 0 100-8 4 4 0 000 8zM5 21a7 7 0 0114 0',
  platform: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  settings: 'M12 8a4 4 0 100 8 4 4 0 000-8zM19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L14.5 2h-5l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4L3 11a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1l.4 2.6h5l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4-2-1.5a7 7 0 00.1-1z',
  refresh: 'M4 12a8 8 0 0114-5m2-3v5h-5M20 12a8 8 0 01-14 5m-2 3v-5h5',
  signout: 'M15 12H4m0 0l4-4m-4 4l4 4M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4',
}
function RailIcon({ k }) {
  const d = RAIL_ICON_PATHS[k] || 'M5 12h14'
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  )
}

const CATEGORIES = [
  { key: 'start', label: 'Start', items: [
    { label: 'Train Station', path: '/train-station' },
  ] },
  { key: 'dispatch', label: 'Dispatch', items: [
    { label: 'Dispatch Station', path: '/dispatch' },
    { label: 'Call Console', path: '/call' },
    { label: 'Call Log', path: '/call-log' },
    { label: 'Known Others', path: '/known-contacts' },
    { label: 'Service Requests', path: '/service-requests' },
    { label: 'Calendar', path: '/calendar' },
    { label: 'Dispatch Map', path: '/dispatch-map' },
    { label: 'Filter Orders', path: '/filter-orders' },
    { label: 'Text Archive', path: '/text-archive', perm: 'view_text_archive' },
    { label: 'On-Call Schedule', path: '/on-call' },
  ] },
  { key: 'work', label: 'Jobs & Customers', items: [
    { label: 'Jobs Dash', path: '/jobs-dash' },
    { label: 'Jobs', path: '/jobs' },
    { label: 'Jobs Management', path: '/jobs-management' },
    { label: 'Tasks', path: '/tasks' },
    { label: 'Customers', path: '/customers' },
    { label: 'Properties', path: '/properties' },
    { label: 'Job Estimates', path: '/estimates' },
    { label: 'System Estimates', path: '/system-estimates' },
    { label: 'Invoices', path: '/invoices' },
    { label: 'Payments to Confirm', path: '/payments-to-confirm' },
  ]},
  { key: 'maintenance', label: 'Maintenance', items: [
    { label: 'Maintenance Station', path: '/maintenance-station', perm: 'view_maintenance_dashboard' },
    { label: 'Maintenance Dashboard', path: '/maintenance-dashboard', perm: 'view_maintenance_dashboard' },
    { label: 'Maintenance Agreements', path: '/maintenance-agreements' },
    { label: 'Maintenance Due', path: '/maintenance-due' },
    { label: 'Maintenance Tiers', path: '/maintenance-tiers' },
    { label: 'Filter Subscriptions', path: '/filter-subscriptions' },
  ]},
  { key: 'financials', label: 'Financials', items: [] },
  { key: 'admin', label: 'Admin', items: [
    { label: 'Settings', path: '/settings' },
    { label: 'Financing Options', path: '/financing-options' },
  ]},
  { key: 'permitting', label: 'Permitting', items: [
    { label: 'Permits', path: '/permits' },
    { label: 'Building Authorities', path: '/building-authorities' },
    { label: 'Warranty Registrations', path: '/warranty-registrations' },
  ]},
  // The Data Station is a tile dashboard (/import). Clicking the rail entry opens it;
  // the individual import tools live as cards there instead of a long nav dropdown.
  { key: 'import', label: 'Data Station', items: [
    { label: 'Import Hub', path: '/import' },
    { label: 'Pricebook', path: '/pricebook' },
    { label: 'Systems Pricebook', path: '/systems-pricebook' },
    { label: 'Special Features', path: '/special-features' },
    { label: 'Discount Catalog', path: '/discount-catalog' },
    { label: 'PM Checklists', path: '/pm-checklists' },
    { label: 'System Estimate Setup', path: '/system-estimate-setup' },
    { label: 'Checklists', path: '/checklists' },
  ]},
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
  start: '/train-station',
  'inventory-central': '/inventory-central',
  workforce: '/workforce',
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

// Hubs group sub-stations that come OFF the main rail and live under the hub:
// the hub's submenu lists its stations; a station's submenu leads with a
// Back-to-hub link. Two hubs today: the Train Station and Inventory Central.
const HUBS = {
  start: {
    label: 'Train Station', path: '/train-station',
    stations: [
      { key: 'work', label: 'Jobs & Customers', path: '/jobs-dash' },
      { key: 'dispatch', label: 'Dispatch Station', path: '/dispatch' },
      { key: 'maintenance', label: 'Maintenance Station', path: '/maintenance-station' },
      { key: 'permitting', label: 'Permitting Station', path: '/permits' },
      { key: 'refrigerant', label: '608 Refrigeration Compliance', path: '/refrigerant' },
      { key: 'import', label: 'Data Station', path: '/import' },
    ],
  },
  'inventory-central': {
    label: 'Inventory Central', path: '/inventory-central',
    stations: [
      { key: 'stock-purchasing', label: 'Stock & Purchasing', path: '/elements' },
      { key: 'insights-planning', label: 'Insights & Planning', path: '/elements/valuation' },
      { key: 'fleet', label: 'Fleet Dashboard', path: '/fleet' },
      { key: 'supplies', label: 'Non-Inventory Supplies', path: '/supplies' },
      { key: 'tools', label: 'Tools Dashboard', path: '/tools' },
    ],
  },
  workforce: {
    label: 'Workforce', path: '/workforce',
    // leaf pages (no key) are direct links that keep the hub submenu open;
    // modules (keyed) open their own submenu and are entitlement-gated via `needs`.
    stations: [
      { label: 'Team', path: '/team' },
      { label: 'Roles & Tags', path: '/roles' },
      { label: 'Time Clock', path: '/time-clock' },
      { label: 'Payroll Capture', path: '/payroll' },
      { label: 'Sign-In Log', path: '/session-log' },
      { key: 'rewards', label: 'Human Resources', path: '/rewards', needs: 'hr' },
      { key: 'rewards-payroll', label: 'Payroll', path: '/rewards/payroll', needs: 'payroll' },
      { key: 'rewards-cert', label: 'Certified Payroll', path: '/rewards/certified', needs: 'payroll' },
    ],
  },
}
const HUB_KEYS = new Set(Object.keys(HUBS))
const NESTED_KEYS = new Set(Object.values(HUBS).flatMap((h) => h.stations.filter((st) => st.key).map((st) => st.key)))
const STATION_TO_HUB = {}
const STATION_LABEL = {}
for (const [hk, h] of Object.entries(HUBS)) for (const st of h.stations) if (st.key) { STATION_TO_HUB[st.key] = hk; STATION_LABEL[st.key] = st.label }

// Inventory Central + its two split inventory sub-stations (Fleet/Supplies/Tools
// are their existing module navs, just nested under this hub now).
const INVENTORY_CENTRAL_NAV = { key: 'inventory-central', label: 'Inventory Central', items: [] }
const WORKFORCE_NAV = { key: 'workforce', label: 'Workforce', items: [] }
const STOCK_PURCHASING_NAV = { key: 'stock-purchasing', label: 'Stock & Purchasing', items: [
  { label: 'Inventory Overview', path: '/elements' },
  { label: 'Locations', path: '/elements/locations' },
  { label: 'Item Catalog', path: '/elements/items' },
  { label: 'Stock & Receiving', path: '/elements/stock' },
  { label: 'Cycle Counts', path: '/elements/cycle-counts' },
  { label: 'Replenishment', path: '/elements/replenishment' },
  { label: 'Purchase Orders', path: '/elements/purchasing' },
  { label: 'Special Orders', path: '/elements/special-orders' },
  { label: 'Vendor Invoices (A/P)', path: '/elements/ap' },
  { label: 'Vendors', path: '/vendors' },
  { label: 'Vendor Cross-Reference', path: '/elements/vendor-crossref' },
  { label: 'Record Parts Used', path: '/elements/parts-used' },
  { label: 'Inventory Health', path: '/elements/health' },
  { label: 'Inventory Settings', path: '/elements/settings' },
] }
const INSIGHTS_PLANNING_NAV = { key: 'insights-planning', label: 'Insights & Planning', items: [
  { label: 'Service → Part Mapping', path: '/elements/service-map' },
  { label: 'Parts Usage', path: '/elements/usage' },
  { label: 'Job Costing', path: '/elements/job-costing' },
  { label: 'Inventory Variance', path: '/elements/variance' },
  { label: 'Inventory Valuation', path: '/elements/valuation' },
  { label: 'Demand Forecast', path: '/elements/forecast' },
] }
const INSIGHTS_PATHS = ['/elements/service-map', '/elements/usage', '/elements/job-costing', '/elements/variance', '/elements/valuation', '/elements/forecast']

function getCategoryForPath(pathname) {
  if (pathname.startsWith('/train-station')) return 'start'
  if (pathname.startsWith('/maintenance-station')) return 'maintenance'
  if (pathname === '/' || pathname === '/home') return null
  if (pathname.startsWith('/financials')) return 'financials'
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/permits') || pathname.startsWith('/building-authorities') || pathname.startsWith('/warranty')) return 'permitting'
  if (pathname.startsWith('/maintenance') || pathname.startsWith('/filter-subscriptions')) return 'maintenance'
  if (pathname.startsWith('/dispatch') || pathname.startsWith('/call') || pathname.startsWith('/known-contacts') || pathname.startsWith('/service-requests') || pathname.startsWith('/calendar') || pathname.startsWith('/filter-orders') || pathname.startsWith('/text-archive') || pathname.startsWith('/on-call')) return 'dispatch'
  if (pathname.startsWith('/jobs') || pathname.startsWith('/tasks') || pathname.startsWith('/customers') || pathname.startsWith('/properties') || pathname.startsWith('/estimate') || pathname.startsWith('/system-estimates') || pathname.startsWith('/invoice')) return 'work'
  if (pathname.startsWith('/pricebook') || pathname.startsWith('/systems-pricebook') || pathname.startsWith('/special-features') || pathname.startsWith('/system-estimate-setup') || pathname.startsWith('/pm-checklists') || pathname.startsWith('/discount-catalog') || pathname.startsWith('/checklists')) return 'import'
  if (pathname.startsWith('/workforce') || pathname.startsWith('/team') || pathname.startsWith('/roles') || pathname.startsWith('/time-clock') || pathname.startsWith('/payroll') || pathname.startsWith('/session-log')) return 'workforce'
  if (pathname.startsWith('/settings')) return 'admin'
  if (pathname.startsWith('/inventory-central')) return 'inventory-central'
  if (INSIGHTS_PATHS.some((x) => pathname.startsWith(x))) return 'insights-planning'
  if (pathname.startsWith('/elements') || pathname.startsWith('/vendors')) return 'stock-purchasing'
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
  // Org name for the top-bar "Viewing Organization" pill (multi-tenant: whatever
  // org this user belongs to; the platform owner sees a neutral label).
  const [orgName, setOrgName] = useState('')
  useEffect(() => {
    if (isSuperAdmin) { setOrgName('All Organizations'); return }
    if (!profile?.org_id) { setOrgName(''); return }
    supabase.from('organizations').select('name').eq('id', profile.org_id).single()
      .then(({ data }) => setOrgName(data?.name || ''))
  }, [profile?.org_id, isSuperAdmin])
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
  const withInvFleet = showElements ? [...CATEGORIES, INVENTORY_CENTRAL_NAV, STOCK_PURCHASING_NAV, INSIGHTS_PLANNING_NAV, ELEMENTS_FLEET_NAV, REFRIGERANT_NAV, SUPPLIES_NAV] : CATEGORIES
  const withElements = showTools ? [...withInvFleet, TOOLS_NAV] : withInvFleet
  const withHR = showHR ? [...withElements, REWARDS_HR_NAV] : withElements
  // Payroll staff work the employee pay/tax profile too, so surface Employees at
  // the top of the Payroll section whenever Payroll is shown (essential for
  // Payroll-only orgs, convenient for everyone else).
  const payrollNav = showPayroll
    ? { ...REWARDS_PAYROLL_NAV, items: [{ label: 'Employees', path: '/rewards/employees' }, ...REWARDS_PAYROLL_NAV.items] }
    : REWARDS_PAYROLL_NAV
  const rewardsCats = showPayroll ? [...withHR, payrollNav, REWARDS_CERT_NAV] : withHR
  const baseCategories = notTech ? [...rewardsCats, WORKFORCE_NAV] : rewardsCats
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
      <header className="app-topbar">
        <div className="app-topbar-brand"><span className="tb-the">The</span> <span className="tb-journey">Journey</span> <span className="tb-tag">starts here.</span></div>
      </header>
      <div className="shell-body">
        <div className="sidebar-rail">
          <Link to="/home" className={'rail-item' + (location.pathname === '/home' ? ' active' : '')}>
            <RailIcon k="home" /><span className="rail-label">Home</span>
          </Link>
          {allCategories.filter((cat) => !NESTED_KEYS.has(cat.key)).slice().sort((a, b) => railRank(a.key) - railRank(b.key)).map((cat) => {
            const active = HUB_KEYS.has(cat.key) ? (expandedCategory === cat.key || STATION_TO_HUB[expandedCategory] === cat.key) : expandedCategory === cat.key
            const expandable = HUB_KEYS.has(cat.key) || (cat.items && cat.items.length > 0)
            return (
              <button
                key={cat.key}
                className={'rail-item' + (active ? ' active' : '')}
                onClick={() => {
                  setExpandedCategory(cat.key)
                  if (DASH_BY_KEY[cat.key]) navigate(DASH_BY_KEY[cat.key])
                }}
              >
                <RailIcon k={cat.key} />
                <span className="rail-label">{RAIL_LABELS[cat.key] || cat.label}</span>
                {expandable && <span className="rail-caret" aria-hidden="true">›</span>}
              </button>
            )
          })}
          <div className="rail-spacer" />
          {!isSuperAdmin && profile?.id && profile?.org_id && (
            <div style={{ marginBottom: 12, width: '100%' }}>
              <ClockWidget userId={profile.id} orgId={profile.org_id} variant="desktop" />
            </div>
          )}
          {isSuperAdmin && <div style={{ marginBottom: 12, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--amber, #B8720A)', textAlign: 'center', lineHeight: 1.2, width: '100%' }}>SUPER<br />ADMIN</div>}
          <button className="rail-item" onClick={() => window.location.reload(true)}><RailIcon k="refresh" /><span className="rail-label">Refresh</span></button>
          <button className="rail-item" onClick={handleLogout}><RailIcon k="signout" /><span className="rail-label">Sign out</span></button>
        </div>

        {(HUB_KEYS.has(expandedCategory) || NESTED_KEYS.has(expandedCategory) || (activeCategoryData && activeCategoryData.items.length > 0)) && (
          panelCollapsed ? (
            <button className="sidebar-panel-reopen" onClick={() => setPanelCollapsed(false)} title="Show menu" aria-label="Show menu">›</button>
          ) : (
          <div className="sidebar-panel">
            {NESTED_KEYS.has(expandedCategory) && (
              <button
                onClick={() => { const hk = STATION_TO_HUB[expandedCategory]; setExpandedCategory(hk); navigate(HUBS[hk].path) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--sky, #2F5DE3)', fontWeight: 700, fontSize: 13, padding: '2px 0 10px', textAlign: 'left' }}
              >
                {'←'} Back to {HUBS[STATION_TO_HUB[expandedCategory]].label}
              </button>
            )}
            <div className="sidebar-panel-head">
              <h3 style={{ margin: 0 }}>{HUB_KEYS.has(expandedCategory) ? HUBS[expandedCategory].label : (STATION_LABEL[expandedCategory] || activeCategoryData?.label)}</h3>
              <button className="sidebar-panel-toggle" onClick={() => setPanelCollapsed(true)} title="Hide menu" aria-label="Hide menu">‹</button>
            </div>
            {HUB_KEYS.has(expandedCategory) ? (
              HUBS[expandedCategory].stations.filter((st) => !st.needs || (st.needs === 'hr' ? showHR : showPayroll)).map((st) => (
                <Link
                  key={st.key || st.path}
                  to={st.path}
                  className={'sidebar-panel-link' + ((st.key ? resolveCat(location.pathname) === st.key : location.pathname.startsWith(st.path)) ? ' active' : '')}
                >
                  {st.label}
                </Link>
              ))
            ) : (
              (activeCategoryData?.items || []).filter((item) => !item.perm || isSuperAdmin || can(profile, item.perm)).map((item) => (
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
              ))
            )}
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
