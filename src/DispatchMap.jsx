import { useState, useEffect, useRef } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// Keyless US Census geocoder (CORS-enabled) — same path the tech/job cards use.
async function geocodeAddress(address) {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`
    const r = await fetch(url)
    if (r.ok) {
      const j = await r.json()
      const c = j?.result?.addressMatches?.[0]?.coordinates
      if (c && typeof c.y === 'number' && typeof c.x === 'number') return { lat: c.y, lng: c.x }
    }
  } catch { /* ignore */ }
  return null
}

const jobColor = (j) =>
  j.date_pending ? '#DC2626'
  : j.status === 'completed' ? '#9CA3AF'
  : j.status === 'incomplete' ? '#DC2626'
  : (j.color || '#DC2626')

function todayLocal() {
  const d = new Date(); const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

export default function DispatchMap({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [date, setDate] = useState(todayLocal())
  const [jobs, setJobs] = useState([])
  const [techs, setTechs] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)

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
        lat: j.properties?.latitude, lng: j.properties?.longitude,
        tech_name: t.length ? t.map((x) => x.users?.full_name).join(', ') : 'Unassigned',
        color: t[0]?.users?.calendar_color || null,
        time: j.start_time ? new Date(j.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
      }
    })
    // Geocode + cache any property without coordinates.
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
    const missing = rows.filter((r) => r.lat == null).length
    setNote(missing ? `${missing} job(s) couldn't be pinned (address didn't geocode).` : '')
    setLoading(false)
  }

  useEffect(() => { load() }, [selectedOrg, date])

  // Draw markers whenever data or the map changes.
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current
    if (!map || !layer || !window.L) return
    layer.clearLayers()
    const pts = []
    for (const j of jobs) {
      if (j.lat == null || j.lng == null) continue
      const color = jobColor(j)
      const icon = window.L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10], html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>` })
      window.L.marker([j.lat, j.lng], { icon }).addTo(layer)
        .bindPopup(`<strong>${j.customer_name}</strong><br>${j.time ? j.time + ' &middot; ' : ''}${j.job_type || ''}<br>${j.address || ''}<br>Tech: ${j.tech_name}<br><em>${j.date_pending ? 'Needs dispatch' : (j.status || '')}</em>`)
      pts.push([j.lat, j.lng])
    }
    for (const t of techs) {
      const color = t.users?.calendar_color || '#1f7a43'
      const initial = (t.users?.full_name || '?').slice(0, 1).toUpperCase()
      const icon = window.L.divIcon({ className: '', iconSize: [28, 28], iconAnchor: [14, 26], html: `<div style="background:${color};width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font-size:13px;font-weight:800">${initial}</span></div>` })
      const ago = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 60000)
      window.L.marker([t.latitude, t.longitude], { icon }).addTo(layer)
        .bindPopup(`<strong>${t.users?.full_name || 'Technician'}</strong><br>Updated ${ago} min ago`)
      pts.push([t.latitude, t.longitude])
    }
    if (pts.length) { try { map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }) } catch { /* single/empty */ } }
  }, [jobs, techs, mapReady])

  return (
    <div>
      <div className="page-header-bar"><h2>Dispatch Map</h2></div>
      {isSuper && (
        <div style={{ marginBottom: 12, maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="logout-button" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        <span style={{ fontSize: 13, color: 'var(--mist)' }}>{jobs.length} jobs &middot; {techs.length} techs on map</span>
        {note && <span style={{ fontSize: 13, color: '#b0342f' }}>{note}</span>}
      </div>
      <div ref={containerRef} style={{ height: 'calc(100vh - 250px)', minHeight: 420, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: '#e8edf1' }} />
      <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--mist)' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#DC2626', border: '2px solid #fff', verticalAlign: 'middle', marginRight: 5 }} />Unassigned / needs attention</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#9CA3AF', border: '2px solid #fff', verticalAlign: 'middle', marginRight: 5 }} />Completed</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#2F5DE3', border: '2px solid #fff', verticalAlign: 'middle', marginRight: 5 }} />Assigned (tech color)</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#1f7a43', border: '2px solid #fff', transform: 'rotate(-45deg)', borderRadius: '50% 50% 50% 0', verticalAlign: 'middle', marginRight: 6 }} />Technician</span>
      </div>
    </div>
  )
}
