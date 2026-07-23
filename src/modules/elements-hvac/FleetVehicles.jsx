// Elements-HVAC · Fleet · Vehicles (linked to inventory trucks)
import { useState, useEffect } from 'react'
import { listVehicles, addVehicle, updateVehicle, listTrucks } from './fleetData'
import { listTechnicians } from './data'
import { useOrgSelector, OrgBar } from './shared'

const blank = {
  location_id: '', name: '', assigned_user_id: '', home_address: '', year: '', make: '', model: '',
  vin: '', license_plate: '', color: '', tank_capacity_gal: '',
  expected_mpg_low: '', expected_mpg_high: '', status: 'active',
}

export default function FleetVehicles({ profile }) {
  const org = useOrgSelector(profile)
  const [vehicles, setVehicles] = useState([])
  const [trucks, setTrucks] = useState([])
  const [techs, setTechs] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const [v, t, tech] = await Promise.all([
      listVehicles(org.selectedOrg, { includeInactive: showArchived }),
      listTrucks(org.selectedOrg),
      listTechnicians(org.selectedOrg),
    ])
    setVehicles(v); setTrucks(t); setTechs(tech)
  }
  useEffect(() => { load() }, [org.selectedOrg, showArchived])

  const techName = (id) => techs.find((x) => x.id === id)?.full_name || '—'
  const truckName = (id) => trucks.find((x) => x.id === id)?.name || '—'

  // Picking a truck auto-fills name + assigned tech
  function pickTruck(id) {
    const tk = trucks.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      location_id: id,
      name: f.name || tk?.name || '',
      assigned_user_id: f.assigned_user_id || tk?.assigned_user_id || '',
    }))
  }

  function startEdit(v) {
    setEditingId(v.id)
    setForm({
      location_id: v.location_id || '', name: v.name || '', assigned_user_id: v.assigned_user_id || '',
      home_address: v.home_address || '',
      year: v.year ?? '', make: v.make || '', model: v.model || '', vin: v.vin || '',
      license_plate: v.license_plate || '', color: v.color || '',
      tank_capacity_gal: v.tank_capacity_gal ?? '', expected_mpg_low: v.expected_mpg_low ?? '',
      expected_mpg_high: v.expected_mpg_high ?? '', status: v.status || 'active',
    })
    setShowForm(true); setError('')
  }
  function startNew() { setEditingId(null); setForm(blank); setShowForm(true); setError('') }
  function cancelForm() { setEditingId(null); setForm(blank); setShowForm(false); setError('') }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    const num = (x) => (x === '' || x == null ? null : Number(x))
    const payload = {
      location_id: form.location_id || null,
      name: form.name.trim(),
      assigned_user_id: form.assigned_user_id || null,
      home_address: form.home_address.trim() || null,
      year: num(form.year), make: form.make.trim() || null, model: form.model.trim() || null,
      vin: form.vin.trim() || null, license_plate: form.license_plate.trim() || null, color: form.color.trim() || null,
      tank_capacity_gal: num(form.tank_capacity_gal),
      expected_mpg_low: num(form.expected_mpg_low), expected_mpg_high: num(form.expected_mpg_high),
      status: form.status,
    }
    const { error: err } = editingId
      ? await updateVehicle(editingId, payload)
      : await addVehicle(org.selectedOrg, payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    cancelForm(); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Fleet Vehicles</h2>
          <span className="badge">{vehicles.length} shown</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => (showForm ? cancelForm() : startNew())}>
          {showForm ? 'Cancel' : '+ New Vehicle'}
        </button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form className="inline-form" onSubmit={handleSubmit} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          {editingId && <div style={{ flexBasis: '100%', fontWeight: 700, color: '#1B3A6B' }}>Editing {form.name || 'vehicle'}</div>}
          <div className="field" style={{ minWidth: 200 }}>
            <label>Linked truck (inventory)</label>
            <select value={form.location_id} onChange={(e) => pickTruck(e.target.value)}>
              <option value="">— none / standalone —</option>
              {trucks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Name</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Truck 12" required /></div>
          <div className="field" style={{ minWidth: 180 }}>
            <label>Assigned technician</label>
            <select value={form.assigned_user_id} onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })}>
              <option value="">— unassigned —</option>
              {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 240 }}>
            <label>Home base (garage / driveway)</label>
            <input type="text" value={form.home_address} onChange={(e) => setForm({ ...form, home_address: e.target.value })} placeholder="Tech's home — the daily route anchor" />
          </div>
          <div className="field" style={{ width: 80 }}><label>Year</label><input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
          <div className="field" style={{ width: 120 }}><label>Make</label><input type="text" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
          <div className="field" style={{ width: 120 }}><label>Model</label><input type="text" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
          <div className="field" style={{ width: 150 }}><label>VIN</label><input type="text" value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} /></div>
          <div className="field" style={{ width: 110 }}><label>Plate</label><input type="text" value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value })} /></div>
          <div className="field" style={{ width: 110 }}><label>Tank (gal)</label><input type="number" step="any" value={form.tank_capacity_gal} onChange={(e) => setForm({ ...form, tank_capacity_gal: e.target.value })} placeholder="e.g. 26" /></div>
          <div className="field" style={{ width: 110 }}><label>MPG low</label><input type="number" step="any" value={form.expected_mpg_low} onChange={(e) => setForm({ ...form, expected_mpg_low: e.target.value })} placeholder="e.g. 12" /></div>
          <div className="field" style={{ width: 110 }}><label>MPG high</label><input type="number" step="any" value={form.expected_mpg_high} onChange={(e) => setForm({ ...form, expected_mpg_high: e.target.value })} placeholder="e.g. 20" /></div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : (editingId ? 'Save changes' : 'Add vehicle')}</button>
        </form>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
        Tank size and the expected-MPG band power the fuel-anomaly flags. Link each vehicle to its inventory truck so it’s one shared record.
      </p>

      <label className="nav-link" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 12 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} style={{ marginRight: 6 }} />
        Show archived
      </label>

      <table className="data-table">
        <thead>
          <tr><th></th><th>Name</th><th>Truck</th><th>Technician</th><th>Year / Make / Model</th><th>Tank</th><th>MPG band</th><th>Status</th></tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
            <tr key={v.id}>
              <td style={{ display: 'flex', gap: 6 }}>
                <button className="logout-button" onClick={() => startEdit(v)}>Edit</button>
                <button className="logout-button" onClick={async () => { await updateVehicle(v.id, { is_active: !v.is_active }); load() }}>{v.is_active ? 'Archive' : 'Restore'}</button>
              </td>
              <td>{v.name}</td>
              <td style={{ color: 'var(--mist)' }}>{truckName(v.location_id)}</td>
              <td>{techName(v.assigned_user_id)}</td>
              <td style={{ color: 'var(--mist)' }}>{[v.year, v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
              <td>{v.tank_capacity_gal ?? '—'}</td>
              <td>{v.expected_mpg_low != null && v.expected_mpg_high != null ? `${v.expected_mpg_low}–${v.expected_mpg_high}` : '—'}</td>
              <td>
                <select value={v.status} onChange={async (e) => { await updateVehicle(v.id, { status: e.target.value }); load() }}>
                  <option value="active">Active</option>
                  <option value="in_shop">In shop</option>
                  <option value="out_of_service">Out of service</option>
                  <option value="retired">Retired</option>
                </select>
              </td>
            </tr>
          ))}
          {vehicles.length === 0 && <tr><td colSpan="8" style={{ color: 'var(--mist)' }}>No vehicles yet. Add each truck here (or link the ones you set up in Inventory).</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
