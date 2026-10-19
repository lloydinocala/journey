import { can } from './permissions'

// One Settings page, one section per main navigation heading.
// Each page that has settings gets a ⚙ button (in the top bar) that opens Settings
// at its section, and the section offers a button straight back to that page.
// To give a new page settings: add its route to ROUTE_SECTIONS and put the
// controls in the matching section of Settings.jsx.
export const SETTINGS_SECTIONS = [
  { key: 'me', label: 'My Preferences', admin: false, desc: 'Settings that apply only to you.' },
  { key: 'company', label: 'Company', admin: true, desc: 'Your business identity — branding, contact info, and time zone.' },
  { key: 'work', label: 'Jobs & Customers', admin: true, desc: 'Job types, estimates, invoices, and sales tax.' },
  { key: 'dispatch', label: 'Dispatch', admin: true, desc: 'Business hours, scheduling, and online booking.' },
  { key: 'permitting', label: 'Permitting', admin: true, desc: 'Permit tracking.' },
  { key: 'workforce', label: 'WorkForce', admin: true, desc: 'Pay rates, pay periods, roles, and team access.' },
  { key: 'financials', label: 'Financials & Payments', admin: true, desc: 'Card payments, collections, and accounting connections.' },
  { key: 'inventory', label: 'Inventory Central', admin: true, desc: 'Inventory has its own settings page.' },
]

// Route prefix → settings section. Longest matching prefix wins.
const ROUTE_SECTIONS = {
  '/jobs': 'work', '/jobs-dash': 'work', '/jobs-management': 'work', '/tasks': 'work',
  '/customers': 'work', '/properties': 'work', '/estimates': 'work', '/system-estimates': 'work',
  '/invoices': 'work', '/payments-to-confirm': 'work',
  '/dispatch': 'dispatch', '/calendar': 'dispatch', '/dispatch-map': 'dispatch', '/call': 'dispatch',
  '/call-log': 'dispatch', '/service-requests': 'dispatch', '/filter-orders': 'dispatch',
  '/text-archive': 'dispatch', '/on-call': 'dispatch', '/needs-rescheduling': 'dispatch',
  '/permits': 'permitting', '/building-authorities': 'permitting',
  '/workforce': 'workforce', '/team': 'workforce', '/roles': 'workforce', '/time-clock': 'workforce', '/payroll': 'workforce',
  '/financials': 'financials', '/financing-central': 'financials',
  '/elements': 'inventory', '/inventory-central': 'inventory',
}

export function sectionForPath(pathname) {
  if (!pathname || pathname.startsWith('/settings')) return null
  let best = null
  for (const prefix of Object.keys(ROUTE_SECTIONS)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      if (!best || prefix.length > best.length) best = prefix
    }
  }
  return best ? ROUTE_SECTIONS[best] : null
}

export function isSettingsAdmin(profile) {
  if (!profile) return false
  return profile.role === 'super_admin' || profile.role === 'org_admin' || can(profile, 'update_company_account')
}

export function settingsHref(section, fromPath, fromLabel) {
  const q = new URLSearchParams({ section })
  if (fromPath) q.set('from', fromPath)
  if (fromLabel) q.set('fromLabel', fromLabel)
  return `/settings?${q.toString()}`
}
