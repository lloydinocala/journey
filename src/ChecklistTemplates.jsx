import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const EQUIPMENT = [
  { value: '', label: 'Any equipment' },
  { value: 'gas_furnace', label: 'Gas Furnace' },   // gas furnace + AC
  { value: 'split_system', label: 'Split System' },  // all-electric: heat pump or AC
  { value: 'package', label: 'Package Unit' },
  { value: 'mini_split', label: 'Mini-Split' },
]
const equipLabel = (v) => (EQUIPMENT.find((e) => e.value === (v || '')) || {}).label || v || 'Any'

// The five routing flags: what the app does with the tech's finding on this item.
const FLAGS = [
  { key: 'add_to_estimate', short: 'Estimate', title: 'Add to repair Estimate', color: '#2F5DE3' },
  { key: 'add_to_report', short: 'Report', title: 'Add to customer Report', color: '#1F7A43' },
  { key: 'system_health', short: 'Health', title: 'Feed System Health score', color: '#0E7C86' },
  { key: 'create_system_estimate', short: 'Sys Est', title: 'Create a new-System Estimate', color: '#C8811B' },
  { key: 'red_tag', short: 'Red Tag', title: 'Red-tag the unit (safety)', color: '#C0392B' },
]
const boolOf = (v) => { const s = String(v ?? '').trim().toLowerCase(); return s === 'true' || s === '1' || s === 'x' || s === 'yes' || s === 'y' || s === '✓' || s === 'checked' }

function guessEquip(title) {
  const t = (title || '').toLowerCase()
  if (t.includes('furnace')) return 'gas_furnace'
  if (t.includes('mini')) return 'mini_split'
  if (t.includes('package')) return 'package'
  if (t.includes('heat pump') || t.includes('split') || t.includes('condenser') || t.includes(' ac')) return 'split_system'
  return ''
}

// Parse an Excel/CSV in the Checklist layout -> { title, equipment_type, sections:[{name, items:[…]}] }
async function parseChecklistFile(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
  let title = '', headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const r = (rows[i] || []).map((c) => String(c ?? '').trim())
    if (r.join('|').toLowerCase().includes('inspection task')) { headerIdx = i; break }
    if (!title && r.filter(Boolean).length === 1 && r[0]) title = r[0]
  }
  if (headerIdx === -1) throw new Error('Could not find an "Inspection Task" header row in the file.')
  const hdr = (rows[headerIdx] || []).map((c) => String(c ?? '').trim().toLowerCase())
  const col = (needle) => hdr.findIndex((h) => h.includes(needle))
  const ci = col('inspection'), cm = col('maintenance')
  const cEst = col('add to estimate'), cRep = col('add to report'), cHea = col('system health'), cSys = col('create system'), cRed = col('red')
  if (ci < 0) throw new Error('No "Inspection Task" column found.')
  const sections = []; let cur = null
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const insp = String(r[ci] ?? '').trim()
    if (!insp) continue
    const maint = cm >= 0 ? String(r[cm] ?? '').trim() : ''
    const hasFlags = [cEst, cRep, cHea, cSys, cRed].some((idx) => idx >= 0 && String(r[idx] ?? '').trim() !== '')
    if (!maint && !hasFlags) { cur = { name: insp, items: [] }; sections.push(cur); continue }
    if (!cur) { cur = { name: 'General', items: [] }; sections.push(cur) }
    cur.items.push({
      inspection_task: insp, maintenance_task: maint || null,
      add_to_estimate: cEst >= 0 && boolOf(r[cEst]),
      add_to_report: cRep >= 0 ? boolOf(r[cRep]) : true,
      system_health: cHea >= 0 && boolOf(r[cHea]),
      create_system_estimate: cSys >= 0 && boolOf(r[cSys]),
      red_tag: cRed >= 0 && boolOf(r[cRed]),
    })
  }
  if (!sections.length) throw new Error('No items found under the header row.')
  return { title: title || file.name.replace(/\.[^.]+$/, ''), equipment_type: guessEquip(title), sections }
}

export default function ChecklistTemplates({ profile }) {
  const isSuper = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [checklists, setChecklists] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)     // checklist row being edited
  const [sections, setSections] = useState([])
  const [items, setItems] = useState([])           // flat; each has section_id
  const [importMsg, setImportMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => { setOrgs(data || []); if (!selectedOrg && data?.length) setSelectedOrg(data[0].id) }) }, [])
  useEffect(() => { if (selectedOrg) loadList() }, [selectedOrg])

  async function loadList() {
    setLoading(true)
    const { data } = await supabase.from('checklists').select('id, name, equipment_type, is_active, checklist_items(count)').eq('org_id', selectedOrg).order('sort_order').order('name')
    setChecklists(data || []); setLoading(false)
  }

  async function openEditor(cl) {
    const [{ data: secs }, { data: its }] = await Promise.all([
      supabase.from('checklist_sections').select('*').eq('checklist_id', cl.id).order('sort_order'),
      supabase.from('checklist_items').select('*').eq('checklist_id', cl.id).order('sort_order'),
    ])
    setSections(secs || []); setItems(its || []); setEditing(cl)
  }

  async function newChecklist() {
    const { data } = await supabase.from('checklists').insert({ org_id: selectedOrg, name: 'New Checklist' }).select().single()
    if (data) { setSections([]); setItems([]); setEditing(data); loadList() }
  }

  async function onImport(e) {
    const file = e.target.files[0]; e.target.value = ''
    if (!file || !selectedOrg) return
    setBusy(true); setImportMsg('')
    try {
      const parsed = await parseChecklistFile(file)
      const { data: cl } = await supabase.from('checklists').insert({ org_id: selectedOrg, name: parsed.title, equipment_type: parsed.equipment_type || null }).select().single()
      let so = 0, io = 0
      for (const sec of parsed.sections) {
        const { data: s } = await supabase.from('checklist_sections').insert({ org_id: selectedOrg, checklist_id: cl.id, name: sec.name, sort_order: so++ }).select().single()
        if (sec.items.length) {
          await supabase.from('checklist_items').insert(sec.items.map((it) => ({ org_id: selectedOrg, checklist_id: cl.id, section_id: s.id, sort_order: io++, ...it })))
        }
      }
      setImportMsg(`Imported "${parsed.title}" — ${parsed.sections.length} sections, ${parsed.sections.reduce((n, s) => n + s.items.length, 0)} items.`)
      await loadList(); openEditor(cl)
    } catch (err) { setImportMsg('Import failed: ' + (err.message || err)) }
    setBusy(false)
  }

  // ---- editor mutations (optimistic local + DB) ----
  const patchChecklist = (field, val) => { setEditing((c) => ({ ...c, [field]: val })); supabase.from('checklists').update({ [field]: val, updated_at: new Date().toISOString() }).eq('id', editing.id).then(() => {}) }
  async function addSection() {
    const { data } = await supabase.from('checklist_sections').insert({ org_id: selectedOrg, checklist_id: editing.id, name: 'New Section', sort_order: sections.length }).select().single()
    if (data) setSections((s) => [...s, data])
  }
  const patchSection = (id, name) => { setSections((s) => s.map((x) => x.id === id ? { ...x, name } : x)); supabase.from('checklist_sections').update({ name }).eq('id', id).then(() => {}) }
  async function delSection(id) {
    if (!window.confirm('Delete this section and its items?')) return
    await supabase.from('checklist_sections').delete().eq('id', id)
    setSections((s) => s.filter((x) => x.id !== id)); setItems((i) => i.filter((x) => x.section_id !== id))
  }
  async function addItem(sectionId) {
    const n = items.filter((i) => i.section_id === sectionId).length
    const { data } = await supabase.from('checklist_items').insert({ org_id: selectedOrg, checklist_id: editing.id, section_id: sectionId, sort_order: n, inspection_task: '', add_to_report: true }).select().single()
    if (data) setItems((i) => [...i, data])
  }
  const patchItem = (id, field, val) => { setItems((its) => its.map((x) => x.id === id ? { ...x, [field]: val } : x)); supabase.from('checklist_items').update({ [field]: val }).eq('id', id).then(() => {}) }
  async function delItem(id) { await supabase.from('checklist_items').delete().eq('id', id); setItems((i) => i.filter((x) => x.id !== id)) }
  async function delChecklist(cl) {
    if (!window.confirm(`Delete checklist "${cl.name}"? This cannot be undone.`)) return
    await supabase.from('checklists').delete().eq('id', cl.id); setEditing(null); loadList()
  }

  // ---------------- EDITOR VIEW ----------------
  if (editing) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <button className="logout-button" onClick={() => { setEditing(null); loadList() }} style={{ marginBottom: 14 }}>‹ All checklists</button>
        <div className="section-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 240 }}>
              <label>Checklist name</label>
              <input value={editing.name} onChange={(e) => patchChecklist('name', e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Equipment</label>
              <select value={editing.equipment_type || ''} onChange={(e) => patchChecklist('equipment_type', e.target.value || null)}>
                {EQUIPMENT.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, marginBottom: 8 }}>
              <input type="checkbox" checked={editing.is_active} onChange={(e) => patchChecklist('is_active', e.target.checked)} /> Active
            </label>
            <button className="remove-item-btn" style={{ marginBottom: 6 }} onClick={() => delChecklist(editing)}>Delete</button>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 10 }}>
            Flags route the tech’s finding: {FLAGS.map((f) => f.short).join(' · ')}. Set item type to <b>Measure</b> to capture a reading (amp draw, superheat…) with units + nameplate spec.
          </div>
        </div>

        {sections.map((sec) => (
          <div key={sec.id} className="section-card" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <input value={sec.name} onChange={(e) => patchSection(sec.id, e.target.value)} style={{ fontWeight: 700, fontSize: 15, flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8 }} />
              <button className="logout-button" style={{ fontSize: 12 }} onClick={() => addItem(sec.id)}>+ Item</button>
              <button className="remove-item-btn" onClick={() => delSection(sec.id)}>Delete section</button>
            </div>
            {items.filter((i) => i.section_id === sec.id).map((it) => (
              <div key={it.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <input value={it.inspection_task || ''} onChange={(e) => patchItem(it.id, 'inspection_task', e.target.value)} placeholder="Inspection Task — what to check" style={{ width: '100%', fontWeight: 600, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, boxSizing: 'border-box', marginBottom: 6 }} />
                <input value={it.maintenance_task || ''} onChange={(e) => patchItem(it.id, 'maintenance_task', e.target.value || null)} placeholder="Maintenance Task — what to do (or a note)" style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, boxSizing: 'border-box', marginBottom: 8, fontSize: 14 }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={it.item_type} onChange={(e) => patchItem(it.id, 'item_type', e.target.value)} style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                    <option value="check">Checkbox</option>
                    <option value="measure">Measure</option>
                  </select>
                  {it.item_type === 'measure' && (
                    <>
                      <input value={it.record_units || ''} onChange={(e) => patchItem(it.id, 'record_units', e.target.value || null)} placeholder="Units (Amps, °F…)" style={{ width: 120, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                      <input value={it.spec_label || ''} onChange={(e) => patchItem(it.id, 'spec_label', e.target.value || null)} placeholder="Spec (RLA/FLA…)" style={{ width: 130, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
                    </>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                    {FLAGS.map((f) => (
                      <button key={f.key} type="button" onClick={() => patchItem(it.id, f.key, !it[f.key])} title={f.title}
                        style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 9px', borderRadius: 999, cursor: 'pointer', border: `1.5px solid ${it[f.key] ? f.color : 'var(--border)'}`, background: it[f.key] ? f.color : '#fff', color: it[f.key] ? '#fff' : 'var(--mist)' }}>
                        {f.short}
                      </button>
                    ))}
                    <button className="remove-item-btn" onClick={() => delItem(it.id)} title="Delete item">✕</button>
                  </div>
                </div>
              </div>
            ))}
            {items.filter((i) => i.section_id === sec.id).length === 0 && <div style={{ fontSize: 13, color: 'var(--mist)' }}>No items yet — add one.</div>}
          </div>
        ))}
        <button className="auth-button" style={{ width: 'auto' }} onClick={addSection}>+ Add section</button>
      </div>
    )
  }

  // ---------------- LIST VIEW ----------------
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header-bar"><h2>Checklists</h2></div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 4, marginBottom: 16, maxWidth: 700 }}>
        Build the checklists your techs follow on the job — grouped into sections, each item with an inspection task, a maintenance task, and routing flags. Import from Excel/CSV, or build by hand.
      </p>
      {isSuper && (
        <div style={{ marginBottom: 16, maxWidth: 340 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="auth-button" style={{ width: 'auto' }} onClick={newChecklist}>+ New checklist</button>
        <label className="logout-button" style={{ cursor: 'pointer' }}>
          {busy ? 'Importing…' : 'Import from Excel / CSV'}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onImport} disabled={busy} style={{ display: 'none' }} />
        </label>
        {importMsg && <span style={{ fontSize: 13, color: importMsg.startsWith('Import failed') ? '#b0342f' : '#1a7f37' }}>{importMsg}</span>}
      </div>

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : checklists.length === 0 ? (
        <div className="section-card" style={{ padding: 18 }}><p style={{ margin: 0 }}>No checklists yet. Import your Excel or create one.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {checklists.map((cl) => (
            <div key={cl.id} className="section-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{cl.name} {!cl.is_active && <span style={{ fontSize: 12, color: 'var(--mist)' }}>(inactive)</span>}</div>
                <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{equipLabel(cl.equipment_type)} · {cl.checklist_items?.[0]?.count ?? 0} items</div>
              </div>
              <button className="logout-button" onClick={() => openEditor(cl)}>Edit</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
