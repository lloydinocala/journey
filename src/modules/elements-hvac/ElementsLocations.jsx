// Elements-HVAC · Locations — warehouses & trucks, with a technician assigned to each truck
import { useState, useEffect } from 'react'
import { listLocations, addLocation, updateLocation, listTechnicians, getSettings } from './data'
import { useOrgSelector, OrgBar, DisabledNotice } from './shared'

const blank = { type: 'truck', name: '', assigned_user_id: '' }

export default function ElementsLocations({ profile }) {
  const org = useOrgSelector(profile)
  const [locations, setLocations] = useState([])
  const [techs, setTechs] = useState([])
  const [enabled, setEnabled] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const [locs, t, s] = await Promise.all([
      listLocations(org.selectedOrg, { includeInactive: showArchived }),
      listTechnicians(org.selectedOrg),
      getSettings(org.selectedOrg),
    ])
    setLocations(locs)
    setTechs(t)
    setEnabled(!!s?.enabled)
  }
  useEffect(() => { load() }, [org.selectedOrg, showArchived])

  function techName(id) {
    const t = techs.find((x) => x.id === id)
    return t ? t.full_name : '—'
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return
    setSaving(true)
    const { error: err } = await addLocation(org.selectedOrg, {
      type: form.type,
      name: form.name.trim(),
      assigned_user_id: form.type === 'truck' && form.assigned_user_id ? form.assigned_user_id : null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(blank)
    setShowForm(false)
    load()
  }

  async function reassign(loc, userId) {
    await updateLocation(loc.id, { assigned_user_id: userId || null })
    load()
  }

  async function toggleArchive(loc) {
    await updateLocation(loc.id, { is_active: !loc.is_active })
    load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Locations</h2>
          <span className="badge">{locations.length} shown</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Location'}
        </button>
      </div>
      <OrgBar {...org} />
      <DisabledNotice enabled={enabled} />

      {showForm && (
        <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="truck">Truck</option>
              <option value="warehouse">Warehouse / Shop</option>
            </select>
          </div>
          <div className="field">
            <label>Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Truck 12 / Main Shop" required />
          </div>
          {form.type === 'truck' && (
            <div className="field" style={{ minWidth: 220 }}>
              <label>Assigned technician</label>
              <select value={form.assigned_user_id} onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })}>
                <option value="">— unassigned —</option>
                {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
          )}
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>
            {saving ? 'Adding…' : 'Add location'}
          </button>
        </form>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <label className="nav-link" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 12 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} style={{ marginRight: 6 }} />
        Show archived
      </label>

      <table className="data-table">
        <thead>
          <tr><th></th><th>Type</th><th>Name</th><th>Assigned technician</th></tr>
        </thead>
        <tbody>
          {locations.map((loc) => (
            <tr key={loc.id}>
              <td><button className="logout-button" onClick={() => toggleArchive(loc)}>{loc.is_active ? 'Archive' : 'Restore'}</button></td>
              <td style={{ textTransform: 'capitalize' }}>{loc.type}</td>
              <td>{loc.name}</td>
              <td>
                {loc.type === 'truck' ? (
                  <select value={loc.assigned_user_id || ''} onChange={(e) => reassign(loc, e.target.value)}>
                    <option value="">— unassigned —</option>
                    {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                ) : <span style={{ color: 'var(--mist)' }}>n/a</span>}
              </td>
            </tr>
          ))}
          {locations.length === 0 && (
            <tr><td colSpan="4" style={{ color: 'var(--mist)' }}>No locations yet. Add your warehouse and each service truck.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
