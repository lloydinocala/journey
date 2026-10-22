import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildSections } from './Layout'
import { can } from './utils/permissions'

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
  { feature: 'Import Systems Pricebook', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/systems-pricebook', show: isOffice },
  { feature: 'Import Vendor Price File', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/vendor-prices', show: isOffice },
  { feature: 'Import Parts Catalog', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/parts-catalog', show: isOffice },
  { feature: 'Import Tools', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/tools', show: isOffice },
  { feature: 'Import Filter Price Book', heading: 'Train Station', page: 'Data Station → Import Hub', path: '/import/filter-pricebook', show: isOffice },
  // Field App (opened from the "Field App" button at the bottom of the menu)
  { feature: 'Field App — Job Cards', heading: 'Field App', page: 'Job Cards', path: '/tech', show: isOwner },
  { feature: 'Field App — Schedule', heading: 'Field App', page: 'Schedule tab', path: '/tech/schedule', show: isOwner },
  { feature: 'The Tower', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/tower', show: isOwner },
  { feature: 'Field Cycle Count', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/cycle-counts', show: isOwner },
  { feature: 'Receiving', heading: 'Field App', page: 'Supervisor Tools', path: '/receiver', show: (p) => isFieldAdmin(p) && can(p, 'access_receiver') },
  { feature: 'Field New Job', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/new-job', show: isOwner },
  { feature: 'Field Estimate (any kind, job optional)', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/new-estimate', show: isOwner },
  { feature: 'Field Follow-up Estimate', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/new-followup-estimate', show: isOwner },
  { feature: 'Field System Estimate', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/new-system-estimate', show: isOwner },
  { feature: 'Chat with Quincy', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/apollo', show: isOwner },
  { feature: 'Field Manual', heading: 'Field App', page: 'Supervisor Tools', path: '/tech/manual', show: isOwner },
  { feature: 'My Records (Pay & Benefits)', heading: 'Field App', page: 'Header → My Records', path: '/my', show: isOwner },
  { feature: 'Field App Settings', heading: 'Field App', page: 'Header → Settings', path: '/tech/settings', show: isOwner },
]

function flattenNav(sections, profile) {
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
    for (const child of (section.children || [])) {
      if (!allowed(child)) continue
      if (child.children) {
        const page = child.label
        if (child.dash) add(child.label, heading, page, child.dash, true)
        for (const gc of child.children) {
          if (!allowed(gc)) continue
          add(gc.label, heading, page, gc.path || gc.dash)
        }
      } else {
        // A page sitting directly under a heading has no sub-page of its own.
        add(child.label, heading, '—', child.path)
      }
    }
  }
  for (const x of EXTRA_FEATURES) if (x.show(profile)) add(x.feature, x.heading, x.page, x.path)

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
        Every feature in the app, A–Z, with how to reach it from Home and a direct link. Search to jump anywhere.
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
    </div>
  )
}
