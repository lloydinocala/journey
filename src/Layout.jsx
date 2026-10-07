import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './utils/supabase'
import { can } from './utils/permissions'
import { getDeviceId } from './utils/deviceId'
import AnnouncementBanner from './AnnouncementBanner'
import ClockWidget from './ClockWidget'
import ClockInPrompt from './ClockInPrompt'
import CallbackAlert from './CallbackAlert'
import HelpDrawer from './HelpDrawer'
import { ELEMENTS_FLEET_NAV, TOOLS_NAV } from './modules/elements-hvac'
import { REFRIGERANT_NAV } from './modules/refrigerant-hvac'
import { SUPPLIES_NAV } from './modules/supplies-hvac'
import { REWARDS_HR_NAV, REWARDS_PAYROLL_NAV, REWARDS_CERT_NAV } from './modules/rewards-hvac'

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
  '/system-estimates': 'System Estimates', '/estimates': 'Job Estimates', '/invoices': 'Invoices', '/projects': 'Projects',
  '/maintenance-station': 'Maintenance Station', '/maintenance-dashboard': 'Maintenance Dashboard',
  '/maintenance-agreements': 'Maintenance Agreements', '/maintenance-due': 'Maintenance Due',
  '/maintenance-tiers': 'Maintenance Tiers', '/filter-subscriptions': 'Filter Subscriptions',
  '/inventory-central': 'Inventory Central', '/workforce': 'WorkForce', '/elements': 'Inventory',
  '/fleet': 'Fleet', '/refrigerant': '608 Compliance', '/supplies': 'Supplies', '/tools': 'Tools',
  '/rewards': 'Human Resources', '/marketing': 'Marketing', '/permits': 'Permits',
  '/building-authorities': 'Building Authorities', '/warranty-registrations': 'Warranty Registrations',
  '/import': 'Data Station', '/pricebook': 'Residential Flat Rate', '/pricebook-commercial': 'Commercial Flat Rate', '/systems-pricebook': 'Residential Systems', '/time-and-materials': 'Time & Materials', '/filter-pricebook': 'Filter Pricebook',
  '/settings': 'Settings', '/team': 'Team', '/roles': 'Roles & Tags', '/time-clock': 'Time Clock',
  '/payroll': 'Payroll Capture', '/session-log': 'Sign-In Log',
  '/organizations': 'Organizations', '/entitlements': 'Plans & Entitlements', '/announcements': 'Announcements', '/my': 'My Pay & Benefits',
  '/features': 'Feature Directory', '/training': 'Training Manual',
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

const RAIL_ICON_PATHS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  start: 'M7 4h10v9a3 3 0 01-3 3h-4a3 3 0 01-3-3zM8 20l2-3M16 20l-2-3M9 8h6',
  'inventory-central': 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
  workforce: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M17 11a3 3 0 003-3 3 3 0 00-3-3M16 20a6 6 0 018-4',
  marketing: 'M4 10v4h3l5 4V6l-5 4H4zM17 8a5 5 0 010 8',
  financials: 'M12 3v18M8 8h6a2 2 0 010 4H9a2 2 0 000 4h7',
  admin: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z',
  refresh: 'M4 12a8 8 0 0114-5m2-3v5h-5M20 12a8 8 0 01-14 5m-2 3v-5h5',
  signout: 'M15 12H4m0 0l4-4m-4 4l4 4M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4',
  fieldapp: 'M7 2h10a1 1 0 011 1v18a1 1 0 01-1 1H7a1 1 0 01-1-1V3a1 1 0 011-1zM10.5 19h3',
  // Train Station stations
  work: 'M4 7h16v13H4zM9 7V5a2 2 0 012-2h2a2 2 0 012 2v2',
  dispatch: 'M4 5h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 7a2 2 0 011-2z',
  maintenance: 'M14 6a4 4 0 01-5.2 5.2L5 15l4 4 3.8-3.8A4 4 0 0018 10l-2 2-2-2 2-2z',
  permitting: 'M7 3h7l4 4v14H7zM14 3v4h4M9 12h6M9 16h6',
  refrigerant: 'M12 2v20M3 7l18 10M21 7L3 17',
  import: 'M12 3v10m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2',
  // Inventory Central stations
  stock: 'M3 8l9-4 9 4-9 4-9-4zM3 8v8l9 4 9-4V8',
  insights: 'M4 20v-6M10 20V6M16 20v-9M3 20h18',
  fleet: 'M3 6h11v9H3zM14 9h4l3 3v3h-7zM7.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  supplies: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2',
  tools: 'M14 4l6 6-3 3-6-6zM11 7l-7 7 3 3 7-7',
  // WorkForce stations
  tag: 'M4 4h7l9 9-7 7-9-9zM8 8h.01',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v5l3 2',
  money: 'M3 6h18v12H3zM12 9a3 3 0 100 6 3 3 0 000-6M6 9h.01M18 15h.01',
  log: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  idcard: 'M3 5h18v14H3zM7 10a2 2 0 104 0 2 2 0 00-4 0M6 16a3 3 0 016 0M14 9h4M14 13h4',
  certificate: 'M12 3a5 5 0 100 10 5 5 0 000-10zM9 12l-2 8 5-3 5 3-2-8',
  // Command Center + Admin items
  approval: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8 12l3 3 5-6',
  channels: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  reviews: 'M12 3l2.5 6 6.5.5-5 4.2 1.6 6.3L12 16l-5.6 3.5 1.6-6.3-5-4.2 6.5-.5z',
  directory: 'M5 4h11a2 2 0 012 2v14H7a2 2 0 01-2-2zM7 4v14M10 8h5M10 12h5',
  organizations: 'M4 21V7l6-4 6 4v14M4 21h16M9 10h.01M9 14h.01M13 10h.01M13 14h.01',
  settings: 'M12 8a4 4 0 100 8 4 4 0 000-8zM19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L14.5 2h-5l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4L3 11a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1l.4 2.6h5l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4-2-1.5a7 7 0 00.1-1z',
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

// ---------------------------------------------------------------------------
// Navigation tree (single-window, drill-down). Mirrors Lloyd's Excel mockup.
// Level 0 = the six top sections; hubs drill to a station list; stations drill
// to their pages. Page lists are pulled from the canonical module navs where
// possible so this file and the modules can't drift apart.
// ---------------------------------------------------------------------------
const WORK_PAGES = [
  { label: 'Jobs Dash', path: '/jobs-dash' },
  { label: 'Jobs', path: '/jobs' },
  { label: 'Jobs Management', path: '/jobs-management' },
  { label: 'Tasks', path: '/tasks' },
  { label: 'Customers', path: '/customers' },
  { label: 'Properties', path: '/properties' },
  { label: 'Job Estimates', path: '/estimates' },
  { label: 'System Estimates', path: '/system-estimates' },
  { label: 'Invoices', path: '/invoices' },
  { label: 'Projects', path: '/projects' },
  { label: 'Payments to Confirm', path: '/payments-to-confirm' },
]
const DISPATCH_PAGES = [
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
]
const MAINT_PAGES = [
  { label: 'Maintenance Station', path: '/maintenance-station', perm: 'view_maintenance_dashboard' },
  { label: 'Maintenance Dashboard', path: '/maintenance-dashboard', perm: 'view_maintenance_dashboard' },
  { label: 'Maintenance Agreements', path: '/maintenance-agreements' },
  { label: 'Maintenance Due', path: '/maintenance-due' },
  { label: 'Maintenance Tiers', path: '/maintenance-tiers' },
  { label: 'Filter Subscriptions', path: '/filter-subscriptions' },
]
const PERMIT_PAGES = [
  { label: 'Permits', path: '/permits' },
  { label: 'Building Authorities', path: '/building-authorities' },
  { label: 'Warranty Registrations', path: '/warranty-registrations' },
  { label: 'Warranty Registration Links', path: '/warranty-registration-links' },
]
const IMPORT_PAGES = [
  { label: 'Import Hub', path: '/import' },
  { label: 'Residential Flat Rate', path: '/pricebook' },
  { label: 'Commercial Flat Rate', path: '/pricebook-commercial' },
  { label: 'Residential Systems', path: '/systems-pricebook' },
  { label: 'Time & Materials', path: '/time-and-materials' },
  { label: 'Filter Pricebook', path: '/filter-pricebook' },
  { label: 'Special Features', path: '/special-features' },
  { label: 'Discount Catalog', path: '/discount-catalog' },
  { label: 'PM Checklists', path: '/pm-checklists' },
  { label: 'System Estimate Setup', path: '/system-estimate-setup' },
  { label: 'Checklists', path: '/checklists' },
]
const STOCK_PAGES = [
  { label: 'Inventory Overview', path: '/elements' },
  { label: 'Locations', path: '/elements/locations' },
  { label: 'Item Catalog', path: '/elements/items' },
  { label: 'Stock & Receiving', path: '/elements/stock' },
  { label: 'Cycle Counts', path: '/elements/cycle-counts' },
  { label: 'Replenishment', path: '/elements/replenishment' },
  { label: 'Purchase Orders', path: '/elements/purchasing' },
  { label: 'Vendor Invoices (A/P)', path: '/elements/ap' },
  { label: 'Vendors', path: '/vendors' },
  { label: 'Vendor Cross-Reference', path: '/elements/vendor-crossref' },
  { label: 'Record Parts Used', path: '/elements/parts-used' },
  { label: 'Inventory Health', path: '/elements/health' },
  { label: 'Inventory Settings', path: '/elements/settings' },
]
const INSIGHTS_PAGES = [
  { label: 'Service → Part Mapping', path: '/elements/service-map' },
  { label: 'Parts Usage', path: '/elements/usage' },
  { label: 'Job Costing', path: '/elements/job-costing' },
  { label: 'Inventory Variance', path: '/elements/variance' },
  { label: 'Inventory Valuation', path: '/elements/valuation' },
  { label: 'Demand Forecast', path: '/elements/forecast' },
]

// Build the section tree for a given profile (entitlement + role gated).
export function buildSections(profile) {
  const isSuper = profile?.role === 'super_admin'
  const notTech = profile?.role !== 'tech'
  const showElements = notTech
  const showTools = notTech && (isSuper || profile?.toolsEntitled)
  const showHR = notTech && (isSuper || profile?.hrEntitled)
  const showPayroll = notTech && (isSuper || profile?.payrollEntitled || profile?.hrEntitled)
  const showMarketing = notTech && (isSuper || profile?.marketingEntitled)

  const trainStation = {
    key: 'train-station', label: 'Train Station', icon: 'start', dash: '/train-station',
    children: [
      { key: 'work', label: 'Jobs & Customers', icon: 'work', dash: '/jobs-dash', children: WORK_PAGES },
      { key: 'dispatch', label: 'Dispatch Station', icon: 'dispatch', dash: '/dispatch', children: DISPATCH_PAGES },
      { key: 'maintenance', label: 'Maintenance Station', icon: 'maintenance', dash: '/maintenance-station', children: MAINT_PAGES },
      { key: 'permitting', label: 'Permitting Station', icon: 'permitting', dash: '/permits', children: PERMIT_PAGES },
      { key: 'refrigerant', label: '608 Refrigeration Compliance', icon: 'refrigerant', dash: '/refrigerant', children: REFRIGERANT_NAV.items },
      { key: 'import', label: 'Data Station', icon: 'import', dash: '/import', children: IMPORT_PAGES },
    ],
  }

  const invStations = [
    { key: 'stock-purchasing', label: 'Stock & Purchasing', icon: 'stock', dash: '/elements', children: STOCK_PAGES },
    { key: 'insights-planning', label: 'Insights & Planning', icon: 'insights', dash: '/elements/service-map', children: INSIGHTS_PAGES },
    { key: 'fleet', label: 'Fleet Dashboard', icon: 'fleet', dash: '/fleet', children: ELEMENTS_FLEET_NAV.items },
    { key: 'supplies', label: 'Non-Inventory Supplies', icon: 'supplies', dash: '/supplies', children: SUPPLIES_NAV.items },
  ]
  if (showTools) invStations.push({ key: 'tools', label: 'Tools Dashboard', icon: 'tools', dash: '/tools', children: TOOLS_NAV.items })
  const inventoryCentral = { key: 'inventory-central', label: 'Inventory Central', icon: 'inventory-central', dash: '/inventory-central', children: invStations }

  const wfStations = [
    { label: 'Team', icon: 'workforce', path: '/team' },
    { label: 'Roles & Tags', icon: 'tag', path: '/roles' },
    { label: 'Time Clock', icon: 'clock', path: '/time-clock' },
    { label: 'Payroll Capture', icon: 'money', path: '/payroll' },
    { label: 'Sign-In Log', icon: 'log', path: '/session-log' },
  ]
  if (showHR) wfStations.push({ key: 'rewards', label: 'Human Resources', icon: 'idcard', dash: '/rewards', children: REWARDS_HR_NAV.items })
  if (showPayroll) {
    // Payroll staff work the employee pay/tax profile too, so surface Employees
    // at the top of the Payroll station (essential for Payroll-only orgs).
    const payrollItems = [{ label: 'Employees', path: '/rewards/employees' }, ...REWARDS_PAYROLL_NAV.items]
    wfStations.push({ key: 'rewards-payroll', label: 'Payroll', icon: 'money', dash: '/rewards/payroll', children: payrollItems })
    wfStations.push({ key: 'rewards-cert', label: 'Certified Payroll', icon: 'certificate', dash: '/rewards/certified', children: REWARDS_CERT_NAV.items })
  }
  const workforce = { key: 'workforce', label: 'WorkForce', icon: 'workforce', dash: '/workforce', children: wfStations }

  // Command Center = the Marketing module (already labeled Command Center in its nav).
  const commandCenterItems = [
    { label: 'Command Center', icon: 'marketing', path: '/marketing' },
    { label: 'Approval Queue', icon: 'approval', path: '/marketing/queue' },
    { label: 'Channels & Assets', icon: 'channels', path: '/marketing/channels' },
    { label: 'Reviews', icon: 'reviews', path: '/marketing/reviews' },
  ]
  const commandCenter = { key: 'command-center', label: 'Command Center', icon: 'marketing', dash: '/marketing', children: commandCenterItems }

  const financials = { key: 'financials', label: 'Financials', icon: 'financials', path: '/financials' }

  const admin = {
    key: 'admin', label: 'Admin', icon: 'admin', dash: '/admin',
    children: [
      { label: 'Settings', icon: 'settings', path: '/settings' },
      { label: 'Financing Central', icon: 'financials', path: '/financing-central' },
      { label: 'Financing Options', icon: 'money', path: '/financing-options' },
      // Platform / super-admin-only controls, tucked here so subscriber orgs never see them.
      { label: 'Lender Directory', icon: 'directory', path: '/financing-directory', super: true },
      { label: 'Organizations', icon: 'organizations', path: '/organizations', super: true },
      { label: 'Plans & Entitlements', icon: 'financials', path: '/entitlements', super: true },
      { label: 'Announcements', icon: 'marketing', path: '/announcements', super: true },
    ],
  }

  const sections = [trainStation]
  if (showElements) sections.push(inventoryCentral)
  if (notTech) sections.push(workforce)
  if (showMarketing) sections.push(commandCenter)
  sections.push(financials)
  sections.push(admin)
  sections.push({ key: 'training', label: 'Training Manual', icon: 'help', path: '/training' })
  return sections
}

// Every navigable target (leaf paths + group dashboards) with the drill-stack
// that should be open when it's the active route.
function collectTargets(nodes, ancestors, out) {
  for (const n of nodes) {
    if (n.children) {
      if (n.dash) out.push({ p: n.dash, stack: [...ancestors, n.key] })
      collectTargets(n.children, [...ancestors, n.key], out)
    } else if (n.path) {
      out.push({ p: n.path, stack: [...ancestors] })
    }
  }
  return out
}
// Longest exact/segment-boundary match wins; loose prefix is a last resort.
function bestTarget(pathname, targets) {
  let best = null
  for (const t of targets) {
    if (pathname === t.p || pathname.startsWith(t.p + '/')) {
      if (!best || t.p.length > best.p.length) best = t
    }
  }
  if (best) return best
  for (const t of targets) {
    if (pathname.startsWith(t.p) && (!best || t.p.length > best.p.length)) best = t
  }
  return best
}
function resolveStack(pathname, targets) {
  if (!pathname || pathname === '/' || pathname === '/home') return []
  const t = bestTarget(pathname, targets)
  return t ? t.stack : []
}
function nodeAt(sections, stack) {
  let list = sections, node = null
  for (const key of stack) {
    node = (list || []).find((n) => n.key === key)
    if (!node) break
    list = node.children || []
  }
  return node
}

export default function Layout({ profile }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isSuperAdmin = profile?.role === 'super_admin'

  // Org name for the top-bar "Viewing Organization" pill.
  const [orgName, setOrgName] = useState('')
  useEffect(() => {
    if (isSuperAdmin) { setOrgName('All Organizations'); return }
    if (!profile?.org_id) { setOrgName(''); return }
    supabase.from('organizations').select('name').eq('id', profile.org_id).single()
      .then(({ data }) => setOrgName(data?.name || ''))
  }, [profile?.org_id, isSuperAdmin])

  const sections = useMemo(() => buildSections(profile), [
    profile?.role, profile?.toolsEntitled, profile?.hrEntitled, profile?.payrollEntitled, profile?.marketingEntitled,
  ])
  const targets = useMemo(() => collectTargets(sections, [], []), [sections])
  const activePath = useMemo(() => {
    const t = bestTarget(location.pathname, targets.filter((x) => x.p))
    return t ? t.p : ''
  }, [location.pathname, targets])

  // openStack = keys of the currently-drilled-into groups (empty = root menu).
  const [openStack, setOpenStack] = useState(() => resolveStack(location.pathname, targets))
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [logoutShiftId, setLogoutShiftId] = useState(null)
  const [loggingOut, setLoggingOut] = useState(false)

  // Navigating (including deep-linking) opens the nav to the matching branch.
  useEffect(() => {
    setOpenStack(resolveStack(location.pathname, targets))
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentNode = openStack.length ? nodeAt(sections, openStack) : null
  const currentChildren = currentNode ? (currentNode.children || []) : sections
  const parentStack = openStack.slice(0, -1)
  const parentNode = parentStack.length ? nodeAt(sections, parentStack) : null
  const parentLabel = parentNode ? parentNode.label : 'Home'
  const atRoot = openStack.length === 0

  function openGroup(node) {
    if (node.dash) navigate(node.dash)
    setOpenStack((s) => [...s, node.key])
  }
  function goBack() {
    setOpenStack((s) => s.slice(0, -1))
  }
  function goHome() {
    setOpenStack([])
  }

  const visible = (item) => (item.super ? isSuperAdmin : (!item.perm || isSuperAdmin || can(profile, item.perm)))

  async function handleLogout() {
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
        const { data: openBreaks } = await supabase
          .from('clock_breaks')
          .select('id')
          .eq('clock_event_id', shiftId)
          .is('break_end', null)
          .limit(1)
        if (openBreaks && openBreaks.length > 0) {
          await supabase.from('clock_breaks').update({ break_end: new Date().toISOString() }).eq('id', openBreaks[0].id)
        }
        await supabase.rpc('tc_clock_out', { p_event_id: shiftId, p_device_id: getDeviceId(), p_lat: null, p_lng: null, p_acc: null })
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

  return (
    <div className="app-shell-v2">
      <ClockInPrompt profile={profile} />
      <CallbackAlert profile={profile} />
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
      <header className="app-topbar" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="app-topbar-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/brand/journey-icon.png" alt="" style={{ height: 36, width: 36, borderRadius: 8, display: 'block', flex: '0 0 auto' }} />
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.08 }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '.01em' }}>Journey <span style={{ color: '#8FB4D6' }}>HVAC</span></span>
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>From Surviving to Thriving</span>
          </span>
        </div>
        <Link to="/features" title="Find any feature in the app" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.14)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.28)', whiteSpace: 'nowrap' }}>
          <span aria-hidden="true">🧭</span> Find a Feature
        </Link>
      </header>
      <div className="shell-body">
        {navCollapsed ? (
          <button className="sidebar-panel-reopen" onClick={() => setNavCollapsed(false)} title="Show menu" aria-label="Show menu">›</button>
        ) : (
        <nav className="sidebar-rail" aria-label="Main navigation">
          {/* HOME — always pinned at the top; resets to the root menu. */}
          <Link
            to="/home"
            onClick={goHome}
            className={'rail-item' + (location.pathname === '/home' || location.pathname === '/' ? ' active' : '')}
          >
            <RailIcon k="home" /><span className="rail-label">Home</span>
          </Link>

          {/* BACK TO: <parent> — only once you've drilled into a section. */}
          {!atRoot && (
            <button className="rail-item" onClick={goBack} style={{ color: '#35B6E8', fontWeight: 700 }}>
              <span className="rail-caret" style={{ color: '#35B6E8', marginRight: 2 }} aria-hidden="true">‹</span>
              <span className="rail-label">BACK TO: {parentLabel}</span>
            </button>
          )}
          {/* Which section/station you're currently inside. */}
          {!atRoot && currentNode && (
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--nav-mist)', fontWeight: 800, padding: '8px 14px 4px' }}>
              {currentNode.label}
            </div>
          )}

          {/* The current level's menu. */}
          {currentChildren.filter(visible).map((item) => (
            item.children ? (
              <button
                key={item.key}
                className="rail-item"
                onClick={() => openGroup(item)}
                style={item.icon ? undefined : { paddingLeft: 20 }}
              >
                {item.icon ? <RailIcon k={item.icon} /> : null}
                <span className="rail-label">{item.label}</span>
                <span className="rail-caret" aria-hidden="true">›</span>
              </button>
            ) : (
              <Link
                key={item.path}
                to={item.path}
                className={'rail-item' + (activePath && item.path === activePath ? ' active' : '')}
                style={item.icon ? undefined : { paddingLeft: 20 }}
              >
                {item.icon ? <RailIcon k={item.icon} /> : null}
                <span className="rail-label">{item.label}</span>
              </Link>
            )
          ))}

          <div className="rail-spacer" />
          {/* Jump to the Field App on this device — for owners/admins who work both
              sides. With the one-desktop-plus-one-phone rule, a phone can sit in the
              Field App while the desktop stays in the office, same login. */}
          {(isSuperAdmin || profile?.role === 'org_admin') && (
            <Link to="/tech" className="rail-item">
              <RailIcon k="fieldapp" /><span className="rail-label">Field App</span>
            </Link>
          )}
          {!isSuperAdmin && profile?.id && profile?.org_id && (
            <div style={{ marginBottom: 12, width: '100%' }}>
              <ClockWidget userId={profile.id} orgId={profile.org_id} variant="desktop" />
            </div>
          )}
          {isSuperAdmin && <div style={{ marginBottom: 12, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--amber, #B8720A)', textAlign: 'center', lineHeight: 1.2, width: '100%' }}>SUPER<br />ADMIN</div>}
          <button className="rail-item" onClick={() => setNavCollapsed(true)}>
            <span className="rail-caret" aria-hidden="true">‹</span><span className="rail-label">Hide menu</span>
          </button>
          <button className="rail-item" onClick={() => window.location.reload(true)}><RailIcon k="refresh" /><span className="rail-label">Refresh</span></button>
          <button className="rail-item" onClick={handleLogout}><RailIcon k="signout" /><span className="rail-label">Sign out</span></button>
        </nav>
        )}

        <div className="main-content-area">
          <Outlet />
        </div>
        <HelpDrawer />
      </div>
    </div>
  )
}
