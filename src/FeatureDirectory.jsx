import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildSections } from './Layout'
import { can } from './utils/permissions'
import { pathAllowed, PACKAGE_ROUTES } from './utils/packages'
import { hasFeature } from './utils/entitlements'
import { supabase } from './utils/supabase'

// Feature Directory — a flat, A–Z, searchable index of every feature in the app,
// showing how to reach it from Home (navigation heading → page) plus a direct
// link. Generated from the live navigation tree (buildSections), so it stays in
// sync automatically as features are added, renamed, or moved.
//
// EXTRA_FEATURES covers real pages that are reached some other way than the
// left menu (top bar, dashboard tiles, the Data Station hub, the +New menu, the
// Field App) — without them the directory silently missed those features.
const isOffice = (p) => p?.role !== 'tech'
const isOwner = (p) => p?.role === 'super_admin' || p?.role === 'org_admin'
const isFieldAdmin = (p) => isOwner(p) || !!p?.is_field_supervisor

const EXTRA_FEATURES = [
  // Office pages reached outside the left menu
  { feature: 'Home Dashboard', heading: 'Top bar', page: 'Command Center tab', path: '/home', show: isOffice },
  { feature: 'Operations Dashboard', heading: 'Top bar', page: 'Command Center tab → KPIs → Operations', path: '/operations', show: isOffice },
  { feature: 'To-Do List', heading: 'Train Station', page: 'Dispatch Station → Calendar (To-Do tile)', path: '/to-do', show: isOffice },
  { feature: 'New Estimate (any kind, job optional)', heading: '+New menu', page: 'New Estimate', path: '/new-estimate', show: isOffice },
  { feature: 'New System Estimate', heading: '+New menu', page: 'New System Estimate', path: '/new-system-estimate', show: isOffice },
  { feature: 'Follow-up Estimate', heading: '+New menu', page: 'Follow-up Estimate', path: '/new-followup-estimate', show: isOffice },
  // Data Station importers (cards on the Import Hub)
  { feature: 'Import Customers', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/customers', show: isOffice },
  { feature: 'Import Properties', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/properties', show: isOffice },
  { feature: 'Import Jobs', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/jobs', show: isOffice },
  { feature: 'Import Services Pricebook', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/services-pricebook', show: isOffice },
  { feature: 'Import Systems Pricebook', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/systems-pricebook', pkg: 'system_sales', show: isOffice },
  { feature: 'Import Vendor Price File', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/vendor-prices', pkg: 'inventory_fleet', show: isOffice },
  { feature: 'Import Parts Catalog', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/parts-catalog', pkg: 'inventory_fleet', show: isOffice },
  { feature: 'Import Tools', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/tools', pkg: 'inventory_fleet', show: isOffice },
  { feature: 'Import Filter Price Book', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/filter-pricebook', pkg: 'maintenance', show: isOffice },
    // Estimates, payments and setup reached from inside other pages
  { feature: 'Guided System Estimate (walk the customer through, real prices)', heading: '+New menu', page: 'New Estimate → New System → Create & Start Guided Estimate', path: '/new-system-estimate', show: isOffice },
  { feature: 'Guided Duct Cleaning Estimate', heading: '+New menu', page: 'New Estimate → Duct Cleaning → Create & Start Guided Estimate', path: '/new-estimate', pkg: 'duct_cleaning', show: isOffice },
  { feature: 'Payments to Confirm (release installs to the calendar)', heading: 'Train Station', page: 'Jobs & Customers → Invoices → Payments to Confirm tab', path: '/invoices?tab=confirm', show: isOffice },
  { feature: 'Duct Cleaning App Settings', heading: 'Train Station', page: 'Data Station → Estimate App Setup → Duct Cleaning App', path: '/estimate-app-setup', pkg: 'duct_cleaning', show: isOwner },
  { feature: 'Estimate App — What\u2019s Included, Price Adders & Brand Logos', heading: 'Train Station', page: 'Data Station → Estimate App Setup', path: '/estimate-app-setup', pkg: 'system_sales', show: isOwner },
  { feature: 'Online Booking Rules (install & duct cleaning dates)', heading: 'Admin', page: 'Settings → Dispatch → Online booking rules', path: '/settings?section=dispatch', show: isOwner },
  { feature: 'Business Hours & Holidays', heading: 'Admin', page: 'Settings → Dispatch → Business hours', path: '/settings?section=dispatch', show: isOwner },
  { feature: 'Card Payments (Stripe) & Payouts Setup', heading: 'Admin', page: 'Settings → Financials', path: '/settings?section=financials', show: isOwner },
  { feature: 'QuickBooks Connection', heading: 'Admin', page: 'Settings → Financials → QuickBooks', path: '/settings?section=financials', show: isOwner },
  // Field App (opened from the "Field App" button at the bottom of the menu)
  { feature: 'Field App — Job Cards', heading: 'Field App', page: 'Job Cards', path: '/tech', show: isOwner },
  { feature: 'Field App — Schedule', heading: 'Field App', page: 'Schedule tab', path: '/tech/schedule', show: isOwner },
  { feature: 'The Tower', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/tower', show: isOwner },
  { feature: 'Field Cycle Count', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/cycle-counts', pkg: 'inventory_fleet', show: isOwner },
  { feature: 'Receiving', heading: 'Field App', page: 'Supervisor Tools', path: '/receiver', show: (p) => isFieldAdmin(p) && can(p, 'access_receiver') },
  { feature: 'Field New Job', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/new-job', show: isOwner },
  { feature: 'Field Estimate (any kind, job optional)', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/new-estimate', show: isOwner },
  { feature: 'Field Follow-up Estimate', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/new-followup-estimate', show: isOwner },
  { feature: 'Field System Estimate', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/new-system-estimate', show: isOwner },
  { feature: 'Field Guided Duct Cleaning Estimate', heading: 'Field App', page: 'Supervisor Tools → New Estimate → Duct Cleaning', path: '/tech/new-estimate', pkg: 'duct_cleaning', show: isOwner },
  { feature: 'Chat with Quincy', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/apollo', show: isOwner },
  { feature: 'Field Manual', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/manual', show: isOwner },
  { feature: 'My Records (Pay & Benefits)', heading: 'Field App', page: 'Header → My Records', path: '/my', show: isOwner },
  { feature: 'Field App Settings', heading: 'Field App', page: 'Header → Settings', path: '/tech/settings', show: isOwner },
]

export function flattenNav(sections, profile) {
  const isSuper = profile?.role === 'super_admin'
  const allowed = (n) => (n.super ? isSuper : (!n.perm || isSuper || can(profile, n.perm)))
  const rows = []
  const add = (feature, heading, page, path, isDash = false) => {
    if (feature && path) rows.push({ feature, heading, page, path, isDash })
  }
  for (const section of sections) {
    const heading = section.label
    if (section.path && !section.children) { add(section.label, heading, '—', section.path); continue }
    if (section.dash) add(section.label, heading, 'Overview', section.dash, true)
    // Walk every level (stations → groups → pages); the page column shows the trail below the heading.
    const walk = (nodes, trail) => {
      for (const child of nodes || []) {
        if (child.header || !allowed(child)) continue
        if (child.children) {
          const t = [...trail, child.label]
          if (child.dash) add(child.label, heading, t.join(' → '), child.dash, true)
          walk(child.children, t)
        } else {
          // A page sitting directly under a heading has no sub-page of its own.
          add(child.label, heading, trail.length ? trail.join(' → ') : '—', child.path)
        }
      }
    }
    walk(section.children, [])
  }
  // Extras follow the subscription too: only pages this account can open.
  for (const x of EXTRA_FEATURES) {
    if (!x.show(profile)) continue
    if (x.pkg && !hasFeature(profile, x.pkg)) continue
    if (!pathAllowed(profile, x.path)) continue
    add(x.feature, x.heading, x.page, x.path)
  }

  // One row per destination: when a group's overview lands on the same page as
  // one of its own items (e.g. "Human Resources" and "HR Dashboard"), keep the
  // item. The group name still appears in the heading/page columns, so search
  // finds it either way.
  const byPath = new Map()
  for (const r of rows) { if (!byPath.has(r.path)) byPath.set(r.path, []); byPath.get(r.path).push(r) }
  const uniq = []
  for (const group of byPath.values()) {
    const items = group.filter((r) => !r.isDash)
    const keep = items.length ? items : group.slice(0, 1)
    const seen = new Set()
    for (const r of keep) { if (!seen.has(r.feature)) { seen.add(r.feature); uniq.push(r) } }
  }
  uniq.sort((a, b) => a.feature.localeCompare(b.feature, undefined, { sensitivity: 'base' }))
  return uniq
}

// Packages this account doesn't have — listed so people know what else Journey can do.
function MoreInJourney({ profile, query }) {
  const [pkgs, setPkgs] = useState([])
  useEffect(() => {
    if (!profile?.org_id || profile.role === 'super_admin') return
    supabase.from('features').select('key, name, description, status, sort_order').eq('kind', 'addon').eq('is_active', true).order('sort_order')
      .then(({ data }) => setPkgs((data || []).filter((p) => !hasFeature(profile, p.key))))
  }, [profile?.org_id, profile?.role, profile?.entitlements])
  const shown = query ? pkgs.filter((p) => `${p.name} ${p.description || ''}`.toLowerCase().includes(query)) : pkgs
  if (!shown.length) return null
  return (
    <div style={{ marginTop: 26 }}>
      <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>More in Journey</h3>
      <p style={{ color: 'var(--mist)', fontSize: 13, margin: '0 0 10px' }}>Packages not in your subscription yet. Open one to see what it does and ask about a free trial.</p>
      <div style={{ display: 'grid', gap: 8, maxWidth: 820 }}>
        {shown.map((p) => {
          const first = (PACKAGE_ROUTES[p.key] || []).find((r) => !r.startsWith('/tech'))
          return (
            <div key={p.key} className="section-card" style={{ padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <b>{p.name}</b>{p.status === 'planned' && <span style={{ marginLeft: 6, fontSize: 11, color: '#475569', background: '#EEF1F5', borderRadius: 4, padding: '1px 5px' }}>coming</span>}
                {p.description && <div style={{ fontSize: 13, color: 'var(--mist)' }}>{p.description}</div>}
              </div>
              {first && p.status !== 'planned' && <Link to={first} style={{ color: '#2F6BE3', fontWeight: 700, fontSize: 13.5 }}>learn more →</Link>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function FeatureDirectory({ profile }) {
  const [q, setQ] = useState('')
  const rows = useMemo(() => flattenNav(buildSections(profile), profile), [profile])
  const query = q.trim().toLowerCase()
  const filtered = query ? rows.filter((r) => `${r.feature} ${r.heading} ${r.page}`.toLowerCase().includes(query)) : rows

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Feature Directory</h2>
        <span className="badge">{rows.length} features</span>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 4, marginBottom: 16 }}>
        Every feature in your Journey subscription, A–Z, with how to reach it from Home and a direct link. Search to jump anywhere.
      </p>
      <input type="text" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search features — e.g. “invoice”, “payroll”, “fleet”…"
        style={{ padding: '10px 12px', width: '100%', maxWidth: 480, marginBottom: 16 }} />
      <div style={{ overflowX: 'auto' }}>
        <div className="grid-table" style={{ gridTemplateColumns: '1.4fr 1.2fr 1.3fr 0.6fr', minWidth: 720 }}>
          <div className="grid-cell grid-head">Feature</div>
          <div className="grid-cell grid-head">Navigation heading</div>
          <div className="grid-cell grid-head">Navigation page</div>
          <div className="grid-cell grid-head">Link</div>
          {filtered.map((r, i) => {
            const bg = i % 2 ? 'var(--ink)' : 'var(--panel)'
            return (
              <div key={r.path + r.feature} style={{ display: 'contents' }}>
                <div className="grid-cell" style={{ background: bg, fontWeight: 600 }}>{r.feature}</div>
                <div className="grid-cell" style={{ background: bg }}>{r.heading}</div>
                <div className="grid-cell" style={{ background: bg }}>{r.page}</div>
                <div className="grid-cell" style={{ background: bg }}><Link to={r.path} style={{ color: '#2F6BE3', fontWeight: 700 }}>open →</Link></div>
              </div>
            )
          })}
          {filtered.length === 0 && <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No features match “{q}”.</div>}
        </div>
      </div>
      <MoreInJourney profile={profile} query={query} />
    </div>
  )
}
