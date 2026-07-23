// Elements-HVAC · Fleet · Inspections (DVIR-style; failed items open repair issues)
import { useState, useEffect } from 'react'
import {
  listVehicles, latestOdometersByVehicle, todayStr, DEFAULT_CHECKLIST,
  listInspections, getInspectionItems, createInspection, FLAG_COLORS,
} from './fleetData'
import { useOrgSelector, OrgBar } from './shared'

const freshChecklist = () => DEFAULT_CHECKLIST.map((label) => ({ label, result: 'pass', note: '' }))

export default function FleetInspections({ profile }) {
  const org = useOrgSelector(profile)
  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [odoMap, setOdoMap] = useState({})
  const [inspections, setInspections] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [header, setHeader] = useState({ inspection_type: 'periodic', inspection_date: todayStr(), odometer: '', notes: '' })
  const [items, setItems] = useState(freshChecklist())
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [viewing, setViewing] = useState(null) // {inspection, items}

  async function loadVehicles() {
    if (!org.selectedOrg) return
    const [v, odo] = await Promise.all([listVehicles(org.selectedOrg), latestOdometersByVehicle(org.selectedOrg)])
    setVehicles(v); setOdoMap(odo)
    if (!vehicleId && v[0]) setVehicleId(v[0].id)
  }
  useEffect(() => { loadVehicles() }, [org.selectedOrg])

  async function loadInspections() {
    if (!org.selectedOrg || !vehicleId) { setInspections([]); return }
    setInspections(await listInspections(org.selectedOrg, vehicleId))
  }
  useEffect(() => { loadInspections() }, [org.selectedOrg, vehicleId])

  const currentOdo = odoMap[vehicleId] ?? null
  function startNew() {
    setHeader({ inspection_type: 'periodic', inspection_date: todayStr(), odometer: currentOdo != null ? String(currentOdo) : '', notes: '' })
    setItems(freshChecklist()); setShowForm(true); setMsg('')
  }
  function setItem(idx, patch) { setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it))) }

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setMsg('')
    const { error, defects } = await createInspection(org.selectedOrg, {
      vehicle_id: vehicleId, inspector_id: profile.id,
      inspection_date: header.inspection_date, odometer: header.odometer ? Number(header.odometer) : null,
      inspection_type: header.inspection_type, notes: header.notes.trim() || null,
    }, items)
    setSaving(false)
    if (error) { setMsg(error.message); return }
    setShowForm(false)
    setMsg(defects ? `Inspection saved — ${defects} defect${defects === 1 ? '' : 's'} opened as repair issue${defects === 1 ? '' : 's'}.` : 'Inspection saved — all items passed.')
    loadInspections()
  }

  async function view(insp) {
    const its = await getInspectionItems(insp.id)
    setViewing({ inspection: insp, items: its })
  }

  const failedCount = items.filter((i) => i.result === 'fail').length

  return (
    <div>
      <div className="page-header-bar"><h2>Inspections</h2></div>
      <OrgBar {...org} />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="field" style={{ maxWidth: 300, marginBottom: 0 }}>
          <label>Vehicle</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">— select —</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <button className="auth-button" style={{ width: 'auto', marginBottom: 4 }} disabled={!vehicleId} onClick={() => (showForm ? setShowForm(false) : startNew())}>
          {showForm ? 'Cancel' : '+ New Inspection'}
        </button>
      </div>
      {msg && <div style={{ marginBottom: 12, color: msg.includes('defect') ? '#B45309' : msg.includes('passed') ? '#166534' : '#B00020', fontWeight: 600 }}>{msg}</div>}

      {showForm && (
        <form onSubmit={submit} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div className="inline-form" style={{ marginBottom: 8 }}>
            <div className="field">
              <label>Type</label>
              <select value={header.inspection_type} onChange={(e) => setHeader({ ...header, inspection_type: e.target.value })}>
                <option value="pre_trip">Pre-trip</option><option value="post_trip">Post-trip</option><option value="periodic">Periodic</option>
              </select>
            </div>
            <div className="field" style={{ width: 150 }}><label>Date</label><input type="date" value={header.inspection_date} onChange={(e) => setHeader({ ...header, inspection_date: e.target.value })} /></div>
            <div className="field" style={{ width: 130 }}><label>Odometer</label><input type="number" step="any" value={header.odometer} onChange={(e) => setHeader({ ...header, odometer: e.target.value })} /></div>
          </div>

          <table className="data-table" style={{ marginBottom: 8 }}>
            <thead><tr><th>Item</th><th style={{ width: 170 }}>Result</th><th>Note (if defect)</th></tr></thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.label}>
                  <td>{it.label}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['pass', 'fail', 'na'].map((r) => (
                        <button type="button" key={r} onClick={() => setItem(idx, { result: r })}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase',
                            border: '1px solid var(--border)',
                            background: it.result === r ? (r === 'fail' ? FLAG_COLORS.red : r === 'pass' ? '#16A34A' : '#94A3B8') : '#fff',
                            color: it.result === r ? '#fff' : 'var(--mist)',
                          }}>{r}</button>
                      ))}
                    </div>
                  </td>
                  <td>{it.result === 'fail' && <input type="text" value={it.note} onChange={(e) => setItem(idx, { note: e.target.value })} placeholder="What's wrong?" style={{ width: '100%' }} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="field"><label>Overall notes (optional)</label><input type="text" value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} /></div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>
            {saving ? 'Saving…' : failedCount ? `Submit — opens ${failedCount} issue${failedCount === 1 ? '' : 's'}` : 'Submit inspection'}
          </button>
        </form>
      )}

      <table className="data-table">
        <thead><tr><th>Date</th><th>Type</th><th>Result</th><th></th></tr></thead>
        <tbody>
          {inspections.map((i) => (
            <tr key={i.id}>
              <td>{i.inspection_date}</td>
              <td style={{ textTransform: 'capitalize' }}>{i.inspection_type.replace('_', '-')}</td>
              <td><span style={{ background: i.result === 'fail' ? FLAG_COLORS.red : '#16A34A', color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{i.result}</span></td>
              <td><button className="logout-button" onClick={() => view(i)}>View</button></td>
            </tr>
          ))}
          {inspections.length === 0 && <tr><td colSpan="4" style={{ color: 'var(--mist)' }}>No inspections yet for this vehicle.</td></tr>}
        </tbody>
      </table>

      {viewing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 520, maxWidth: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Inspection · {viewing.inspection.inspection_date}</h3>
            <table className="data-table">
              <thead><tr><th>Item</th><th>Result</th><th>Note</th></tr></thead>
              <tbody>
                {viewing.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.item_label}</td>
                    <td style={{ color: it.result === 'fail' ? FLAG_COLORS.red : it.result === 'na' ? 'var(--mist)' : '#16A34A', fontWeight: 700, textTransform: 'uppercase' }}>{it.result}</td>
                    <td style={{ color: 'var(--mist)' }}>{it.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="auth-button" style={{ width: 'auto', marginTop: 12 }} onClick={() => setViewing(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
