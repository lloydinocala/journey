// Elements-HVAC · Fleet · Routes & GPS (miles-driven vs miles-explained)
import { useState, useEffect } from 'react'
import { routeAnalysis, listRouteDays, listVehicles, FLAG_COLORS } from './fleetData'
import { getSettings, upsertSettings } from './data'
import { useOrgSelector, OrgBar } from './shared'

export default function FleetRoutes({ profile }) {
  const org = useOrgSelector(profile)
  const [rows, setRows] = useState([])
  const [days, setDays] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [shop, setShop] = useState('')
  const [savedShop, setSavedShop] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const since = new Date(); since.setDate(since.getDate() - 30)
    const [an, rd, v, s] = await Promise.all([
      routeAnalysis(org.selectedOrg, 30),
      listRouteDays(org.selectedOrg, since.toISOString().slice(0, 10)),
      listVehicles(org.selectedOrg),
      getSettings(org.selectedOrg),
    ])
    setRows(an); setDays(rd); setVehicles(v)
    setShop(s?.shop_address || ''); setSavedShop(s?.shop_address || '')
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const vehName = (id) => vehicles.find((v) => v.id === id)?.name || '—'

  async function saveShop() {
    setMsg('')
    const { error } = await upsertSettings(org.selectedOrg, { shop_address: shop.trim() || null })
    setMsg(error ? error.message : 'Shop address saved.')
    setSavedShop(shop.trim())
  }

  return (
    <div>
      <div className="page-header-bar"><h2>Routes &amp; GPS</h2></div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 720 }}>
        Each night, the system reconstructs every truck's day — from its <strong>home base</strong> (the
        tech's driveway, set on the vehicle), out to the job addresses in order, and back home — and computes
        the driving miles the work explains (via your existing Google Maps key). Comparing that to the actual
        odometer change from fuel fills surfaces the honest-use flag: a truck that drove materially more than
        its jobs account for. GPS breadcrumbs are captured whenever a tech taps “On My Way.”
      </p>

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
        The route anchor is each truck's <strong>home base</strong> — set it per vehicle on the Vehicles page.
        Set a shop address below only if your crews actually start and end the day at the shop; otherwise leave
        it blank and home base is used.
      </p>
      <div className="inline-form" style={{ marginBottom: 18, alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: 320, marginBottom: 0 }}>
          <label>Shop address (optional fallback anchor)</label>
          <input type="text" value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Only if crews start at the shop" />
        </div>
        <button className="auth-button" style={{ width: 'auto' }} disabled={shop.trim() === savedShop} onClick={saveShop}>Save</button>
        {msg && <span style={{ color: msg.includes('saved') ? '#166534' : '#B00020', marginLeft: 8 }}>{msg}</span>}
      </div>

      <h3 style={{ marginBottom: 6 }}>Last 30 days — driven vs. explained</h3>
      <table className="data-table" style={{ marginBottom: 24 }}>
        <thead>
          <tr><th>Vehicle</th><th style={{ textAlign: 'right' }}>Driven (odo)</th><th style={{ textAlign: 'right' }}>Explained (jobs)</th><th style={{ textAlign: 'right' }}>Gap</th><th style={{ textAlign: 'right' }}>Breadcrumbs</th><th>Flag</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.vehicle.id}>
              <td>{r.vehicle.name}</td>
              <td style={{ textAlign: 'right' }}>{r.driven != null ? Math.round(r.driven).toLocaleString() : '—'}</td>
              <td style={{ textAlign: 'right' }}>{r.explained != null ? Math.round(r.explained).toLocaleString() : '—'}</td>
              <td style={{ textAlign: 'right' }}>{r.gap != null ? Math.round(r.gap).toLocaleString() : '—'}</td>
              <td style={{ textAlign: 'right' }}>{r.crumbs}</td>
              <td>{r.flag ? <span style={{ background: FLAG_COLORS[r.flag.color], color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>{r.flag.label}</span> : <span style={{ color: '#16A34A' }}>✓</span>}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>{loading ? 'Loading…' : 'No vehicles yet.'}</td></tr>}
        </tbody>
      </table>

      <h3 style={{ marginBottom: 6 }}>Recent daily routes</h3>
      <table className="data-table">
        <thead><tr><th>Day</th><th>Vehicle</th><th style={{ textAlign: 'right' }}>Explained miles</th><th style={{ textAlign: 'right' }}>Jobs</th></tr></thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.id}>
              <td>{d.day}</td>
              <td>{vehName(d.vehicle_id)}</td>
              <td style={{ textAlign: 'right' }}>{d.explained_miles != null ? Math.round(d.explained_miles).toLocaleString() : '—'}</td>
              <td style={{ textAlign: 'right' }}>{d.job_count ?? '—'}</td>
            </tr>
          ))}
          {days.length === 0 && <tr><td colSpan="4" style={{ color: 'var(--mist)' }}>No routes computed yet — they populate nightly as jobs with addresses are worked.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
