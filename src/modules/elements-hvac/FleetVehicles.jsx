// Elements-HVAC · Fleet · Vehicles (linked to inventory trucks)
import { useState, useEffect, Fragment } from 'react'
import { listVehicles, addVehicle, updateVehicle, listTrucks, listAllAssignments, reassignVehicle, openInitialAssignment } from './fleetData'
import { listTechnicians } from './data'
import { useOrgSelector, OrgBar } from './shared'

const today = () => new Date().toISOString().slice(0, 10)

const blank = {
  ownership: 'company', location_id: '', name: '', assigned_user_id: '', home_address: '', year: '', make: '', model: '',
  vin: '', license_plate: '', color: '', tank_capacity_gal: '',
  expected_mpg_low: '', expected_mpg_high: '', status: 'active',
}

const OWNERSHIP_LABELS = { company: 'Company truck', employee: 'Employee (own) truck' }

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
  const [assignments, setAssignments] = useState({})   // vehicle_id -> [assignment rows], newest first
  const [reassignId, setReassignId] = useState(null)    // vehicle currently being reassigned
  const [reassignForm, setReassignForm] = useState({ user_id: '', started_on: '' })
  const [historyId, setHistoryId] = useState(null)      // vehicle whose history is expanded

  async function load() {
    if (!org.selectedOrg) return
    const [v, t, tech, asg] = await Promise.all([
      listVehicles(org.selectedOrg, { includeInactive: showArchived }),
      listTrucks(org.selectedOrg),
      listTechnicians(org.selectedOrg),
      listAllAssignments(org.selectedOrg),
    ])
    setVehicles(v); setTrucks(t); setTechs(tech)
    const byVehicle = {}
    asg.forEach((a) => { (byVehicle[a.vehicle_id] = byVehicle[a.vehicle_id] || []).push(a) })
    setAssignments(byVehicle)
  }
  useEffect(() => { load() }, [org.selectedOrg, showArchived])

  function startReassign(v) {
    setHistoryId(null)
    setReassignId(v.id)
    setReassignForm({ user_id: v.assigned_user_id || '', started_on: today() })
  }
  async function saveReassign(v) {
    await reassignVehicle(org.selectedOrg, v.id, reassignForm.user_id || null, reassignForm.started_on || today())
    setReassignId(null)
    load()
  }

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
      ownership: v.ownership || 'company',
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
      ownership: form.ownership,
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
    let err
    if (editingId) {
      err = (await updateVehicle(editingId, payload)).error
    } else {
      const res = await addVehicle(org.selectedOrg, payload)
      err = res.error
      // Opening assignment so the responsibility timeline starts here.
      if (!err && payload.assigned_user_id) {
        await openInitialAssignment(org.selectedOrg, res.data.id, payload.assigned_user_id)
      }
    }
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
          <div className="field" style={{ minWidth: 190 }}>
            <label>Ownership</label>
            <select value={form.ownership} onChange={(e) => setForm({ ...form, ownership: e.target.value })}>
              <option value="company">Company truck</option>
              <option value="employee">Employee (own) truck</option>
            </select>
          </div>
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
            {editingId ? (
              <input type="text" value={form.assigned_user_id ? techName(form.assigned_user_id) : '— unassigned —'} readOnly disabled title="Use Reassign on the vehicle row to change (keeps a dated history)" />
            ) : (
              <select value={form.assigned_user_id} onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })}>
                <option value="">— unassigned —</option>
                {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            )}
          </div>
          <div className="field" style={{ minWidth: 280 }}>
            <label>Where the vehicle is kept (home base)</label>
            <input type="text" value={form.home_address} onChange={(e) => setForm({ ...form, home_address: e.target.value })} placeholder="Garage / driveway address — the daily route anchor" />
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
          <tr><th></th><th>Name</th><th>Ownership</th><th>Truck</th><th>Technician</th><th>Year / Make / Model</th><th>Tank</th><th>MPG band</th><th>Status</th></tr>
        </thead>
        <tbody>
          {vehicles.map((v) => {
            const hist = assignments[v.id] || []
            return (
            <Fragment key={v.id}>
            <tr>
              <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="logout-button" onClick={() => startEdit(v)}>Edit</button>
                <button className="logout-button" onClick={() => startReassign(v)}>Reassign</button>
                <button className="logout-button" onClick={() => { setReassignId(null); setHistoryId(historyId === v.id ? null : v.id) }}>History</button>
                <button className="logout-button" onClick={async () => { await updateVehicle(v.id, { is_active: !v.is_active }); load() }}>{v.is_active ? 'Archive' : 'Restore'}</button>
              </td>
              <td>{v.name}</td>
              <td style={{ color: 'var(--mist)' }}>{OWNERSHIP_LABELS[v.ownership] || 'Company truck'}</td>
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
            {reassignId === v.id && (
              <tr>
                <td colSpan="9" style={{ background: '#EEF3FB' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', padding: '6px 2px' }}>
                    <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
                      <label>Reassign to</label>
                      <select value={reassignForm.user_id} onChange={(e) => setReassignForm({ ...reassignForm, user_id: e.target.value })}>
                        <option value="">— unassigned —</option>
                        {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Effective date</label>
                      <input type="date" value={reassignForm.started_on} onChange={(e) => setReassignForm({ ...reassignForm, started_on: e.target.value })} />
                    </div>
                    <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => saveReassign(v)}>Save assignment</button>
                    <button className="logout-button" onClick={() => setReassignId(null)}>Cancel</button>
                    <span style={{ color: 'var(--mist)', fontSize: 12 }}>Closes the current assignment and starts a new one on this date.</span>
                  </div>
                </td>
              </tr>
            )}
            {historyId === v.id && (
              <tr>
                <td colSpan="9" style={{ background: '#F7F9FC' }}>
                  <div style={{ padding: '6px 2px' }}>
                    <strong style={{ fontSize: 13 }}>Assignment history — {v.name}</strong>
                    {hist.length === 0 ? (
                      <div style={{ color: 'var(--mist)', fontSize: 13, marginTop: 4 }}>No assignment records yet. Use Reassign to start one.</div>
                    ) : (
                      <table style={{ width: 'auto', marginTop: 8 }}>
                        <thead>
                          <tr><th style={{ textAlign: 'left', paddingRight: 24 }}>Technician</th><th style={{ textAlign: 'left', paddingRight: 24 }}>From</th><th style={{ textAlign: 'left' }}>To</th></tr>
                        </thead>
                        <tbody>
                          {hist.map((a) => (
                            <tr key={a.id}>
                              <td style={{ paddingRight: 24 }}>{techName(a.user_id)}</td>
                              <td style={{ paddingRight: 24 }}>{a.started_on}</td>
                              <td>{a.ended_on || <span className="badge" style={{ background: '#166534', color: '#fff' }}>current</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </td>
              </tr>
            )}
            </Fragment>
            )
          })}
          {vehicles.length === 0 && <tr><td colSpan="9" style={{ color: 'var(--mist)' }}>No vehicles yet. Add each truck here (or link the ones you set up in Inventory).</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
