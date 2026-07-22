// Elements-HVAC · Inventory overview (module landing)
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getSettings, listItems, listLocations, listMaps } from './data'
import { useOrgSelector, OrgBar, EnabledPill, DisabledNotice } from './shared'

const CARDS = [
  { path: '/elements/locations', title: 'Locations', desc: 'Warehouses and trucks; assign a technician to each truck.' },
  { path: '/elements/items', title: 'Item Catalog', desc: 'Parts and consumables — description, cost, vendor, units.' },
  { path: '/elements/service-map', title: 'Service → Part Mapping', desc: 'Link pricebook parts to inventory parts so invoices deduct stock.' },
  { path: '/elements/usage', title: 'Parts Usage', desc: 'What each truck/technician consumed, from the ledger.' },
  { path: '/elements/settings', title: 'Inventory Settings', desc: 'Enable the module, issue-day, and reorder defaults.' },
]

export default function ElementsInventory({ profile }) {
  const org = useOrgSelector(profile)
  const [stats, setStats] = useState({ enabled: false, items: 0, trucks: 0, warehouses: 0, mapped: 0 })

  async function load() {
    if (!org.selectedOrg) return
    const [s, items, locs, maps] = await Promise.all([
      getSettings(org.selectedOrg), listItems(org.selectedOrg), listLocations(org.selectedOrg), listMaps(org.selectedOrg),
    ])
    setStats({
      enabled: !!s?.enabled,
      items: items.length,
      trucks: locs.filter((l) => l.type === 'truck').length,
      warehouses: locs.filter((l) => l.type === 'warehouse').length,
      mapped: new Set(maps.map((m) => m.service_id)).size,
    })
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const Stat = ({ label, value }) => (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', minWidth: 120 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#1B3A6B' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--mist)' }}>{label}</div>
    </div>
  )

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Elements-HVAC · Inventory</h2>
          <EnabledPill enabled={stats.enabled} />
        </div>
      </div>
      <OrgBar {...org} />
      <DisabledNotice enabled={stats.enabled} />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <Stat label="Trucks" value={stats.trucks} />
        <Stat label="Warehouses" value={stats.warehouses} />
        <Stat label="Parts" value={stats.items} />
        <Stat label="Mapped services" value={stats.mapped} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {CARDS.map((c) => (
          <Link key={c.path} to={c.path} style={{ textDecoration: 'none' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 18, height: '100%' }}>
              <div style={{ fontWeight: 700, color: '#1B3A6B', marginBottom: 6 }}>{c.title}</div>
              <div style={{ color: 'var(--mist)', fontSize: 13 }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
