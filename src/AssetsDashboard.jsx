// Assets Management — umbrella hub for the asset-control modules.
// Today it fronts Inventory Management and Fleet Management; built to grow
// (Tools & Equipment and other specialties drop in as more cards). It also
// surfaces open purchase orders so awaiting-receipt POs aren't forgotten.
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listPurchaseOrders } from './modules/elements-hvac/data'
import QuincyBrief from './QuincyBrief'

const ACCENT = '#2F5DE3'

const CARDS = [
  {
    to: '/elements',
    title: 'Inventory Management',
    desc: 'Parts and consumables, truck and warehouse stock, service-to-part mapping, and usage from the ledger.',
    points: ['Item catalog & locations', 'Service → part mapping', 'Parts usage reporting'],
  },
  {
    to: '/fleet',
    title: 'Fleet Management',
    desc: 'Vehicles, fuel and mileage, preventive maintenance, renewals, repairs, inspections, and routes.',
    points: ['Vehicles & fuel log', 'Maintenance & renewals', 'Inspections & repairs'],
  },
]

const STATUS = {
  ordered: { t: 'Ordered', bg: '#EEF3FB', c: '#1B3A6B' },
  partial: { t: 'Partial', bg: '#F8EEDD', c: '#B0600A' },
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }

export default function AssetsDashboard({ profile }) {
  const orgId = profile?.org_id || ''
  const [pos, setPos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    if (!orgId) { setLoading(false); return }
    listPurchaseOrders(orgId).then((all) => {
      if (!alive) return
      const open = (all || []).filter((p) => p.status === 'ordered' || p.status === 'partial')
      const today = startOfToday()
      open.forEach((p) => { p._overdue = p.expected_at ? new Date(p.expected_at) < today : false })
      open.sort((a, b) => {
        if (a._overdue !== b._overdue) return a._overdue ? -1 : 1
        return (a.expected_at || '9999').localeCompare(b.expected_at || '9999')
      })
      setPos(open); setLoading(false)
    }).catch(() => setLoading(false))
    return () => { alive = false }
  }, [orgId])

  const overdueCount = pos.filter((p) => p._overdue).length
  const shown = pos.slice(0, 8)

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header-bar">
        <h2>Assets Management</h2>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 15, marginTop: 4, marginBottom: 16, maxWidth: 640 }}>
        One place to run everything your company owns and stocks. Pick an area to manage.
      </p>
      <div style={{ marginBottom: 20 }}><QuincyBrief org={orgId} /></div>

      {/* Open purchase orders — awaiting receipt */}
      <div style={{ border: '1px solid var(--border)', borderTop: `4px solid ${overdueCount ? '#B00020' : ACCENT}`, borderRadius: 14, padding: 20, background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: shown.length ? 12 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 17, color: '#152238' }}>Purchase Orders awaiting receipt</span>
            <span className="badge">{pos.length}</span>
            {overdueCount > 0 && <span className="badge" style={{ background: '#FBE7E7', color: '#B00020' }}>{overdueCount} overdue</span>}
          </div>
          <Link to="/elements/purchasing" style={{ color: ACCENT, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Open Purchase Orders →</Link>
        </div>

        {loading ? (
          <div style={{ color: 'var(--mist)', fontSize: 14 }}>Loading…</div>
        ) : shown.length === 0 ? (
          <div style={{ color: 'var(--mist)', fontSize: 14 }}>
            Nothing awaiting receipt. <Link to="/elements/purchasing" style={{ color: ACCENT, fontWeight: 600 }}>Create a purchase order →</Link>
          </div>
        ) : (
          <div style={{ border: '1px solid #EEF1F6', borderRadius: 10, overflow: 'hidden' }}>
            {shown.map((p) => {
              const s = STATUS[p.status] || STATUS.ordered
              const exp = p.expected_at ? new Date(p.expected_at) : null
              return (
                <Link key={p.id} to={`/elements/purchasing?po=${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderBottom: '1px solid #F1F5F9', background: '#fff' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#152238', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.po_number || '(no #)'}{p.job_name ? <span style={{ fontWeight: 600, color: '#1B3A6B' }}> · {p.job_name}</span> : ''} <span style={{ fontWeight: 400, color: 'var(--mist)' }}>· {p.vendor?.name || 'No vendor'}{p.location?.name ? ` → ${p.location.name}` : ''}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--mist)' }}>{p.received}/{p.ordered} received</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {p._overdue
                        ? <span className="badge" style={{ background: '#FBE7E7', color: '#B00020' }}>Overdue{exp ? ` · ${exp.toLocaleDateString()}` : ''}</span>
                        : exp
                          ? <span style={{ fontSize: 12, color: 'var(--mist)' }}>Due {exp.toLocaleDateString()}</span>
                          : null}
                      <span className="badge" style={{ background: s.bg, color: s.c }}>{s.t}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
            {pos.length > shown.length && (
              <Link to="/elements/purchasing" style={{ display: 'block', padding: '9px 14px', color: ACCENT, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                +{pos.length - shown.length} more →
              </Link>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
        {CARDS.map((c) => (
          <Link key={c.to} to={c.to} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid var(--border)', borderTop: '4px solid ' + ACCENT, borderRadius: 14, padding: 22, height: '100%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#152238', marginBottom: 8 }}>{c.title}</div>
              <div style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 14, lineHeight: 1.5 }}>{c.desc}</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', fontSize: 13, lineHeight: 1.7 }}>
                {c.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <div style={{ marginTop: 16, color: ACCENT, fontWeight: 700, fontSize: 14 }}>Open →</div>
            </div>
          </Link>
        ))}

        <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: 22, height: '100%', background: 'var(--panel, #F8FAFC)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', minHeight: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#8A93A6', marginBottom: 6 }}>Tools &amp; Equipment</div>
          <div style={{ color: '#8A93A6', fontSize: 13 }}>Coming soon — more asset types will live here.</div>
        </div>
      </div>
    </div>
  )
}
