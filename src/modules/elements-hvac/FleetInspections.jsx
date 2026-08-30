// Elements-HVAC · Fleet · Inspections (DVIR-style; failed items open repair issues)
// Adds: an org-editable checklist (add your own items — housekeeping, wash, etc.)
// and a periodic due-flag per vehicle (time OR miles, whichever comes first).
import { useState, useEffect } from 'react'
import {
  listVehicles, latestOdometersByVehicle, todayStr, DEFAULT_CHECKLIST,
  listInspections, getInspectionItems, createInspection, FLAG_COLORS,
} from './fleetData'
import { useOrgSelector, OrgBar } from './shared'
import {
  listTemplate, addTemplateItem, removeTemplateItem,
  getSettings, saveSettings, lastInspectionsByVehicle, inspectionDue,
} from './fleetInspectData'

const dueColor = (state) => (state === 'overdue' ? FLAG_COLORS.red : state === 'due_soon' ? FLAG_COLORS.amber : '#16A34A')
const DuePill = ({ st }) => (
  <span style={{ background: dueColor(st.state), color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.label}</span>
)

export default function FleetInspections({ profile }) {
  const org = useOrgSelector(profile)
  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [odoMap, setOdoMap] = useState({})
  const [inspections, setInspections] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [header, setHeader] = useState({ inspection_type: 'periodic', inspection_date: todayStr(), odometer: '', notes: '' })
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [viewing, setViewing] = useState(null) // {inspection, items}

  // configuration
  const [template, setTemplate] = useState([])
  const [lastMap, setLastMap] = useState({})
  const [settings, setSettings] = useState(null)
  const [showManage, setShowManage] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [cfgForm, setCfgForm] = useState({ interval_days: '', interval_miles: '', due_soon_days: '', due_soon_miles: '' })
  const [busy, setBusy] = useState('')

  // Active checklist labels: the org template, or the built-in default when none.
  const checklistLabels = template.length ? template.map((t) => t.label) : DEFAULT_CHECKLIST
  const freshChecklist = () => checklistLabels.map((label) => ({ label, result: 'pass', note: '' }))

  async function loadAll() {
    if (!org.selectedOrg) return
    const [v, odo, tmpl, st, last] = await Promise.all([
      listVehicles(org.selectedOrg), latestOdometersByVehicle(org.selectedOrg),
      listTemplate(org.selectedOrg), getSettings(org.selectedOrg), lastInspectionsByVehicle(org.selectedOrg),
    ])
    setVehicles(v); setOdoMap(odo); setTemplate(tmpl); setSettings(st); setLastMap(last)
    setCfgForm({
      interval_days: st.interval_days ?? '', interval_miles: st.interval_miles ?? '',
      due_soon_days: st.due_soon_days ?? 14, due_soon_miles: st.due_soon_miles ?? 500,
    })
    if (!vehicleId && v[0]) setVehicleId(v[0].id)
  }
  useEffect(() => { loadAll() }, [org.selectedOrg]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadInspections() {
    if (!org.selectedOrg || !vehicleId) { setInspections([]); return }
    setInspections(await listInspections(org.selectedOrg, vehicleId))
  }
  useEffect(() => { loadInspections() }, [org.selectedOrg, vehicleId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    loadAll(); loadInspections()
  }

  async function view(insp) {
    const its = await getInspectionItems(insp.id)
    setViewing({ inspection: insp, items: its })
  }

  // ---- checklist template management ----
  async function addItem() {
    if (!newItem.trim()) return
    setBusy('additem')
    await addTemplateItem(org.selectedOrg, newItem, template.length)
    setNewItem(''); setBusy('')
    setTemplate(await listTemplate(org.selectedOrg))
  }
  async function seedFromDefault() {
    setBusy('seed')
    for (let i = 0; i < DEFAULT_CHECKLIST.length; i++) await addTemplateItem(org.selectedOrg, DEFAULT_CHECKLIST[i], i)
    setBusy('')
    setTemplate(await listTemplate(org.selectedOrg))
  }
  async function removeItem(id) {
    await removeTemplateItem(id)
    setTemplate(await listTemplate(org.selectedOrg))
  }

  // ---- cadence settings ----
  async function saveCfg() {
    setBusy('cfg')
    const { error } = await saveSettings(org.selectedOrg, cfgForm)
    setBusy('')
    if (error) { setMsg(error.message); return }
    setSettings(await getSettings(org.selectedOrg))
    setShowSchedule(false)
  }

  const failedCount = items.filter((i) => i.result === 'fail').length
  const currentDue = settings ? inspectionDue(lastMap[vehicleId], settings, currentOdo) : null

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><h2>Inspections</h2></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => { setShowManage(!showManage); setShowSchedule(false) }}>{showManage ? 'Done' : 'Manage checklist'}</button>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => { setShowSchedule(!showSchedule); setShowManage(false) }}>{showSchedule ? 'Done' : 'Schedule'}</button>
        </div>
      </div>
      <OrgBar {...org} />

      {/* ---- Manage checklist ---- */}
      {showManage && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <h3 style={{ marginTop: 0 }}>Inspection checklist</h3>
          {template.length === 0 ? (
            <div>
              <p style={{ color: 'var(--mist)', marginTop: 0 }}>You're using the built-in standard list. Copy it here to customize — add your own items (Tech housekeeping, tire wear, exterior wash, tune-up…) or remove ones you don't use.</p>
              <ul style={{ color: 'var(--mist)', margin: '0 0 12px 18px' }}>{DEFAULT_CHECKLIST.map((l) => <li key={l}>{l}</li>)}</ul>
              <button className="auth-button" style={{ width: 'auto' }} disabled={busy === 'seed'} onClick={seedFromDefault}>{busy === 'seed' ? 'Copying…' : 'Copy standard list to customize'}</button>
            </div>
          ) : (
            <div>
              <table className="data-table" style={{ marginBottom: 10 }}>
                <tbody>
                  {template.map((t) => (
                    <tr key={t.id}><td>{t.label}</td><td style={{ width: 90, textAlign: 'right' }}><button className="logout-button" onClick={() => removeItem(t.id)}>Remove</button></td></tr>
                  ))}
                </tbody>
              </table>
              <div className="inline-form">
                <div className="field" style={{ minWidth: 240 }}><label>Add item</label><input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="e.g. Tech housekeeping / exterior wash" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }} /></div>
                <button className="auth-button" style={{ width: 'auto' }} disabled={busy === 'additem' || !newItem.trim()} onClick={addItem}>Add</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Schedule / cadence ---- */}
      {showSchedule && settings && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <h3 style={{ marginTop: 0 }}>When to flag a full inspection as due</h3>
          <p style={{ color: 'var(--mist)', marginTop: 0 }}>A vehicle is flagged when it passes <strong>either</strong> the time or the mileage limit since its last inspection — whichever comes first. Leave a field blank to ignore that trigger.</p>
          <div className="inline-form" style={{ flexWrap: 'wrap' }}>
            <div className="field" style={{ width: 150 }}><label>Every (days)</label><input type="number" value={cfgForm.interval_days} onChange={(e) => setCfgForm({ ...cfgForm, interval_days: e.target.value })} placeholder="e.g. 90" /></div>
            <div className="field" style={{ width: 150 }}><label>Every (miles)</label><input type="number" value={cfgForm.interval_miles} onChange={(e) => setCfgForm({ ...cfgForm, interval_miles: e.target.value })} placeholder="e.g. 5000" /></div>
            <div className="field" style={{ width: 150 }}><label>Warn (days before)</label><input type="number" value={cfgForm.due_soon_days} onChange={(e) => setCfgForm({ ...cfgForm, due_soon_days: e.target.value })} /></div>
            <div className="field" style={{ width: 150 }}><label>Warn (miles before)</label><input type="number" value={cfgForm.due_soon_miles} onChange={(e) => setCfgForm({ ...cfgForm, due_soon_miles: e.target.value })} /></div>
            <button className="auth-button" style={{ width: 'auto' }} disabled={busy === 'cfg'} onClick={saveCfg}>{busy === 'cfg' ? 'Saving…' : 'Save schedule'}</button>
          </div>
        </div>
      )}

      {/* ---- Due status per vehicle ---- */}
      {settings && vehicles.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 8px' }}>Inspection status</h3>
          <table className="data-table">
            <thead><tr><th>Vehicle</th><th>Last inspection</th><th>Since</th><th>Status</th></tr></thead>
            <tbody>
              {vehicles.map((v) => {
                const last = lastMap[v.id]
                const st = inspectionDue(last, settings, odoMap[v.id] ?? null)
                return (
                  <tr key={v.id}>
                    <td>{v.name}</td>
                    <td>{last ? last.inspection_date : <span style={{ color: 'var(--mist)' }}>—</span>}</td>
                    <td style={{ color: 'var(--mist)' }}>{last ? st.detail : '—'}</td>
                    <td><DuePill st={st} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="field" style={{ maxWidth: 300, marginBottom: 0 }}>
          <label>Vehicle</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">— select —</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        {vehicleId && currentDue && <div style={{ marginBottom: 6 }}><DuePill st={currentDue} /></div>}
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
                <tr key={it.label + idx}>
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
