import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// Geocode server-side (edge function: Census -> OpenStreetMap). Avoids browser CORS.
async function geocodeAddress(address) {
  try {
    const { data } = await supabase.functions.invoke('geocode-address', { body: { address } })
    if (data && data.lat != null && data.lng != null) return { lat: data.lat, lng: data.lng }
  } catch { /* ignore */ }
  return null
}

const WLABEL = { '8_11': '8–11 AM', '10_1': '10 AM–1 PM', '12_3': '12–3 PM', '2_5': '2–5 PM', 'asap': 'ASAP' }
const NO_TERR = '#94A3B8'
// Distinct default colors so two territories never come out the same by accident.
const TERR_PALETTE = ['#2F5DE3', '#C0392B', '#1F8A4C', '#B7791F', '#7C3AED', '#0E8A6E', '#D0567F', '#E67E22', '#2C7BE5', '#8E44AD']
// 2-digit state FIPS -> abbreviation (for county labels)
const ST = { '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY','72':'PR' }

const jobColor = (j) =>
  j.date_pending ? '#DC2626'
  : j.status === 'completed' ? '#9CA3AF'
  : j.status === 'incomplete' ? '#DC2626'
  : (j.color || '#DC2626')

function todayLocal() {
  const d = new Date(); const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}
// meters between two lat/lng (haversine) — only used for nearest-tech comparison
function distM(aLat, aLng, bLat, bLng) {
  const R = 6371000, toR = Math.PI / 180
  const dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export default function DispatchMap({ profile }) {
  const nav = useNavigate()
  const isSuper = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [date, setDate] = useState(() => new URLSearchParams(window.location.search).get('date') || todayLocal())
  const [jobs, setJobs] = useState([])
  const [techs, setTechs] = useState([])
  const [pending, setPending] = useState([])
  const [showUnscheduled, setShowUnscheduled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)

  // Territory state
  const [territories, setTerritories] = useState([])
  const [users, setUsers] = useState([])
  const [colorBy, setColorBy] = useState('tech')     // 'tech' | 'territory'
  const [showZones, setShowZones] = useState(true)
  const [manageOpen, setManageOpen] = useState(false)
  const [tEditId, setTEditId] = useState(null)
  const [tName, setTName] = useState('')
  const [tColor, setTColor] = useState('#2F5DE3')
  const [tZips, setTZips] = useState('')
  const [tTechs, setTTechs] = useState([])
  const [tCounties, setTCounties] = useState([])
  const [tSaving, setTSaving] = useState(false)
  const [terrGeo, setTerrGeo] = useState({})       // territoryId -> parsed GeoJSON geometry
  const [allCounties, setAllCounties] = useState([]) // {fips,name,state_fips} for the picker
  const [countyQuery, setCountyQuery] = useState('')

  useEffect(() => {
    if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
  }, [isSuper])

  // Initialize Leaflet once it's available.
  useEffect(() => {
    let tries = 0
    function tryInit() {
      if (mapRef.current) return
      if (!window.L || !containerRef.current) { if (tries++ < 50) setTimeout(tryInit, 100); return }
      const map = window.L.map(containerRef.current).setView([29.187, -82.14], 10)
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map)
      layerRef.current = window.L.layerGroup().addTo(map)
      mapRef.current = map
      setMapReady(true)
      setTimeout(() => map.invalidateSize(), 250)
    }
    tryInit()
  }, [])

  // Territories + users for this org.
  useEffect(() => {
    if (!selectedOrg) return
    supabase.from('dispatch_territories').select('*').eq('org_id', selectedOrg).eq('is_active', true).order('name').then(({ data }) => setTerritories(data || []))
    supabase.from('users').select('id, full_name, calendar_color').eq('org_id', selectedOrg).eq('is_active', true).order('full_name').then(({ data }) => setUsers(data || []))
  }, [selectedOrg])

  async function loadTerritories() {
    const { data } = await supabase.from('dispatch_territories').select('*').eq('org_id', selectedOrg).eq('is_active', true).order('name')
    setTerritories(data || [])
  }

  // Real boundary shapes (merged ZIP + county polygons) for each territory.
  useEffect(() => {
    if (!territories.length) { setTerrGeo({}); return }
    let cancelled = false
    ;(async () => {
      const out = {}
      for (const t of territories) {
        if (!(t.zips || []).length && !(t.counties || []).length) continue
        const { data } = await supabase.rpc('territory_boundary', { p_zips: t.zips || [], p_counties: t.counties || [] })
        if (data) { try { out[t.id] = JSON.parse(data) } catch { /* ignore */ } }
      }
      if (!cancelled) setTerrGeo(out)
    })()
    return () => { cancelled = true }
  }, [territories])

  // County list for the picker (loaded once when the manager first opens).
  useEffect(() => {
    if (!manageOpen) return
    if (!tEditId) setTColor(nextColor())   // fresh distinct color when opening a new-territory form
    if (allCounties.length) return
    supabase.from('county_boundaries').select('fips, name, state_fips').order('name').then(({ data }) => setAllCounties(data || []))
  }, [manageOpen])

  async function load() {
    if (!selectedOrg) return
    setLoading(true); setNote('')
    const { data } = await supabase.from('jobs')
      .select('id, job_number, start_time, status, date_pending, job_type, property_id, job_technicians(sort_order, users(full_name, calendar_color)), properties(id, street_address, unit, city, state, zip, latitude, longitude, customers!properties_customer_id_fkey(display_name))')
      .eq('org_id', selectedOrg).eq('job_date', date).is('deleted_at', null).neq('status', 'cancelled')
    const rows = (data || []).map((j) => {
      const t = (j.job_technicians || []).slice().sort((a, b) => a.sort_order - b.sort_order)
      return {
        id: j.id, status: j.status, date_pending: j.date_pending, job_type: j.job_type, property_id: j.property_id,
        customer_name: j.properties?.customers?.display_name || 'Customer',
        address: [j.properties?.street_address, j.properties?.city].filter(Boolean).join(', '),
        fullAddress: [j.properties?.street_address, j.properties?.unit, j.properties?.city, j.properties?.state, j.properties?.zip].filter(Boolean).join(' '),
        zip: (j.properties?.zip || '').toString().slice(0, 5),
        lat: j.properties?.latitude, lng: j.properties?.longitude,
        tech_name: t.length ? t.map((x) => x.users?.full_name).join(', ') : 'Unassigned',
        assigned: t.length > 0,
        color: t[0]?.users?.calendar_color || null,
        time: j.start_time ? new Date(j.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
      }
    })
    for (const j of rows) {
      if ((j.lat == null || j.lng == null) && j.fullAddress) {
        const g = await geocodeAddress(j.fullAddress)
        if (g) { j.lat = g.lat; j.lng = g.lng; supabase.from('properties').update({ latitude: g.lat, longitude: g.lng }).eq('id', j.property_id).then(() => {}) }
      }
    }
    setJobs(rows)
    const cutoff = new Date(Date.now() - 2 * 3600000).toISOString()
    const { data: tl } = await supabase.from('tech_locations')
      .select('user_id, latitude, longitude, updated_at, users(full_name, calendar_color)')
      .eq('org_id', selectedOrg).gte('updated_at', cutoff)
    setTechs((tl || []).filter((t) => t.latitude != null))

    const { data: pend } = await supabase.from('jobs')
      .select('id, job_date, requested_window, job_type, self_booked, property_id, properties(id, street_address, unit, city, state, zip, latitude, longitude, customers!properties_customer_id_fkey(display_name))')
      .eq('org_id', selectedOrg).eq('date_pending', true).is('deleted_at', null).neq('status', 'cancelled')
    const prows = (pend || []).map((j) => ({
      id: j.id, job_date: j.job_date, requested_window: j.requested_window, job_type: j.job_type, self_booked: j.self_booked, property_id: j.property_id,
      customer_name: j.properties?.customers?.display_name || 'Customer',
      address: [j.properties?.street_address, j.properties?.city].filter(Boolean).join(', '),
      fullAddress: [j.properties?.street_address, j.properties?.unit, j.properties?.city, j.properties?.state, j.properties?.zip].filter(Boolean).join(' '),
      zip: (j.properties?.zip || '').toString().slice(0, 5),
      lat: j.properties?.latitude, lng: j.properties?.longitude, assigned: false,
    }))
    for (const j of prows) {
      if ((j.lat == null || j.lng == null) && j.fullAddress) {
        const g = await geocodeAddress(j.fullAddress)
        if (g) { j.lat = g.lat; j.lng = g.lng; supabase.from('properties').update({ latitude: g.lat, longitude: g.lng }).eq('id', j.property_id).then(() => {}) }
      }
    }
    setPending(prows)

    const missing = rows.filter((r) => r.lat == null).length
    setNote(missing ? `${missing} job(s) couldn't be pinned (address didn't geocode).` : '')
    setLoading(false)
  }

  useEffect(() => { load() }, [selectedOrg, date])

  const userName = (id) => users.find((u) => u.id === id)?.full_name || 'tech'
  const terrForZip = (zip) => zip ? territories.find((t) => (t.zips || []).includes(zip)) : null
  // Suggested tech for an unassigned job: the job's territory tech; if the
  // territory has several, the closest one that has a live location.
  function suggestTech(job) {
    const t = terrForZip(job.zip)
    const ids = t?.tech_user_ids || []
    if (!ids.length) return null
    if (ids.length === 1) return userName(ids[0])
    if (job.lat != null) {
      let best = null, bd = Infinity
      ids.forEach((id) => {
        const loc = techs.find((x) => x.user_id === id)
        if (loc && loc.latitude != null) { const d = distM(job.lat, job.lng, loc.latitude, loc.longitude); if (d < bd) { bd = d; best = id } }
      })
      if (best) return `${userName(best)} (closest of ${ids.length})`
    }
    return `${userName(ids[0])} (+${ids.length - 1})`
  }

  // Draw zones + markers whenever data/toggles change.
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current
    if (!map || !layer || !window.L) return
    layer.clearLayers()

    // Territory zones (drawn first, under the markers) — a translucent circle
    // covering each territory's plotted jobs today.
    if (showZones) {
      const allPts = [...jobs, ...(showUnscheduled ? pending : [])].filter((x) => x.lat != null)
      for (const t of territories) {
        const gj = terrGeo[t.id]
        if (gj) {
          // Real merged ZIP/county boundary.
          window.L.geoJSON(gj, { style: { color: t.color, weight: 2, opacity: 0.75, fillColor: t.color, fillOpacity: 0.14 } })
            .addTo(layer).bindTooltip(t.name, { sticky: true })
          continue
        }
        // Fallback (area not loaded yet): a soft circle around the territory's jobs.
        const pts = allPts.filter((x) => terrForZip(x.zip)?.id === t.id)
        if (!pts.length) continue
        const cLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
        const cLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length
        let r = 800
        pts.forEach((p) => { r = Math.max(r, distM(cLat, cLng, p.lat, p.lng) + 500) })
        window.L.circle([cLat, cLng], { radius: r, color: t.color, weight: 1.5, opacity: 0.55, fillColor: t.color, fillOpacity: 0.10, dashArray: '5,5' })
          .addTo(layer).bindTooltip(t.name + ' (approx — shapes not loaded for this area)', { direction: 'top' })
      }
    }

    const items = []
    for (const j of jobs) {
      if (j.date_pending) continue
      if (j.lat == null || j.lng == null) continue
      const terr = terrForZip(j.zip)
      const color = colorBy === 'territory' ? (terr?.color || NO_TERR) : jobColor(j)
      const sugg = !j.assigned ? suggestTech(j) : null
      items.push({
        lat: j.lat, lng: j.lng, iconSize: [22, 22], iconAnchor: [11, 11],
        html: `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
        popup: `<strong>${j.customer_name}</strong><br>${j.time ? j.time + ' &middot; ' : ''}${j.job_type || ''}<br>${j.address || ''}<br>Tech: ${j.tech_name}${sugg ? `<br><b>Suggested:</b> ${sugg}` : ''}${terr ? `<br><span style="color:${terr.color}">●</span> ${terr.name}` : ''}<br><em>${j.status || ''}</em>`,
      })
    }
    if (showUnscheduled) {
      for (const p of pending) {
        if (p.lat == null || p.lng == null) continue
        const when = p.job_date ? new Date(p.job_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
        const win = WLABEL[p.requested_window] || ''
        const terr = terrForZip(p.zip)
        const sugg = suggestTech(p)
        items.push({
          lat: p.lat, lng: p.lng, iconSize: [22, 22], iconAnchor: [11, 11],
          html: `<div style="background:#DC2626;width:16px;height:16px;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.55);transform:rotate(45deg)"></div>`,
          popup: `<strong>⏳ ${p.customer_name}</strong><br>Needs dispatch${p.self_booked ? ' (portal booking)' : ''}<br>${win}${win && when ? ' &middot; ' : ''}${when}<br>${p.job_type || ''}<br>${p.address || ''}${sugg ? `<br><b>Suggested:</b> ${sugg}` : ''}${terr ? `<br><span style="color:${terr.color}">●</span> ${terr.name}` : ''}`,
        })
      }
    }
    for (const t of techs) {
      const color = t.users?.calendar_color || '#1f7a43'
      const initial = (t.users?.full_name || '?').slice(0, 1).toUpperCase()
      const ago = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 60000)
      items.push({
        lat: t.latitude, lng: t.longitude, iconSize: [28, 28], iconAnchor: [14, 26],
        html: `<div style="background:${color};width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font-size:13px;font-weight:800">${initial}</span></div>`,
        popup: `<strong>${t.users?.full_name || 'Technician'}</strong><br>Updated ${ago} min ago`,
      })
    }

    const groups = {}
    for (const m of items) {
      const key = `${m.lat.toFixed(5)},${m.lng.toFixed(5)}`
      ;(groups[key] || (groups[key] = [])).push(m)
    }
    const R = 0.00011
    for (const key in groups) {
      const g = groups[key]
      if (g.length < 2) continue
      g.forEach((m, i) => {
        const ang = (2 * Math.PI * i) / g.length
        m.dlat = m.lat + R * Math.cos(ang)
        m.dlng = m.lng + (R * Math.sin(ang)) / Math.cos((m.lat * Math.PI) / 180)
      })
    }

    const pts = []
    for (const m of items) {
      const icon = window.L.divIcon({ className: '', iconSize: m.iconSize, iconAnchor: m.iconAnchor, html: m.html })
      window.L.marker([m.dlat ?? m.lat, m.dlng ?? m.lng], { icon }).addTo(layer).bindPopup(m.popup)
      pts.push([m.lat, m.lng])
    }
    if (pts.length) { try { map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }) } catch { /* single/empty */ } }
  }, [jobs, techs, pending, showUnscheduled, mapReady, territories, colorBy, showZones, terrGeo])

  // ---- territory manager ----
  const nextColor = () => TERR_PALETTE.find((c) => !territories.some((t) => (t.color || '').toLowerCase() === c.toLowerCase())) || TERR_PALETTE[territories.length % TERR_PALETTE.length]
  function newTerr() { setTEditId(null); setTName(''); setTColor(nextColor()); setTZips(''); setTTechs([]); setTCounties([]); setCountyQuery('') }
  function editTerr(t) { setTEditId(t.id); setTName(t.name || ''); setTColor(t.color || '#2F5DE3'); setTZips((t.zips || []).join(', ')); setTTechs(t.tech_user_ids || []); setTCounties(t.counties || []); setCountyQuery(''); setManageOpen(true) }
  function toggleTech(id) { setTTechs((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) }
  function toggleCounty(fips) { setTCounties((cur) => cur.includes(fips) ? cur.filter((x) => x !== fips) : [...cur, fips]) }
  const countyLabel = (fips) => { const c = allCounties.find((x) => x.fips === fips); return c ? `${c.name}, ${ST[c.state_fips] || c.state_fips}` : fips }
  async function saveTerr() {
    if (!tName.trim() || !selectedOrg) return
    const zips = [...new Set(tZips.split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^\d{5}$/.test(s)))]
    setTSaving(true)
    const payload = { name: tName.trim(), color: tColor, zips, tech_user_ids: tTechs, counties: tCounties }
    let err
    if (tEditId) ({ error: err } = await supabase.from('dispatch_territories').update(payload).eq('id', tEditId))
    else ({ error: err } = await supabase.from('dispatch_territories').insert({ ...payload, org_id: selectedOrg, created_by: profile.id }))
    setTSaving(false)
    if (!err) { newTerr(); loadTerritories() }
  }
  async function deleteTerr(id) {
    if (!window.confirm('Delete this territory?')) return
    await supabase.from('dispatch_territories').update({ is_active: false }).eq('id', id)
    if (tEditId === id) newTerr()
    loadTerritories()
  }

  const seg = (active) => ({ border: 'none', cursor: 'pointer', padding: '7px 12px', fontSize: 13, fontWeight: active ? 700 : 500, background: active ? '#176E7A' : 'transparent', color: active ? '#fff' : 'var(--mist)' })

  return (
    <div>
      <div className="page-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Dispatch Map</h2>
        <button onClick={() => setManageOpen((o) => !o)} disabled={!selectedOrg} style={{ border: '1px solid var(--border)', background: manageOpen ? '#EAF3F4' : '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#176E7A' }}>Manage territories</button>
      </div>
      {isSuper && (
        <div style={{ marginBottom: 12, maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {manageOpen && (
        <div className="section-card" style={{ padding: 16, marginBottom: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Territories</div>
              {territories.length === 0 && <p style={{ color: 'var(--mist)', fontSize: 13, margin: '0 0 8px' }}>No territories yet. Add one on the right — a name, a color, the ZIP codes it covers, and the tech(s) who own it.</p>}
              {territories.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: t.color, flex: '0 0 auto' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--mist)' }}>{(t.zips || []).length} ZIP{(t.zips || []).length === 1 ? '' : 's'}{(t.counties || []).length ? ` · ${(t.counties || []).length} county${(t.counties || []).length === 1 ? '' : 'ies'}` : ''} · {(t.tech_user_ids || []).map(userName).join(', ') || 'no tech'}</div>
                  </div>
                  <button onClick={() => editTerr(t)} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12.5, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => deleteTerr(t.id)} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12.5, cursor: 'pointer', color: '#B5462F' }}>Delete</button>
                </div>
              ))}
            </div>
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>{tEditId ? 'Edit territory' : 'New territory'}</div>
                {tEditId && <button onClick={newTerr} style={{ border: 'none', background: 'none', color: '#176E7A', fontSize: 12.5, cursor: 'pointer' }}>+ New</button>}
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <label style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>Name</span>
                  <input value={tName} onChange={(e) => setTName(e.target.value)} placeholder="e.g. Northwest / The Villages" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, boxSizing: 'border-box' }} /></label>
                <label><span style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>Color</span>
                  <input type="color" value={tColor} onChange={(e) => setTColor(e.target.value)} style={{ width: 44, height: 38, border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer' }} /></label>
              </div>
              <label style={{ display: 'block', marginBottom: 10 }}><span style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>ZIP codes (comma or space separated)</span>
                <textarea value={tZips} onChange={(e) => setTZips(e.target.value)} rows={2} placeholder="34470, 34471, 34482" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, boxSizing: 'border-box', resize: 'vertical' }} /></label>
              <div style={{ marginBottom: 10 }}>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>Whole counties (optional — ZIPs are usually finer-grained)</span>
                {tCounties.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    {tCounties.map((f) => (
                      <button key={f} type="button" onClick={() => toggleCounty(f)} style={{ border: '1px solid #176E7A', borderRadius: 20, padding: '4px 10px', fontSize: 12, cursor: 'pointer', background: '#176E7A', color: '#fff' }}>{countyLabel(f)} ✕</button>
                    ))}
                  </div>
                )}
                <input value={countyQuery} onChange={(e) => setCountyQuery(e.target.value)} placeholder="Search a county to add…" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, boxSizing: 'border-box' }} />
                {countyQuery.trim().length >= 2 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {allCounties.filter((c) => !tCounties.includes(c.fips) && `${c.name} ${ST[c.state_fips] || ''}`.toLowerCase().includes(countyQuery.trim().toLowerCase())).slice(0, 10).map((c) => (
                      <button key={c.fips} type="button" onClick={() => { toggleCounty(c.fips); setCountyQuery('') }} style={{ border: '1px solid var(--border)', borderRadius: 20, padding: '4px 10px', fontSize: 12, cursor: 'pointer', background: '#fff' }}>+ {c.name}, {ST[c.state_fips] || c.state_fips}</button>
                    ))}
                    {allCounties.length === 0 && <span style={{ fontSize: 12, color: 'var(--mist)' }}>Loading counties…</span>}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>Assigned tech(s)</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {users.map((u) => (
                    <button key={u.id} type="button" onClick={() => toggleTech(u.id)} style={{ border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', fontSize: 12.5, cursor: 'pointer', background: tTechs.includes(u.id) ? '#176E7A' : '#fff', color: tTechs.includes(u.id) ? '#fff' : 'var(--ink)' }}>{u.full_name}</button>
                  ))}
                  {users.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>No active users.</span>}
                </div>
              </div>
              <button className="auth-button" disabled={tSaving || !tName.trim()} onClick={saveTerr} style={{ width: 'auto', margin: 0, padding: '9px 20px' }}>{tSaving ? 'Saving…' : tEditId ? 'Save territory' : 'Add territory'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="logout-button" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <button type="button" title="Calendar view" onClick={() => nav('/calendar?date=' + date)} style={{ border: 'none', width: 42, height: 34, fontSize: 16, cursor: 'pointer', background: '#fff', filter: 'grayscale(1)' }}>🗓</button>
          <button type="button" title="Map view" style={{ border: 'none', width: 42, height: 34, fontSize: 16, cursor: 'default', background: '#176E7A' }}>📍</button>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--mist)' }}>Color by:
          <span style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setColorBy('tech')} style={seg(colorBy === 'tech')}>Tech</button>
            <button onClick={() => setColorBy('territory')} style={seg(colorBy === 'territory')}>Territory</button>
          </span>
        </span>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} /> Territory zones
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showUnscheduled} onChange={(e) => setShowUnscheduled(e.target.checked)} />
          Unscheduled bookings{pending.length ? ` (${pending.length})` : ''}
        </label>
        <span style={{ fontSize: 13, color: 'var(--mist)' }}>{jobs.length} jobs &middot; {techs.length} techs on map</span>
        {note && <span style={{ fontSize: 13, color: '#b0342f' }}>{note}</span>}
      </div>
      <div ref={containerRef} style={{ height: 'calc(100vh - 250px)', minHeight: 420, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: '#e8edf1' }} />
      <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--mist)' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#DC2626', border: '2px solid #fff', verticalAlign: 'middle', marginRight: 5 }} />Unassigned / needs attention</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#9CA3AF', border: '2px solid #fff', verticalAlign: 'middle', marginRight: 5 }} />Completed</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#2F5DE3', border: '2px solid #fff', verticalAlign: 'middle', marginRight: 5 }} />{colorBy === 'territory' ? 'Colored by territory' : 'Assigned (tech color)'}</span>
        <span><span style={{ display: 'inline-block', width: 11, height: 11, background: '#DC2626', border: '2px solid #fff', transform: 'rotate(45deg)', verticalAlign: 'middle', marginRight: 6 }} />Unscheduled booking (any date)</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#1f7a43', border: '2px solid #fff', transform: 'rotate(-45deg)', borderRadius: '50% 50% 50% 0', verticalAlign: 'middle', marginRight: 6 }} />Technician</span>
      </div>
      {territories.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--mist)' }}>
          {territories.map((t) => (
            <span key={t.id}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: t.color, verticalAlign: 'middle', marginRight: 5 }} />{t.name}{(t.tech_user_ids || []).length ? ` — ${(t.tech_user_ids || []).map(userName).join(', ')}` : ''}</span>
          ))}
        </div>
      )}
    </div>
  )
}
