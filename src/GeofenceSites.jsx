// Time Clock · Geofence sites (shop / office locations).
// Define the places a punch is expected to happen. tc_geofence_eval checks each
// clock-in/out against these; a punch outside every active site (beyond its radius
// + the GPS accuracy) is flagged 'offsite' and logged. Until at least one located
// site exists, geofence stays 'unknown' and nothing is flagged — so this is the
// switch that turns the off-site check on. Office/admin only (RLS-enforced).
import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { getPosition } from './utils/deviceId'

const blank = { name: '', address: '', radius_m: 150 }

export default function GeofenceSites({ orgId }) {
  const [open, setOpen] = useState(false)
  const [sites, setSites] = useState([])
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function load() {
    if (!orgId) return
    const { data } = await supabase.from('org_sites').select('*').eq('org_id', orgId).order('created_at')
    setSites(data || [])
  }
  useEffect(() => { load() }, [orgId])

  function toggle() { const n = !open; setOpen(n); if (n && sites.length === 0) load() }

  async function insertSite(latitude, longitude) {
    const { error } = await supabase.from('org_sites').insert({
      org_id: orgId, name: form.name.trim() || 'Shop', latitude, longitude,
      radius_m: parseInt(form.radius_m, 10) || 150,
    })
    if (error) { setErr(error.message); return false }
    setForm(blank); setMsg('Location added — off-site punches will now flag.'); load()
    return true
  }

  async function addFromAddress() {
    setErr(''); setMsg('')
    if (!form.address.trim()) { setErr('Enter an address, or use your current location.'); return }
    setBusy(true)
    try {
      const { data } = await supabase.functions.invoke('geocode-address', { body: { address: form.address.trim() } })
      if (data && data.lat != null && data.lng != null) await insertSite(data.lat, data.lng)
      else setErr('Could not locate that address — check it, or use your current location while standing there.')
    } catch (e) { setErr(e?.message || 'Geocoding failed.') }
    setBusy(false)
  }

  async function addFromHere() {
    setErr(''); setMsg('')
    setBusy(true)
    const pos = await getPosition(10000)
    if (!pos) { setErr('Could not read your location — allow location access, or add by address.'); setBusy(false); return }
    await insertSite(pos.lat, pos.lng)
    setBusy(false)
  }

  async function toggleActive(s) {
    await supabase.from('org_sites').update({ is_active: !s.is_active }).eq('id', s.id)
    load()
  }
  async function remove(s) {
    if (!window.confirm(`Remove "${s.name}"? Punches will no longer be checked against it.`)) return
    await supabase.from('org_sites').delete().eq('id', s.id)
    load()
  }

  const located = sites.filter((s) => s.is_active && s.latitude != null).length

  if (!orgId) return null

  return (
    <div className="section-card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button className="logout-button" onClick={toggle}>{open ? 'Hide locations' : '📍 Job/shop locations (geofence)'}</button>
        <span style={{ fontSize: 12.5, color: located ? '#166534' : '#B0600A', marginLeft: 'auto', fontWeight: 600 }}>
          {located ? `${located} active location${located === 1 ? '' : 's'} · off-site check ON` : 'No locations set · off-site check off'}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: 'var(--mist)', fontSize: 12.5, margin: '0 0 12px' }}>
            Define your shop/office. A clock-in or out beyond a location's radius (plus GPS accuracy) is flagged off-site for review — it never blocks the punch. No locations = the off-site check is off.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
            <div className="field" style={{ marginBottom: 0, minWidth: 140 }}><label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main shop" /></div>
            <div className="field" style={{ marginBottom: 0, minWidth: 240, flex: 1 }}><label>Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, Ocala, FL" /></div>
            <div className="field" style={{ marginBottom: 0, maxWidth: 110 }}><label>Radius (m)</label>
              <input type="number" value={form.radius_m} onChange={(e) => setForm({ ...form, radius_m: e.target.value })} /></div>
            <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={addFromAddress}>{busy ? 'Locating…' : 'Add from address'}</button>
            <button className="logout-button" disabled={busy} onClick={addFromHere} title="Use this device's GPS — handy while standing at the shop">Use my location</button>
          </div>
          {msg && <div style={{ marginBottom: 10, background: '#E3F1E8', border: '1px solid #166534', color: '#166534', padding: '6px 10px', borderRadius: 8, fontSize: 13 }}>{msg}</div>}
          {err && <div className="auth-error" style={{ marginBottom: 10 }}>{err}</div>}

          {sites.length === 0 ? (
            <p style={{ color: 'var(--mist)', fontSize: 13 }}>No locations yet. Add your shop to turn on the off-site check.</p>
          ) : (
            <table className="data-table" style={{ fontSize: 12.5 }}>
              <thead><tr><th>Name</th><th>Coordinates</th><th style={{ textAlign: 'right' }}>Radius</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id} style={!s.is_active ? { opacity: 0.55 } : undefined}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td style={{ color: 'var(--mist)' }}>{s.latitude != null ? `${Number(s.latitude).toFixed(5)}, ${Number(s.longitude).toFixed(5)}` : 'not located'}</td>
                    <td style={{ textAlign: 'right' }}>{s.radius_m} m</td>
                    <td>{s.is_active ? <span style={{ color: '#166534' }}>Active</span> : <span style={{ color: 'var(--mist)' }}>Off</span>}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="logout-button" style={{ padding: '3px 8px', fontSize: 11.5, marginRight: 4 }} onClick={() => toggleActive(s)}>{s.is_active ? 'Disable' : 'Enable'}</button>
                      <button className="logout-button" style={{ padding: '3px 8px', fontSize: 11.5 }} onClick={() => remove(s)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
