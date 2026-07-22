// Elements-HVAC · Fleet · Dashboard — the weekly monitor with color flags
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboardData, FLAG_COLORS } from './fleetData'
import { listTechnicians } from './data'
import { useOrgSelector, OrgBar } from './shared'

export default function FleetDashboard({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [techs, setTechs] = useState([])
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [d, t] = await Promise.all([dashboardData(org.selectedOrg), listTechnicians(org.selectedOrg)])
    setRows(d); setTechs(t); setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const techName = (id) => techs.find((x) => x.id === id)?.full_name || '—'
  const totalRed = rows.reduce((s, r) => s + r.redFlags, 0)
  const totalAmber = rows.reduce((s, r) => s + r.amberFlags, 0)

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Fleet Dashboard</h2>
          <span className="badge">{rows.length} vehicles</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      <OrgBar {...org} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 18px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: FLAG_COLORS.red }}>{totalRed}</div>
          <div style={{ fontSize: 12, color: 'var(--mist)' }}>Red flags — act now</div>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 18px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: FLAG_COLORS.amber }}>{totalAmber}</div>
          <div style={{ fontSize: 12, color: 'var(--mist)' }}>Amber flags — worth a look</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>
          No vehicles yet. Add them under <Link to="/fleet/vehicles">Fleet Vehicles</Link>, then log or import fuel to see monitoring here.
        </p>
      ) : (
        rows.map((r) => {
          const worst = r.redFlags > 0 ? FLAG_COLORS.red : r.amberFlags > 0 ? FLAG_COLORS.amber : '#16A34A'
          return (
            <div key={r.vehicle.id} style={{ border: '1px solid var(--border)', borderLeft: `4px solid ${worst}`, borderRadius: 12, marginBottom: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{r.vehicle.name}</div>
                  <div style={{ color: 'var(--mist)', fontSize: 13 }}>{techName(r.vehicle.assigned_user_id)}</div>
                </div>
                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                  <Metric label="Odometer" value={r.latestOdometer != null ? Number(r.latestOdometer).toLocaleString() : '—'} />
                  <Metric label="Last MPG" value={r.lastMpg != null ? r.lastMpg.toFixed(1) : '—'} />
                  <Metric label="Avg $/gal" value={r.avgCpg != null ? `$${r.avgCpg.toFixed(2)}` : '—'} />
                  <Metric label="Last fill" value={r.lastFillDate || '—'} />
                </div>
              </div>
              {r.flags.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {r.flags.map((f, i) => (
                    <span key={i} style={{ background: FLAG_COLORS[f.color], color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>{f.label}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--mist)' }}>{label}</div>
    </div>
  )
}
