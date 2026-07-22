// Elements-HVAC · Fleet · Document Renewals (registration, insurance, inspection)
import { useState, useEffect } from 'react'
import { listVehicles, listRenewals, addRenewal, updateRenewal, archiveRenewal, renewalStatus, renewalName, todayStr, FLAG_COLORS } from './fleetData'
import { useOrgSelector, OrgBar } from './shared'

const blank = { vehicle_id: '', renewal_type: 'registration', label: '', due_date: '', due_soon_days: 30 }
const stateColor = (st) => (st.state === 'overdue' ? FLAG_COLORS.red : st.state === 'due_soon' ? FLAG_COLORS.amber : '#16A34A')
function plusOneYear(s) { const d = new Date(s + 'T00:00:00'); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10) }

export default function FleetRenewals({ profile }) {
  const org = useOrgSelector(profile)
  const [vehicles, setVehicles] = useState([])
  const [renewals, setRenewals] = useState([])
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const [v, r] = await Promise.all([listVehicles(org.selectedOrg), listRenewals(org.selectedOrg)])
    setVehicles(v); setRenewals(r)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  const vehName = (id) => vehicles.find((v) => v.id === id)?.name || '—'

  async function handleAdd(e) {
    e.preventDefault()
    setMsg('')
    if (!form.vehicle_id || !form.due_date) { setMsg('Vehicle and due date are required.'); return }
    const { error } = await addRenewal(org.selectedOrg, {
      vehicle_id: form.vehicle_id,
      renewal_type: form.renewal_type,
      label: form.renewal_type === 'other' ? (form.label.trim() || 'Other') : null,
      due_date: form.due_date,
      due_soon_days: Number(form.due_soon_days) || 30,
    })
    if (error) { setMsg(error.message); return }
    setForm(blank); setShowForm(false); load()
  }

  async function renew(r) {
    await updateRenewal(r.id, { last_completed_date: todayStr(), due_date: plusOneYear(r.due_date) })
    load()
  }

  const sorted = [...renewals].sort((a, b) => (a.due_date < b.due_date ? -1 : 1))

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Document Renewals</h2>
          <span className="badge">{renewals.length}</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Renewal'}
        </button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 180 }}>
            <label>Vehicle</label>
            <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
              <option value="">— select —</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Type</label>
            <select value={form.renewal_type} onChange={(e) => setForm({ ...form, renewal_type: e.target.value })}>
              <option value="registration">Registration</option>
              <option value="insurance">Insurance</option>
              <option value="inspection">Inspection</option>
              <option value="other">Other</option>
            </select>
          </div>
          {form.renewal_type === 'other' && (
            <div className="field"><label>Label</label><input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. DOT permit" /></div>
          )}
          <div className="field"><label>Due date</label><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          <div className="field" style={{ width: 130 }}><label>Warn (days)</label><input type="number" value={form.due_soon_days} onChange={(e) => setForm({ ...form, due_soon_days: e.target.value })} /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }}>Add renewal</button>
        </form>
      )}
      {msg && <div className="auth-error" style={{ marginBottom: 12 }}>{msg}</div>}

      <table className="data-table">
        <thead>
          <tr><th>Vehicle</th><th>Type</th><th>Due date</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const st = renewalStatus(r)
            return (
              <tr key={r.id}>
                <td>{vehName(r.vehicle_id)}</td>
                <td>{renewalName(r)}</td>
                <td><input type="date" value={r.due_date} onChange={async (e) => { await updateRenewal(r.id, { due_date: e.target.value }); load() }} /></td>
                <td><span style={{ background: stateColor(st), color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>{st.label}</span></td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => renew(r)} title="Mark renewed and roll the due date forward one year">Renew +1yr</button>
                  <button className="logout-button" onClick={async () => { await archiveRenewal(r.id); load() }}>Remove</button>
                </td>
              </tr>
            )
          })}
          {sorted.length === 0 && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No renewals tracked yet. Add registration, insurance, and inspection due dates per truck.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
