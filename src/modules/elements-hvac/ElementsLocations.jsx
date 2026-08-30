// Elements-HVAC · Locations — warehouses & trucks.
// A location is either a Warehouse/Shop (has an address) or a mobile Truck,
// picked from the Fleet vehicle list. The truck must be recorded in Fleet
// first; the assigned technician then follows the Fleet record.
//
// Truck lifecycle (data-safety first — nothing with stock or history vanishes):
//   Assigned  — active truck with a driver (from Fleet).
//   Available — active truck with no driver right now (auto from Fleet). Live,
//               may hold stock; not an Archive or Delete candidate.
//   Archived  — benched/surplus, kept for future use. Must be stock-free first;
//               history is kept and it can be restored.
//   Retired   — permanently out of the fleet. Must be stock-free first; all
//               history is kept forever. Can still be restored if it returns.
// Delete is reserved for genuinely empty records (no stock, no history).
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listLocations, addLocation, updateLocation, deleteLocation,
  retireLocation, restoreLocation, listLocationStock,
  listTechnicians, getSettings,
} from './data'
import { listVehicles } from './fleetData'
import { useOrgSelector, OrgBar, DisabledNotice } from './shared'

const blank = { type: 'warehouse', name: '', address: '', vehicle_id: '', assigned_user_id: '' }
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const STATUS = {
  assigned:  { label: 'Assigned',  bg: '#E8F0FE', fg: '#1B3A6B' },
  available: { label: 'Available', bg: '#E7F6EC', fg: '#0B7A3B' },
  active:    { label: 'Active',    bg: '#E8F0FE', fg: '#1B3A6B' },
  archived:  { label: 'Archived',  bg: '#EEF1F5', fg: '#64748B' },
  retired:   { label: 'Retired',   bg: '#EEF1F5', fg: '#64748B' },
}

export default function ElementsLocations({ profile }) {
  const org = useOrgSelector(profile)
  const [locations, setLocations] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [techs, setTechs] = useState([])
  const [stock, setStock] = useState({})
  const [enabled, setEnabled] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [guard, setGuard] = useState(null) // { name, parts, value, action }

  async function load() {
    if (!org.selectedOrg) return
    const [locs, v, t, s, sk] = await Promise.all([
      listLocations(org.selectedOrg, { includeInactive: showArchived }),
      listVehicles(org.selectedOrg),
      listTechnicians(org.selectedOrg),
      getSettings(org.selectedOrg),
      listLocationStock(org.selectedOrg),
    ])
    setLocations(locs)
    setVehicles(v)
    setTechs(t)
    setEnabled(!!s?.enabled)
    setStock(sk || {})
  }
  useEffect(() => { load() }, [org.selectedOrg, showArchived])

  function techName(id) {
    const t = techs.find((x) => x.id === id)
    return t ? t.full_name : '—'
  }

  // For a truck, the assigned tech always follows the linked Fleet vehicle.
  function driverId(loc) {
    if (loc.type !== 'truck') return null
    const v = vehicles.find((x) => x.id === loc.vehicle_id)
    return v?.assigned_user_id || null
  }
  function techForLocation(loc) {
    if (loc.type !== 'truck') return null
    return techName(driverId(loc))
  }

  function stockFor(loc) { return stock[loc.id] || { parts: 0, units: 0, value: 0 } }

  // Derived lifecycle status.
  function statusOf(loc) {
    if (loc.retired_at) return 'retired'
    if (!loc.is_active) return 'archived'
    if (loc.type === 'truck') return driverId(loc) ? 'assigned' : 'available'
    return 'active'
  }

  function pickVehicle(id) {
    const v = vehicles.find((x) => x.id === id)
    setForm((f) => ({ ...f, vehicle_id: id, name: v?.name || '', assigned_user_id: v?.assigned_user_id || '' }))
  }
  function changeType(type) {
    setForm((f) => ({ ...f, type, name: '', address: '', vehicle_id: '', assigned_user_id: '' }))
  }
  function startNew() { setEditingId(null); setForm(blank); setShowForm(true); setError(''); setGuard(null) }
  function closeForm() { setEditingId(null); setForm(blank); setShowForm(false); setError('') }
  function startEdit(loc) {
    setError(''); setGuard(null)
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
    const { error: err } = editingId ? await updateLocation(editingId, payload) : await addLocation(org.selectedOrg, payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    closeForm(); load()
  }

  // Archive / Retire both refuse while the location holds stock — you must move
  // the stock off first (or, for a truck between drivers, just leave it Available).
  function blockIfStock(loc, action) {
    const sk = stockFor(loc)
    if (sk.parts > 0) { setGuard({ name: loc.name, parts: sk.parts, value: sk.value, action, truck: loc.type === 'truck' }); return true }
    setGuard(null)
    return false
  }

  async function archiveLoc(loc) {
    setError('')
    if (blockIfStock(loc, 'archive')) return
    const { error: err } = await updateLocation(loc.id, { is_active: false })
    if (err) { setError(err.message); return }
    load()
  }
  async function restoreLoc(loc) {
    setError(''); setGuard(null)
    const { error: err } = await restoreLocation(loc.id)
    if (err) { setError(err.message); return }
    load()
  }
  async function retireLoc(loc) {
    setError('')
    if (blockIfStock(loc, 'retire')) return
    if (!window.confirm(`Retire "${loc.name}"? It leaves the active fleet but all of its history is kept, and you can restore it later if it returns to service.`)) return
    const { error: err } = await retireLocation(loc.id)
    if (err) { setError(err.message); return }
    if (editingId === loc.id) closeForm()
    load()
  }
  async function handleDelete(loc) {
    setError('')
    if (stockFor(loc).parts > 0) { blockIfStock(loc, 'delete'); return }
    if (!window.confirm(`Permanently delete "${loc.name}"? This can only be done if it has no stock or history. If it has history, use Retire instead to keep it.`)) return
    const { error: err } = await deleteLocation(loc.id)
    if (err) { setError(`Couldn’t delete “${loc.name}” — it has stock or usage history. Use Retire to remove it from the fleet while keeping its history. (${err.message})`); return }
    if (editingId === loc.id) closeForm()
    load()
  }

  const usedVehicleIds = new Set(locations.filter((l) => l.type === 'truck' && l.id !== editingId).map((l) => l.vehicle_id))

  const Badge = ({ st }) => {
    const s = STATUS[st] || STATUS.active
    return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.fg }}>{s.label}</span>
  }

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
                    <option key={v.id} value={v.id}>{v.name}{usedVehicleIds.has(v.id) ? ' (already a location)' : ''}</option>
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

      {guard && (
        <div style={{ marginBottom: 16, background: '#FCEFEF', border: '1px solid #E3B0B0', color: '#B00020', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
          <strong>“{guard.name}” is carrying {guard.parts} part{guard.parts === 1 ? '' : 's'} ({money(guard.value)}).</strong>{' '}
          You can’t {guard.action} a location that still holds stock — that would hide inventory.
          Transfer the stock to another location first in <Link to="/elements/stock" style={{ color: '#B00020', fontWeight: 700 }}>Stock &amp; Receiving → Transfer</Link>, then try again.
          {guard.truck && guard.action !== 'delete' ? ' A truck simply between drivers doesn’t need archiving — it already shows as Available.' : ''}
        </div>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      {vehicles.length === 0 && (
        <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
          Trucks come from Fleet. Record each company or employee truck in Fleet → Vehicles first, then add it here as a mobile location.
        </p>
      )}

      <label className="nav-link" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 12 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} style={{ marginRight: 6 }} />
        Show archived &amp; retired
      </label>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr><th>Actions</th><th>Type</th><th>Name</th><th>Status</th><th>Assigned technician</th><th>Stock</th><th>Address</th></tr>
          </thead>
          <tbody>
            {locations.map((loc) => {
              const st = statusOf(loc)
              const sk = stockFor(loc)
              const hasStock = sk.parts > 0
              const inactive = st === 'archived' || st === 'retired'
              return (
                <tr key={loc.id} style={editingId === loc.id ? { background: '#EEF3FB' } : undefined}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="auth-button" style={{ width: 'auto', margin: 0, marginRight: 6, padding: '4px 10px' }} onClick={() => startEdit(loc)}>Edit</button>
                    {inactive ? (
                      <button className="logout-button" style={{ marginRight: 6 }} onClick={() => restoreLoc(loc)}>Restore</button>
                    ) : (
                      <button className="logout-button" style={{ marginRight: 6 }} onClick={() => archiveLoc(loc)}>Archive</button>
                    )}
                    {st !== 'retired' && (
                      <button className="logout-button" style={{ marginRight: 6 }} onClick={() => retireLoc(loc)}>Retire</button>
                    )}
                    <button className="logout-button" onClick={() => handleDelete(loc)} disabled={hasStock}
                      title={hasStock ? 'Carrying stock — transfer it off, then Archive or Retire.' : 'Only for empty records with no stock or history.'}>Delete</button>
                  </td>
                  <td>{loc.type === 'truck' ? 'Truck' : 'Warehouse / Shop'}</td>
                  <td>{loc.name}</td>
                  <td><Badge st={st} /></td>
                  <td>{loc.type === 'truck' ? techForLocation(loc) : <span style={{ color: 'var(--mist)' }}>n/a</span>}</td>
                  <td style={hasStock ? { fontWeight: 600, color: '#152238' } : { color: 'var(--mist)' }}>
                    {hasStock ? `${sk.parts} part${sk.parts === 1 ? '' : 's'} · ${money(sk.value)}` : '—'}
                  </td>
                  <td style={{ color: 'var(--mist)' }}>{loc.type === 'warehouse' ? (loc.address || '—') : '—'}</td>
                </tr>
              )
            })}
            {locations.length === 0 && (
              <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>No locations yet. Add your warehouse and each service truck.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
