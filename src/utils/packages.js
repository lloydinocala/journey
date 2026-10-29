// Subscription packages — which pages belong to which package.
// The package switches themselves live in the database (features + org_addons, resolved by the
// org_entitlements RPC into profile.entitlements). This file maps app routes onto those packages
// so menus hide, pages lock and usage is counted the same way everywhere.
// Basic (the always-on features) owns every route not listed here.
import { hasFeature } from './entitlements'

// Longest matching prefix wins, so /elements/job-costing (Insights) beats /elements (Inventory).
// A prefix matches the path itself or anything under it ("/dispatch" matches "/dispatch" and
// "/dispatch/x", not "/dispatch-map" — list those separately).
export const PACKAGE_ROUTES = {
  system_sales: ['/system-estimates', '/system-estimate', '/system-estimate-p', '/system-estimate-guided', '/new-system-estimate',
    '/systems-pricebook', '/system-estimate-setup', '/special-features', '/discount-catalog', '/financing-central', '/financing-options',
    '/tech/system-estimate', '/tech/system-estimate-p', '/tech/system-estimate-guided', '/tech/new-system-estimate'],
  duct_cleaning: ['/pricebook-duct-cleaning', '/duct-estimate-guided', '/tech/duct-estimate-guided'],
  maintenance: ['/maintenance-station', '/maintenance-dashboard', '/maintenance-agreements', '/maintenance-due', '/maintenance-tiers',
    '/filter-subscriptions', '/filter-orders', '/filter-pricebook', '/pm-checklists', '/tech/pm-checklist'],
  dispatch_pro: ['/dispatch', '/dispatch-map', '/needs-rescheduling', '/on-call', '/service-requests'],
  phone_comms: ['/call', '/call-log', '/known-contacts', '/team-communications', '/text-archive'],
  ai_agents: ['/agent-inbox'],
  permitting: ['/permits', '/building-authorities', '/refrigerant'],
  commercial_projects: ['/pricebook-commercial', '/commercial', '/tech/projects'],
  inventory_fleet: ['/elements', '/inventory-central', '/vendors', '/fleet', '/supplies', '/tools', '/receiver', '/tech/cycle-counts'],
  insights: ['/elements/service-map', '/elements/usage', '/elements/job-costing', '/elements/variance', '/elements/valuation', '/elements/forecast'],
  workforce: ['/rewards', '/payroll'],
  marketing: ['/marketing'],
}
// Pages that serve more than one package: open when the org has ANY of them.
export const SHARED_ROUTES = {
  '/estimate-app-setup': ['estimate_app_systems', 'estimate_app_duct', 'system_sales', 'duct_cleaning'],
}

const ROUTE_LIST = Object.entries(PACKAGE_ROUTES)
  .flatMap(([key, prefixes]) => prefixes.map((p) => [p, key]))
  .sort((a, b) => b[0].length - a[0].length)

const under = (path, prefix) => path === prefix || path.startsWith(prefix + '/')

// The package that owns a path, or null for Basic.
export function packageForPath(pathname) {
  const path = String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/'
  for (const [prefix, key] of ROUTE_LIST) if (under(path, prefix)) return key
  return null
}

// Can this profile open this path? Super admin sees everything.
export function pathAllowed(profile, pathname) {
  if (!profile || profile.role === 'super_admin') return true
  const path = String(pathname || '').split('?')[0]
  for (const [p, keys] of Object.entries(SHARED_ROUTES)) if (under(path, p)) return keys.some((k) => hasFeature(profile, k))
  const key = packageForPath(path)
  return !key || hasFeature(profile, key)
}

// The package a locked path needs (for the "not in your subscription" page), or null if allowed.
export function lockedPackageFor(profile, pathname) {
  if (pathAllowed(profile, pathname)) return null
  const path = String(pathname || '').split('?')[0]
  for (const [p, keys] of Object.entries(SHARED_ROUTES)) if (under(path, p)) return keys[0]
  return packageForPath(path)
}

// Drop menu items the org can't open; a group whose own page is locked opens its first open
// child instead; a group with nothing left disappears.
export function pruneNav(profile, nodes) {
  if (!profile || profile.role === 'super_admin') return nodes
  const out = []
  for (const n of nodes) {
    if (n.header) { out.push(n); continue }
    if (n.children) {
      const kids = pruneNav(profile, n.children)
      const real = kids.filter((k) => !k.header)
      if (!real.length && !(n.dash && pathAllowed(profile, n.dash))) continue
      // Drop headers left with nothing under them.
      const tidy = kids.filter((k, i) => !k.header || (kids[i + 1] && !kids[i + 1].header))
      const dash = n.dash && !pathAllowed(profile, n.dash) ? (real.find((k) => k.path)?.path || real.find((k) => k.dash)?.dash) : n.dash
      out.push({ ...n, dash, children: tidy })
      continue
    }
    if (n.path && !pathAllowed(profile, n.path)) continue
    out.push(n)
  }
  return out
}

// Count one open per package per day per browser — cheap usage signal for the office.
export function logPackageOpen(supabase, profile, pathname) {
  if (!profile?.org_id || profile.role === 'super_admin') return
  const key = packageForPath(pathname) || 'basic'
  const stamp = `pkguse:${new Date().toISOString().slice(0, 10)}:${key}`
  try { if (sessionStorage.getItem(stamp)) return; sessionStorage.setItem(stamp, '1') } catch { /* private mode */ }
  supabase.rpc('log_package_use', { p_keys: [key] }).then(() => {}, () => {})
}
