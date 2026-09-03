// Bulk Import hub — a tile dashboard fronting the individual import tools, so the
// navigation stays a single entry instead of a long dropdown. Built to grow: add
// a card here as new import functions land. No AI brief on this utility dashboard.
import { Link } from 'react-router-dom'

const ACCENT = '#2F5DE3'

const IMPORTS = [
  { to: '/import/customers', icon: '👤', title: 'Customers', desc: 'Bring in your customer list — names, contacts, and billing details — from a spreadsheet.' },
  { to: '/import/properties', icon: '🏠', title: 'Properties', desc: 'Service addresses and locations, linked to the customers who own them.' },
  { to: '/import/jobs', icon: '🧰', title: 'Jobs', desc: 'Historical or in-flight jobs so your records and reporting start complete.' },
  { to: '/import/services-pricebook', icon: '📗', title: 'Services Pricebook', desc: 'Your service and labor pricing catalog, including trip charges and variants.' },
  { to: '/import/systems-pricebook', icon: '❄️', title: 'Systems Pricebook', desc: 'Equipment and full-system pricing for install and replacement estimates.' },
  { to: '/import/vendor-prices', icon: '🧾', title: 'Vendor Price File', desc: 'Vendor parts price files to keep material costs and markups current.' },
  { to: '/import/parts-catalog', icon: '🔩', title: 'Parts Catalog', desc: 'Your inventory parts master — names, units, reorder levels, and markups for stock tracking.' },
  { to: '/import/tools', icon: '🛠️', title: 'Tools', desc: 'Your durable tools — name, brand, model/serial, purchase date and cost, received into the shop.' },
  { to: '/import/filter-pricebook', icon: '🌬️', title: 'Filter Price Book', desc: 'Your retail air-filter prices by size, type and MERV, with 1–3 / 4–5 / 6–11 / case-of-12 pricing. Feeds the customer portal.' },
]

export default function ImportDashboard() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header-bar">
        <h2>Bulk Import</h2>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 15, marginTop: 4, marginBottom: 24, maxWidth: 680 }}>
        Load your existing data into Journey. Pick what you'd like to import — each tool walks you through
        matching your columns and previewing rows before anything is saved.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {IMPORTS.map((c) => (
          <Link key={c.to} to={c.to} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid var(--border)', borderTop: '4px solid ' + ACCENT, borderRadius: 14, padding: 20, height: '100%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', transition: 'box-shadow .15s, transform .15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 22px rgba(16,32,47,.12)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.06)'; e.currentTarget.style.transform = 'none' }}>
              <div style={{ fontSize: 26, marginBottom: 8 }} aria-hidden>{c.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#152238', marginBottom: 6 }}>Import {c.title}</div>
              <div style={{ color: 'var(--mist)', fontSize: 13.5, lineHeight: 1.5 }}>{c.desc}</div>
              <div style={{ color: ACCENT, fontWeight: 700, fontSize: 13.5, marginTop: 12 }}>Start import →</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
