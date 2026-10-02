import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildSections } from './Layout'

// Feature Directory — a flat, A–Z, searchable index of every feature in the app,
// showing how to reach it from Home (navigation heading → page) plus a direct
// link. Generated from the live navigation tree (buildSections), so it stays in
// sync automatically as features are added, renamed, or moved.
function flattenNav(sections, isSuper) {
  const rows = []
  const add = (feature, heading, page, path) => { if (feature && path) rows.push({ feature, heading, page, path }) }
  for (const section of sections) {
    const heading = section.label
    if (section.path && !section.children) { add(section.label, heading, '—', section.path); continue }
    if (section.dash) add(section.label, heading, 'Overview', section.dash)
    for (const child of (section.children || [])) {
      if (child.super && !isSuper) continue
      if (child.children) {
        const page = child.label
        if (child.dash) add(child.label, heading, page, child.dash)
        for (const gc of child.children) {
          if (gc.super && !isSuper) continue
          add(gc.label, heading, page, gc.path || gc.dash)
        }
      } else {
        add(child.label, heading, heading, child.path)
      }
    }
  }
  const seen = new Set()
  const uniq = []
  for (const r of rows) { const k = r.path + '|' + r.feature; if (!seen.has(k)) { seen.add(k); uniq.push(r) } }
  uniq.sort((a, b) => a.feature.localeCompare(b.feature, undefined, { sensitivity: 'base' }))
  return uniq
}

export default function FeatureDirectory({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [q, setQ] = useState('')
  const rows = useMemo(() => flattenNav(buildSections(profile), isSuper), [profile, isSuper])
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
