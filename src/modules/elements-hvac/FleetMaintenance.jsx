// Elements-HVAC · Fleet · Preventive Maintenance
import { useState, useEffect } from 'react'
import {
  listVehicles, listPmSchedules, addPmSchedule, archivePmSchedule, completePm,
  pmStatus, latestOdometersByVehicle, todayStr, FLAG_COLORS,
} from './fleetData'
import { useOrgSelector, OrgBar } from './shared'

const blank = { task_name: '', interval_type: 'miles', interval_value: '', due_soon_threshold: '', last_done_meter: '', last_done_date: '' }
const stateColor = (st) => (st.state === 'overdue' ? FLAG_COLORS.red : st.state === 'due_soon' ? FLAG_COLORS.amber : st.state === 'ok' ? '#16A34A' : '#94A3B8')

export default function FleetMaintenance({ profile }) {
  const org = useOrgSelector(profile)
  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [odoMap, setOdoMap] = useState({})
  const [schedules, setSchedules] = useState([])
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [logging, setLogging] = useState(null) // schedule being logged
  const [logForm, setLogForm] = useState({ date: todayStr(), odometer: '', cost: '', description: '' })
  const [msg, setMsg] = useState('')

  async function loadVehicles() {
    if (!org.selectedOrg) return
    const [v, odo] = await Promise.all([listVehicles(org.selectedOrg), latestOdometersByVehicle(org.selectedOrg)])
    setVehicles(v); setOdoMap(odo)
    if (!vehicleId && v[0]) setVehicleId(v[0].id)
  }
  useEffect(() => { loadVehicles() }, [org.selectedOrg])

  async function loadSchedules() {
    if (!org.selectedOrg || !vehicleId) { setSchedules([]); return }
    setSchedules(await listPmSchedules(org.selectedOrg, vehicleId))
  }
  useEffect(() => { loadSchedules() }, [org.selectedOrg, vehicleId])

  const currentOdo = odoMap[vehicleId] ?? null
  const num = (x) => (x === '' || x == null ? null : Number(x))

  async function handleAdd(e) {
    e.preventDefault()
    setMsg('')
    if (!form.task_name.trim() || !form.interval_value) { setMsg('Task and interval are required.'); return }
    const { error } = await addPmSchedule(org.selectedOrg, {
      vehicle_id: vehicleId,
      task_name: form.task_name.trim(),
      interval_type: form.interval_type,
      interval_value: num(form.interval_value),
      due_soon_threshold: num(form.due_soon_threshold),
      last_done_meter: num(form.last_done_meter),
      last_done_date: form.last_done_date || null,
    })
    if (error) { setMsg(error.message); return }
    setForm(blank); setShowForm(false); loadSchedules()
  }

  function openLog(sch) {
    setLogging(sch)
    setLogForm({ date: todayStr(), odometer: currentOdo != null ? String(currentOdo) : '', cost: '', description: sch.task_name })
  }
  async function saveLog(e) {
    e.preventDefault()
    await completePm(org.selectedOrg, logging, {
      odometer: num(logForm.odometer), date: logForm.date || todayStr(),
      description: logForm.description, cost: num(logForm.cost),
    })
    setLogging(null); loadVehicles(); loadSchedules()
  }

  return (
    <div>
      <div className="page-header-bar">
        <h2>Preventive Maintenance</h2>
      </div>
      <OrgBar {...org} />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 8 }}>
        <div className="field" style={{ maxWidth: 320, marginBottom: 0 }}>
          <label>Vehicle</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">— select —</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 8 }}>
          Current odometer: <strong>{currentOdo != null ? Number(currentOdo).toLocaleString() : '—'}</strong>
        </div>
        <button className="auth-button" style={{ width: 'auto', marginBottom: 4 }} disabled={!vehicleId} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Schedule'}
        </button>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={handleAdd} style={{ margin: '10px 0', flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 200 }}><label>Task</label><input type="text" value={form.task_name} onChange={(e) => setForm({ ...form, task_name: e.target.value })} placeholder="Oil & filter" /></div>
          <div className="field">
            <label>Every</label>
            <select value={form.interval_type} onChange={(e) => setForm({ ...form, interval_type: e.target.value })}>
              <option value="miles">Miles</option>
              <option value="days">Days</option>
              <option value="hours">Engine hours</option>
            </select>
          </div>
          <div className="field" style={{ width: 120 }}><label>Interval</label><input type="number" step="any" value={form.interval_value} onChange={(e) => setForm({ ...form, interval_value: e.target.value })} placeholder="5000" /></div>
          <div className="field" style={{ width: 130 }}><label>Warn before</label><input type="number" step="any" value={form.due_soon_threshold} onChange={(e) => setForm({ ...form, due_soon_threshold: e.target.value })} placeholder="500" /></div>
          <div className="field" style={{ width: 140 }}><label>Last done ({form.interval_type === 'days' ? 'odo opt.' : 'odometer'})</label><input type="number" step="any" value={form.last_done_meter} onChange={(e) => setForm({ ...form, last_done_meter: e.target.value })} /></div>
          <div className="field" style={{ width: 150 }}><label>Last done date</label><input type="date" value={form.last_done_date} onChange={(e) => setForm({ ...form, last_done_date: e.target.value })} /></div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }}>Add schedule</button>
        </form>
      )}
      {msg && <div className="auth-error" style={{ marginBottom: 12 }}>{msg}</div>}

      <table className="data-table">
        <thead>
          <tr><th>Task</th><th>Interval</th><th>Last done</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {schedules.map((s) => {
            const st = pmStatus(s, currentOdo)
            return (
              <tr key={s.id}>
                <td>{s.task_name}</td>
                <td style={{ color: 'var(--mist)' }}>{Number(s.interval_value).toLocaleString()} {s.interval_type === 'days' ? 'days' : s.interval_type === 'hours' ? 'hrs' : 'mi'}</td>
                <td style={{ color: 'var(--mist)' }}>{[s.last_done_meter != null ? `${Number(s.last_done_meter).toLocaleString()} mi` : null, s.last_done_date].filter(Boolean).join(' · ') || '—'}</td>
                <td><span style={{ background: stateColor(st), color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>{st.label}</span></td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => openLog(s)}>Log service</button>
                  <button className="logout-button" onClick={async () => { await archivePmSchedule(s.id); loadSchedules() }}>Remove</button>
                </td>
              </tr>
            )
          })}
          {schedules.length === 0 && <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No schedules for this vehicle. Add one (e.g. Oil & filter every 5,000 mi).</td></tr>}
        </tbody>
      </table>

      {logging && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: 20 }}>
          <form onSubmit={saveLog} style={{ background: '#fff', borderRadius: 14, padding: 24, width: 420, maxWidth: '100%' }}>
            <h3 style={{ marginTop: 0 }}>Log “{logging.task_name}”</h3>
            <div className="field"><label>Date</label><input type="date" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} /></div>
            <div className="field"><label>Odometer</label><input type="number" step="any" value={logForm.odometer} onChange={(e) => setLogForm({ ...logForm, odometer: e.target.value })} /></div>
            <div className="field"><label>Cost (optional)</label><input type="number" step="any" value={logForm.cost} onChange={(e) => setLogForm({ ...logForm, cost: e.target.value })} /></div>
            <div className="field"><label>Notes (optional)</label><input type="text" value={logForm.description} onChange={(e) => setLogForm({ ...logForm, description: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="auth-button" type="submit" style={{ width: 'auto' }}>Save &amp; reset schedule</button>
              <button type="button" className="logout-button" onClick={() => setLogging(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
