// Assets Management — umbrella hub for the asset-control modules.
// Today it fronts Inventory Management and Fleet Management; built to grow
// (Tools & Equipment and other specialties drop in as more cards).
import { Link } from 'react-router-dom'

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

export default function AssetsDashboard({ profile }) {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header-bar">
        <h2>Assets Management</h2>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 15, marginTop: 4, marginBottom: 24, maxWidth: 640 }}>
        One place to run everything your company owns and stocks. Pick an area to manage.
      </p>

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
