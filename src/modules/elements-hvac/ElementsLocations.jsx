// Elements-HVAC · Locations — warehouses & trucks.
// A location is either a Warehouse/Shop (has an address) or a mobile Truck,
// which is picked from the Fleet vehicle list. The truck must be recorded in
// Fleet first; the assigned technician then follows the Fleet record.
import { useState, useEffect } from 'react'
import { listLocations, addLocation, updateLocation, deleteLocation, listTechnicians, getSettings } from './data'
import { listVehicles } from './fleetData'
import { useOrgSelector, OrgBar, DisabledNotice } from './shared'

const blank = { type: 'warehouse', name: '', address: '', vehicle_id: '', assigned_user_id: '' }

export default function ElementsLocations({ profile }) {
  const org = useOrgSelector(profile)
  const [locations, setLocations] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [techs, setTechs] = useState([])
  const [enabled, setEnabled] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const [locs, v, t, s] = await Promise.all([
      listLocations(org.selectedOrg, { includeInactive: showArchived }),
      listVehicles(org.selectedOrg),
      listTechnicians(org.selectedOrg),
      getSettings(org.selectedOrg),
    ])
    setLocations(locs)
    setVehicles(v)
    setTechs(t)
    setEnabled(!!s?.enabled)
  }
  useEffect(() => { load() }, [org.selectedOrg, showArchived])

  function techName(id) {
    const t = techs.find((x) => x.id === id)
    return t ? t.full_name : '—'
  }

  // For a truck location, the assigned technician always follows the linked
  // Fleet vehicle so the two never drift apart.
  function techForLocation(loc) {
    if (loc.type !== 'truck') return null
    const v = vehicles.find((x) => x.id === loc.vehicle_id)
    return techName(v?.assigned_user_id)
  }

  // Picking a Fleet vehicle fills in the location name + assigned technician.
  function pickVehicle(id) {
    const v = vehicles.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      vehicle_id: id,
      name: v?.name || '',
      assigned_user_id: v?.assigned_user_id || '',
    }))
  }

  function changeType(type) {
    // Reset the type-specific fields when switching between warehouse and truck.
    setForm((f) => ({ ...f, type, name: '', address: '', vehicle_id: '', assigned_user_id: '' }))
  }

  function startNew() { setEditingId(null); setForm(blank); setShowForm(true); setError('') }
  function closeForm() { setEditingId(null); setForm(blank); setShowForm(false); setError('') }

  function startEdit(loc) {
    setError('')
    setEditingId(loc.id)
    setForm({
      type: loc.type || 'warehouse',
      name: loc.name || '',
      address: loc.address || '',
      vehicle_id: loc.vehicle_id || '',
      assigned_user_id: loc.assigned_user_id || '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.type === 'truck' && !form.vehicle_id) { setError('Pick the truck from Fleet. Record it in Fleet first if it isn’t listed.'); return }
    if (form.type === 'warehouse' && !form.name.trim()) { setError('Warehouse name is required.'); return }
    setSaving(true)
    const payload = form.type === 'truck'
      ? { type: 'truck', name: form.name.trim(), vehicle_id: form.vehicle_id, assigned_user_id: form.assigned_user_id || null, address: null }
      : { type: 'warehouse', name: form.name.trim(), address: form.address.trim() || null, vehicle_id: null, assigned_user_id: null }
    const { error: err } = editingId
      ? await updateLocation(editingId, payload)
      : await addLocation(org.selectedOrg, payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    closeForm()
    load()
  }

  async function toggleArchive(loc) {
    await updateLocation(loc.id, { is_active: !loc.is_active })
    load()
  }

  async function handleDelete(loc) {
    if (!window.confirm(`Permanently delete "${loc.name}"? This can't be undone. If it holds stock history, use Archive instead.`)) return
    setError('')
    const { error: err } = await deleteLocation(loc.id)
    if (err) { setError(`Couldn't delete "${loc.name}" — it may hold stock or usage history. Try Archive instead. (${err.message})`); return }
    if (editingId === loc.id) closeForm()
    load()
  }

  // Vehicles already tied to another active truck location (so we can flag them).
  const usedVehicleIds = new Set(locations.filter((l) => l.type === 'truck' && l.id !== editingId).map((l) => l.vehicle_id))

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Locations</h2>
          <span className="badge">{locations.length} shown</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => (showForm ? closeForm() : startNew())}>
          {showForm ? 'Cancel' : '+ New Location'}
        </button>
      </div>
      <OrgBar {...org} />
      <DisabledNotice enabled={enabled} />

      {showForm && (
        <form className="inline-form" onSubmit={handleSubmit} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          {editingId && <div style={{ flexBasis: '100%', fontWeight: 700, color: '#1B3A6B' }}>Editing {form.name || 'location'}</div>}
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={(e) => changeType(e.target.value)}>
              <option value="warehouse">Warehouse / Shop</option>
              <option value="truck">Truck (mobile)</option>
            </select>
          </div>
          {form.type === 'truck' ? (
            <>
              <div className="field" style={{ minWidth: 240 }}>
                <label>Truck (from Fleet)</label>
                <select value={form.vehicle_id} onChange={(e) => pickVehicle(e.target.value)} required>
                  <option value="">— pick a truck recorded in Fleet —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}{usedVehicleIds.has(v.id) ? ' (already a location)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ minWidth: 200 }}>
                <label>Assigned technician</label>
                <input type="text" value={form.assigned_user_id ? techName(form.assigned_user_id) : '—'} readOnly disabled title="Set in Fleet → Vehicles" />
              </div>
            </>
          ) : (
            <>
              <div className="field" style={{ minWidth: 200 }}>
                <label>Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Shop" required />
              </div>
              <div className="field" style={{ minWidth: 280 }}>
                <label>Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, city, state" />
              </div>
            </>
          )}
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add location'}
          </button>
        </form>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      {vehicles.length === 0 && (
        <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
          Trucks come from Fleet. Record each company or employee truck in Fleet → Vehicles first, then add it here as a mobile location.
        </p>
      )}

      <label className="nav-link" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 12 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} style={{ marginRight: 6 }} />
        Show archived
      </label>

      <table className="data-table">
        <thead>
          <tr><th>Actions</th><th>Type</th><th>Name</th><th>Assigned technician</th><th>Address</th></tr>
        </thead>
        <tbody>
          {locations.map((loc) => (
            <tr key={loc.id} style={editingId === loc.id ? { background: '#EEF3FB' } : undefined}>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="auth-button" style={{ width: 'auto', margin: 0, marginRight: 6, padding: '4px 10px' }} onClick={() => startEdit(loc)}>Edit</button>
                <button className="logout-button" style={{ marginRight: 6 }} onClick={() => toggleArchive(loc)}>{loc.is_active ? 'Archive' : 'Restore'}</button>
                <button className="logout-button" onClick={() => handleDelete(loc)}>Delete</button>
              </td>
              <td>{loc.type === 'truck' ? 'Truck' : 'Warehouse / Shop'}</td>
              <td>{loc.name}</td>
              <td>{loc.type === 'truck' ? techForLocation(loc) : <span style={{ color: 'var(--mist)' }}>n/a</span>}</td>
              <td style={{ color: 'var(--mist)' }}>{loc.type === 'warehouse' ? (loc.address || '—') : '—'}</td>
            </tr>
          ))}
          {locations.length === 0 && (
            <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No locations yet. Add your warehouse and each service truck.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
