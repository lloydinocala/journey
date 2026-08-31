// Elements-HVAC · Fleet · Dashboard — the weekly monitor with color flags
// Adds a Compliance panel: insurance & document expirations and inspection-due
// flags, computed from the insurance/legal + inspection-config data layers.
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboardData, latestOdometersByVehicle, FLAG_COLORS } from './fleetData'
import { listTechnicians } from './data'
import { useOrgSelector, OrgBar } from './shared'
import { listPolicies, listDocuments, expiryStatus, docTypeLabel } from './fleetLegalData'
import { getSettings, lastInspectionsByVehicle, inspectionDue } from './fleetInspectData'
import AiAssist from '../../AiAssist'

const FLEET_HEALTH_SYS = 'Summarize the fleet health for an HVAC company manager, using only the provided data. Call out the vehicles that need attention (red first, then amber), why, and the single most important action to take. Include compliance items such as insurance or registration expirations and inspections due. Be specific with vehicle names. Under 8 short lines. No headers.'

const pillColor = (state) => (state === 'overdue' ? FLAG_COLORS.red : state === 'due_soon' ? FLAG_COLORS.amber : '#16A34A')

export default function FleetDashboard({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [techs, setTechs] = useState([])
  const [compliance, setCompliance] = useState([])   // [{color:'red'|'amber', label}]
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [d, t, policies, docs, settings, lastMap, odoMap] = await Promise.all([
      dashboardData(org.selectedOrg), listTechnicians(org.selectedOrg),
      listPolicies(org.selectedOrg), listDocuments(org.selectedOrg),
      getSettings(org.selectedOrg), lastInspectionsByVehicle(org.selectedOrg),
      latestOdometersByVehicle(org.selectedOrg),
    ])
    setRows(d); setTechs(t)

    const nameById = {}
    d.forEach((r) => { nameById[r.vehicle.id] = r.vehicle.name })
    const items = []

    // Insurance policies
    policies.forEach((p) => {
      const st = expiryStatus(p.expiration_date, p.due_soon_days)
      if (st.state === 'overdue' || st.state === 'due_soon') {
        const covers = p.scope === 'fleet' ? 'whole fleet' : p.vehicle_ids.map((id) => nameById[id] || 'vehicle').join(', ') || 'listed vehicles'
        items.push({ color: st.state === 'overdue' ? 'red' : 'amber', label: `Insurance ${st.state === 'overdue' ? 'expired' : 'expires soon'} — ${p.carrier || 'policy'} (${covers})` })
      }
    })
    // Legal documents
    docs.forEach((dc) => {
      const st = expiryStatus(dc.expiration_date, dc.due_soon_days)
      if (st.state === 'overdue' || st.state === 'due_soon') {
        const who = dc.vehicle_id ? (nameById[dc.vehicle_id] || 'vehicle') : 'whole fleet'
        items.push({ color: st.state === 'overdue' ? 'red' : 'amber', label: `${docTypeLabel(dc.doc_type)} ${st.state === 'overdue' ? 'expired' : 'expires soon'} — ${who}` })
      }
    })
    // Inspections due (per vehicle)
    d.forEach((r) => {
      const st = inspectionDue(lastMap[r.vehicle.id], settings, odoMap[r.vehicle.id] ?? null)
      if (st.state === 'overdue' || st.state === 'due_soon') {
        const insLabel = st.label.startsWith('No inspection') ? `No inspection yet — ${r.vehicle.name}` : `Inspection ${st.label.toLowerCase()} — ${r.vehicle.name}`
        items.push({ color: st.state === 'overdue' ? 'red' : 'amber', label: insLabel })
      }
    })
    // Red first
    items.sort((a, b) => (a.color === b.color ? 0 : a.color === 'red' ? -1 : 1))
    setCompliance(items)
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg]) // eslint-disable-line react-hooks/exhaustive-deps

  const techName = (id) => techs.find((x) => x.id === id)?.full_name || '—'
  const totalRed = rows.reduce((s, r) => s + r.redFlags, 0)
  const totalAmber = rows.reduce((s, r) => s + r.amberFlags, 0)
  const compRed = compliance.filter((c) => c.color === 'red').length
  const compAmber = compliance.filter((c) => c.color === 'amber').length

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

      <div style={{ marginBottom: 18 }}>
        <AiAssist inline title="Fleet health summary" label="✨ AI: this week's fleet summary"
          system={FLEET_HEALTH_SYS}
          prompt="Summarize the fleet's health this week: which vehicles need attention and why, and what to do first."
          context={{
            vehicles: rows.map((r) => ({ name: r.vehicle.name, odometer: r.latestOdometer, lastMpg: r.lastMpg, redFlags: r.redFlags, amberFlags: r.amberFlags, flags: (r.flags || []).map((f) => f.label) })),
            compliance: compliance.map((c) => c.label),
          }} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 18px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: FLAG_COLORS.red }}>{totalRed + compRed}</div>
          <div style={{ fontSize: 12, color: 'var(--mist)' }}>Red flags — act now</div>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 18px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: FLAG_COLORS.amber }}>{totalAmber + compAmber}</div>
          <div style={{ fontSize: 12, color: 'var(--mist)' }}>Amber flags — worth a look</div>
        </div>
      </div>

      {/* Compliance: insurance, documents, inspections */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: compliance.length ? 10 : 0, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Compliance</h3>
          <span style={{ fontSize: 12, color: 'var(--mist)' }}>
            <Link to="/fleet/insurance">Insurance &amp; Documents</Link> · <Link to="/fleet/inspections">Inspections</Link>
          </span>
        </div>
        {compliance.length === 0 ? (
          <div style={{ color: '#166534', fontWeight: 600, fontSize: 14 }}>All insurance, documents, and inspections are current.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {compliance.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: pillColor(c.color === 'red' ? 'overdue' : 'due_soon'), flex: '0 0 auto' }} />
                <span style={{ fontSize: 14 }}>{c.label}</span>
              </div>
            ))}
          </div>
        )}
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
