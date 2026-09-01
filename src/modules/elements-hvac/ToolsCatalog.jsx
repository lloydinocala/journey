// Tools Management · Tool Catalog
// Add tools and run their lifecycle inline (assign to shop/truck/tech, inspect,
// send to maintenance, view history, retire) — mirrors the FleetVehicles pattern.
import { useState, useEffect, Fragment } from 'react'
import {
  listTools, addTool, updateTool, retireTool, assignTool, addInspection, sendToMaintenance,
  listToolAssignments, listToolInspections, toolLabel,
} from './toolsData'
import { listVehicles } from './fleetData'
import { listTechnicians } from './data'
import { useOrgSelector, OrgBar } from './shared'

const today = () => new Date().toISOString().slice(0, 10)
const blank = { name: '', brand: '', is_hand_tool: false, model_no: '', serial_no: '', purchase_date: '', cost: '', maintenance_requirements: '' }
const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const CONDITIONS = [
  { v: 'good', label: 'Good' },
  { v: 'fair', label: 'Fair' },
  { v: 'needs_maintenance', label: 'Needs maintenance' },
  { v: 'out_of_service', label: 'Out of service' },
]

export default function ToolsCatalog({ profile }) {
  const org = useOrgSelector(profile)
  const [tools, setTools] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [techs, setTechs] = useState([])
  const [showRetired, setShowRetired] = useState(false)
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [rowMode, setRowMode] = useState({ id: null, mode: null }) // mode: assign | inspect | maint | history
  const [assignForm, setAssignForm] = useState({ holder_type: 'shop', holder_id: '', note: '' })
  const [inspectForm, setInspectForm] = useState({ condition: 'good', needs_maintenance: false, notes: '' })
  const [maintForm, setMaintForm] = useState({ description: '' })
  const [hist, setHist] = useState({ assignments: [], inspections: [] })
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    const [t, v, tech] = await Promise.all([
      listTools(org.selectedOrg, { includeRetired: showRetired }),
      listVehicles(org.selectedOrg),
      listTechnicians(org.selectedOrg),
    ])
    setTools(t); setVehicles(v); setTechs(tech)
  }
  useEffect(() => { load() }, [org.selectedOrg, showRetired])

  const vehName = (id) => vehicles.find((x) => x.id === id)?.name || 'truck'
  const techName = (id) => techs.find((x) => x.id === id)?.full_name || 'tech'
  const holderText = (t) => t.holder_type === 'shop' ? 'Shop'
    : t.holder_type === 'truck' ? vehName(t.holder_id)
    : t.holder_type === 'tech' ? techName(t.holder_id) : '—'
  const statusText = (t) => t.status === 'in_shop' ? 'In shop' : t.status === 'assigned' ? 'Assigned' : t.status === 'in_maintenance' ? 'In maintenance' : 'Retired'

  // Live "Reclaimer 2" preview while adding a new identical-named tool.
  const dupePreview = (() => {
    if (editingId || !form.name.trim()) return null
    const n = form.name.trim().toLowerCase()
    const count = tools.filter((t) => (t.name || '').trim().toLowerCase() === n).length
    return count >= 1 ? `${form.name.trim()} ${count + 1}` : null
  })()

  function startNew() { setEditingId(null); setForm(blank); setShowForm(true); setError('') }
  function startEdit(t) {
    setEditingId(t.id)
    setForm({
      name: t.name || '', brand: t.brand || '', is_hand_tool: !!t.is_hand_tool,
      model_no: t.model_no || '', serial_no: t.serial_no || '',
      purchase_date: t.purchase_date || '', cost: t.cost ?? '', maintenance_requirements: t.maintenance_requirements || '',
    })
    setShowForm(true); setError('')
  }
  function cancelForm() { setEditingId(null); setForm(blank); setShowForm(false); setError('') }

  async function handleSubmit(e) {
    e.preventDefault(); setError('')
    if (!form.name.trim()) { setError('Name / description is required.'); return }
    setSaving(true)
    const num = (x) => (x === '' || x == null ? null : Number(x))
    const payload = {
      name: form.name.trim(), brand: form.brand.trim() || null, is_hand_tool: form.is_hand_tool,
      model_no: form.is_hand_tool ? null : (form.model_no.trim() || null),
      serial_no: form.is_hand_tool ? null : (form.serial_no.trim() || null),
      purchase_date: form.purchase_date || null, cost: num(form.cost),
      maintenance_requirements: form.maintenance_requirements.trim() || null,
    }
    const err = editingId ? (await updateTool(editingId, payload)).error : (await addTool(org.selectedOrg, payload)).error
    setSaving(false)
    if (err) { setError(err.message); return }
    cancelForm(); load()
  }

  function openRow(t, mode) {
    setRowMode({ id: t.id, mode })
    if (mode === 'assign') setAssignForm({ holder_type: t.holder_type || 'shop', holder_id: t.holder_id || '', note: '' })
    if (mode === 'inspect') setInspectForm({ condition: 'good', needs_maintenance: false, notes: '' })
    if (mode === 'maint') setMaintForm({ description: '' })
    if (mode === 'history') loadHistory(t.id)
  }
  const closeRow = () => setRowMode({ id: null, mode: null })

  async function loadHistory(toolId) {
    const [a, i] = await Promise.all([listToolAssignments(org.selectedOrg, toolId), listToolInspections(org.selectedOrg, toolId)])
    setHist({ assignments: a, inspections: i })
  }

  async function saveAssign(t) {
    setBusy(true)
    const hid = assignForm.holder_type === 'shop' ? null : (assignForm.holder_id || null)
    await assignTool(org.selectedOrg, t.id, assignForm.holder_type, hid, assignForm.note)
    setBusy(false); closeRow(); load()
  }
  async function saveInspect(t) {
    setBusy(true)
    const needs = inspectForm.needs_maintenance || inspectForm.condition === 'needs_maintenance' || inspectForm.condition === 'out_of_service'
    await addInspection(org.selectedOrg, {
      tool_id: t.id, inspected_by: profile?.id || null, condition: inspectForm.condition,
      needs_maintenance: needs, notes: inspectForm.notes.trim() || null,
    })
    setBusy(false); closeRow(); load()
  }
  async function saveMaint(t) {
    setBusy(true)
    await sendToMaintenance(org.selectedOrg, t.id, maintForm.description.trim() || null)
    setBusy(false); closeRow(); load()
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Tool Catalog</h2>
          <span className="badge">{tools.length} shown</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => (showForm ? cancelForm() : startNew())}>
          {showForm ? 'Cancel' : '+ New Tool'}
        </button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form className="inline-form" onSubmit={handleSubmit} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          {editingId && <div style={{ flexBasis: '100%', fontWeight: 700, color: '#1B3A6B' }}>Editing {form.name || 'tool'}</div>}
          <div className="field" style={{ minWidth: 220 }}>
            <label>Name / description</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Reclaimer" required />
            {dupePreview && <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 4 }}>Will be recorded as <strong>{dupePreview}</strong> (identical name already on file).</div>}
          </div>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Brand</label>
            <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Appion" />
          </div>
          <div className="field" style={{ minWidth: 150, justifyContent: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_hand_tool} onChange={(e) => setForm({ ...form, is_hand_tool: e.target.checked })} />
              Hand tool (no model / serial)
            </label>
          </div>
          {!form.is_hand_tool && (
            <>
              <div className="field" style={{ minWidth: 150 }}><label>Model No.</label><input type="text" value={form.model_no} onChange={(e) => setForm({ ...form, model_no: e.target.value })} /></div>
              <div className="field" style={{ minWidth: 150 }}><label>Serial No.</label><input type="text" value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value })} /></div>
            </>
          )}
          <div className="field" style={{ width: 150 }}><label>Purchase date</label><input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
          <div className="field" style={{ width: 120 }}><label>Cost</label><input type="number" step="any" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0.00" /></div>
          <div className="field" style={{ minWidth: 240, flex: 1 }}><label>Maintenance requirements (notes)</label><input type="text" value={form.maintenance_requirements} onChange={(e) => setForm({ ...form, maintenance_requirements: e.target.value })} placeholder="e.g. oil vacuum pump every 50 hrs" /></div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : (editingId ? 'Save changes' : 'Add tool')}</button>
        </form>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, maxWidth: 760 }}>
        Tools flow like inventory: received by the shop, assigned to a truck or tech, then inspected on-demand.
        <strong> A natural time to inspect is during that vehicle&apos;s regular inventory cycle.</strong> If an
        inspection flags a problem, send the tool to the shop — it must be repaired and verified before it can be redeployed.
      </p>

      <label className="nav-link" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 12 }}>
        <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} style={{ marginRight: 6 }} />
        Show retired
      </label>

      <table className="data-table">
        <thead>
          <tr><th></th><th>Tool</th><th>Brand</th><th>Model / Serial</th><th>Status</th><th>Location</th><th>Purchased</th><th>Cost</th></tr>
        </thead>
        <tbody>
          {tools.map((t) => {
            const blocked = t.needs_maintenance || t.status === 'in_maintenance'
            const open = rowMode.id === t.id ? rowMode.mode : null
            return (
              <Fragment key={t.id}>
                <tr style={t.needs_maintenance ? { background: '#FCEFEF' } : undefined}>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="logout-button" onClick={() => startEdit(t)}>Edit</button>
                    <button className="logout-button" onClick={() => openRow(t, 'assign')}>Assign</button>
                    <button className="logout-button" onClick={() => openRow(t, 'inspect')}>Inspect</button>
                    {t.status !== 'in_maintenance' && <button className="logout-button" onClick={() => openRow(t, 'maint')}>To Shop</button>}
                    <button className="logout-button" onClick={() => openRow(t, 'history')}>History</button>
                    {t.status !== 'retired' && <button className="logout-button" onClick={async () => { if (confirm('Retire this tool? It will be hidden from the active list.')) { await retireTool(t.id, 'retired'); load() } }}>Retire</button>}
                  </td>
                  <td>
                    <strong>{toolLabel(t, tools)}</strong>
                    {t.is_hand_tool && <span className="badge" style={{ marginLeft: 6 }}>Hand tool</span>}
                    {t.needs_maintenance && <span className="badge" style={{ marginLeft: 6, background: '#B00020', color: '#fff' }}>Needs maintenance</span>}
                  </td>
                  <td style={{ color: 'var(--mist)' }}>{t.brand || '—'}</td>
                  <td style={{ color: 'var(--mist)' }}>{t.is_hand_tool ? '— hand tool —' : [t.model_no, t.serial_no].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{statusText(t)}</td>
                  <td>{holderText(t)}</td>
                  <td style={{ color: 'var(--mist)' }}>{t.purchase_date || '—'}</td>
                  <td>{money(t.cost)}</td>
                </tr>

                {open === 'assign' && (
                  <tr><td colSpan="8" style={{ background: '#EEF3FB' }}>
                    <div style={{ padding: '6px 2px' }}>
                      {blocked ? (
                        <div style={{ color: '#B00020', fontWeight: 600 }}>
                          This tool is flagged for maintenance. Resolve and verify the repair (Maintenance page) before redeploying it.
                          <button className="logout-button" style={{ marginLeft: 10 }} onClick={closeRow}>Close</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div className="field" style={{ marginBottom: 0, minWidth: 140 }}>
                            <label>Assign to</label>
                            <select value={assignForm.holder_type} onChange={(e) => setAssignForm({ ...assignForm, holder_type: e.target.value, holder_id: '' })}>
                              <option value="shop">Shop</option>
                              <option value="truck">Truck</option>
                              <option value="tech">Technician</option>
                            </select>
                          </div>
                          {assignForm.holder_type === 'truck' && (
                            <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
                              <label>Which truck</label>
                              <select value={assignForm.holder_id} onChange={(e) => setAssignForm({ ...assignForm, holder_id: e.target.value })}>
                                <option value="">— select —</option>
                                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                              </select>
                            </div>
                          )}
                          {assignForm.holder_type === 'tech' && (
                            <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
                              <label>Which technician</label>
                              <select value={assignForm.holder_id} onChange={(e) => setAssignForm({ ...assignForm, holder_id: e.target.value })}>
                                <option value="">— select —</option>
                                {techs.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
                              </select>
                            </div>
                          )}
                          <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
                            <label>Note (optional)</label>
                            <input type="text" value={assignForm.note} onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })} />
                          </div>
                          <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy || (assignForm.holder_type !== 'shop' && !assignForm.holder_id)} onClick={() => saveAssign(t)}>Save</button>
                          <button className="logout-button" onClick={closeRow}>Cancel</button>
                        </div>
                      )}
                    </div>
                  </td></tr>
                )}

                {open === 'inspect' && (
                  <tr><td colSpan="8" style={{ background: '#F7F9FC' }}>
                    <div style={{ padding: '6px 2px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="field" style={{ marginBottom: 0, minWidth: 170 }}>
                        <label>Condition</label>
                        <select value={inspectForm.condition} onChange={(e) => setInspectForm({ ...inspectForm, condition: e.target.value })}>
                          {CONDITIONS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                        </select>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <input type="checkbox" checked={inspectForm.needs_maintenance} onChange={(e) => setInspectForm({ ...inspectForm, needs_maintenance: e.target.checked })} />
                        Needs maintenance
                      </label>
                      <div className="field" style={{ marginBottom: 0, minWidth: 260, flex: 1 }}>
                        <label>Condition notes / repairs needed</label>
                        <input type="text" value={inspectForm.notes} onChange={(e) => setInspectForm({ ...inspectForm, notes: e.target.value })} placeholder="e.g. frayed cord — replace before next use" />
                      </div>
                      <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={() => saveInspect(t)}>Save inspection</button>
                      <button className="logout-button" onClick={closeRow}>Cancel</button>
                      <div style={{ flexBasis: '100%', fontSize: 12, color: 'var(--mist)' }}>Tip: a good time to inspect is during this vehicle&apos;s regular inventory cycle count.</div>
                    </div>
                  </td></tr>
                )}

                {open === 'maint' && (
                  <tr><td colSpan="8" style={{ background: '#FFF7ED' }}>
                    <div style={{ padding: '6px 2px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="field" style={{ marginBottom: 0, minWidth: 300, flex: 1 }}>
                        <label>Send to shop for maintenance — what&apos;s needed?</label>
                        <input type="text" value={maintForm.description} onChange={(e) => setMaintForm({ description: e.target.value })} placeholder="Describe the repair needed" />
                      </div>
                      <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={() => saveMaint(t)}>Send to shop</button>
                      <button className="logout-button" onClick={closeRow}>Cancel</button>
                      <div style={{ flexBasis: '100%', fontSize: 12, color: 'var(--mist)' }}>Pulls the tool off its truck/tech and into the shop. Verify the repair on the Maintenance page before redeploying.</div>
                    </div>
                  </td></tr>
                )}

                {open === 'history' && (
                  <tr><td colSpan="8" style={{ background: '#F7F9FC' }}>
                    <div style={{ padding: '6px 2px', display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                      <div>
                        <strong style={{ fontSize: 13 }}>Assignment history</strong>
                        {hist.assignments.length === 0 ? <div style={{ color: 'var(--mist)', fontSize: 13 }}>None.</div> : (
                          <table style={{ marginTop: 6 }}><tbody>
                            {hist.assignments.map((a) => (
                              <tr key={a.id}>
                                <td style={{ paddingRight: 16, fontSize: 13 }}>{a.holder_type === 'shop' ? 'Shop' : a.holder_type === 'truck' ? vehName(a.holder_id) : techName(a.holder_id)}</td>
                                <td style={{ paddingRight: 16, fontSize: 13, color: 'var(--mist)' }}>{new Date(a.started_at).toLocaleDateString()}{a.ended_at ? ` → ${new Date(a.ended_at).toLocaleDateString()}` : ' → current'}</td>
                                <td style={{ fontSize: 13, color: 'var(--mist)' }}>{a.note || ''}</td>
                              </tr>
                            ))}
                          </tbody></table>
                        )}
                      </div>
                      <div>
                        <strong style={{ fontSize: 13 }}>Inspections</strong>
                        {hist.inspections.length === 0 ? <div style={{ color: 'var(--mist)', fontSize: 13 }}>None.</div> : (
                          <table style={{ marginTop: 6 }}><tbody>
                            {hist.inspections.map((i) => (
                              <tr key={i.id}>
                                <td style={{ paddingRight: 16, fontSize: 13, color: 'var(--mist)' }}>{new Date(i.inspected_at).toLocaleDateString()}</td>
                                <td style={{ paddingRight: 16, fontSize: 13 }}>{(CONDITIONS.find((c) => c.v === i.condition) || {}).label || i.condition}{i.needs_maintenance ? ' · flagged' : ''}</td>
                                <td style={{ fontSize: 13, color: 'var(--mist)' }}>{i.notes || ''}</td>
                              </tr>
                            ))}
                          </tbody></table>
                        )}
                      </div>
                      <button className="logout-button" style={{ alignSelf: 'flex-start' }} onClick={closeRow}>Close</button>
                    </div>
                  </td></tr>
                )}
              </Fragment>
            )
          })}
          {tools.length === 0 && <tr><td colSpan="8" style={{ color: 'var(--mist)' }}>No tools yet. Add each tool as it&apos;s received by the shop.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
