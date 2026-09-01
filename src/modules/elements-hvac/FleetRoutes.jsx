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
  const [vehFilter, setVehFilter] = useState('all') // 'all' or a vehicle id — separates the travel logs
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

  // Apply the per-vehicle filter so each truck's log can be read on its own.
  const shownRows = vehFilter === 'all' ? rows : rows.filter((r) => r.vehicle.id === vehFilter)
  const shownDays = vehFilter === 'all' ? days : days.filter((d) => d.vehicle_id === vehFilter)

  // Group the daily routes by vehicle so two (or twenty) trucks don't blur together.
  // Order groups to match the vehicle list; keep each group's days newest-first.
  const orderedVehicles = vehicles.filter((v) => vehFilter === 'all' || v.id === vehFilter)
  const daysByVehicle = orderedVehicles
    .map((v) => ({ vehicle: v, list: shownDays.filter((d) => d.vehicle_id === v.id) }))
    .filter((g) => g.list.length > 0)
  // Any daily rows whose vehicle is no longer in the list (e.g. archived) still get shown.
  const knownIds = new Set(vehicles.map((v) => v.id))
  const orphanDays = shownDays.filter((d) => !knownIds.has(d.vehicle_id))

  const DailyTable = ({ list }) => (
    <table className="data-table">
      <thead><tr><th>Day</th><th style={{ textAlign: 'right' }}>Explained miles</th><th style={{ textAlign: 'right' }}>Jobs</th></tr></thead>
      <tbody>
        {list.map((d) => (
          <tr key={d.id}>
            <td>{d.day}</td>
            <td style={{ textAlign: 'right' }}>{d.explained_miles != null ? Math.round(d.explained_miles).toLocaleString() : '—'}</td>
            <td style={{ textAlign: 'right' }}>{d.job_count ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div>
      <div className="page-header-bar"><h2>Routes &amp; GPS</h2></div>
      <OrgBar {...org} />

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 720 }}>
        Each night, the system reconstructs every truck's day — from its <strong>home base</strong> (the
        tech's driveway, set on the vehicle), out to the job addresses in order, and back home — and computes
        the driving miles the work explains (via your existing Google Maps key). Comparing that to the actual
        odometer change from fuel fills surfaces the honest-use flag: a truck that drove materially more than
        its jobs account for. Only jobs the tech actually left for — where they tapped “On My Way” that day —
        count toward the route, so a job that was merely scheduled, or one left open overnight, no longer
        inflates the miles.
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

      {/* Per-vehicle focus — keeps each truck's travel log readable on its own. */}
      {vehicles.length > 1 && (
        <div className="inline-form" style={{ marginBottom: 16, alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 260, marginBottom: 0 }}>
            <label>Show vehicle</label>
            <select value={vehFilter} onChange={(e) => setVehFilter(e.target.value)}>
              <option value="all">All vehicles (grouped)</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
      )}

      <h3 style={{ marginBottom: 6 }}>Last 30 days — driven vs. explained</h3>
      <table className="data-table" style={{ marginBottom: 24 }}>
        <thead>
          <tr><th>Vehicle</th><th style={{ textAlign: 'right' }}>Driven (odo)</th><th style={{ textAlign: 'right' }}>Explained (jobs)</th><th style={{ textAlign: 'right' }}>Gap</th><th style={{ textAlign: 'right' }}>Breadcrumbs</th><th>Flag</th></tr>
        </thead>
        <tbody>
          {shownRows.map((r) => (
            <tr key={r.vehicle.id}>
              <td>{r.vehicle.name}</td>
              <td style={{ textAlign: 'right' }}>{r.driven != null ? Math.round(r.driven).toLocaleString() : '—'}</td>
              <td style={{ textAlign: 'right' }}>{r.explained != null ? Math.round(r.explained).toLocaleString() : '—'}</td>
              <td style={{ textAlign: 'right' }}>{r.gap != null ? Math.round(r.gap).toLocaleString() : '—'}</td>
              <td style={{ textAlign: 'right' }}>{r.crumbs}</td>
              <td>{r.flag ? <span style={{ background: FLAG_COLORS[r.flag.color], color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>{r.flag.label}</span> : <span style={{ color: '#16A34A' }}>✓</span>}</td>
            </tr>
          ))}
          {shownRows.length === 0 && <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>{loading ? 'Loading…' : 'No vehicles yet.'}</td></tr>}
        </tbody>
      </table>

      <h3 style={{ marginBottom: 6 }}>Recent daily routes</h3>
      {daysByVehicle.length === 0 && orphanDays.length === 0 ? (
        <table className="data-table">
          <tbody><tr><td style={{ color: 'var(--mist)' }}>No routes computed yet — they populate nightly as jobs with addresses are worked.</td></tr></tbody>
        </table>
      ) : (
        <>
          {daysByVehicle.map((g) => (
            <div key={g.vehicle.id} style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 700, color: '#1B3A6B', fontSize: 15, margin: '4px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{g.vehicle.name}</span>
                <span className="badge">{g.list.length} day{g.list.length === 1 ? '' : 's'}</span>
              </div>
              <DailyTable list={g.list} />
            </div>
          ))}
          {orphanDays.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 700, color: '#64748B', fontSize: 15, margin: '4px 0 8px' }}>Other / archived vehicles</div>
              <table className="data-table">
                <thead><tr><th>Day</th><th>Vehicle</th><th style={{ textAlign: 'right' }}>Explained miles</th><th style={{ textAlign: 'right' }}>Jobs</th></tr></thead>
                <tbody>
                  {orphanDays.map((d) => (
                    <tr key={d.id}>
                      <td>{d.day}</td>
                      <td>{vehName(d.vehicle_id)}</td>
                      <td style={{ textAlign: 'right' }}>{d.explained_miles != null ? Math.round(d.explained_miles).toLocaleString() : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{d.job_count ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
