import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const TYPES = [
  { value: 'maintenance', label: 'Preventive Maintenance' },
  { value: 'sales', label: 'Sales' },
  { value: 'pre_install', label: 'Pre-Install' },
  { value: 'service', label: 'Service Call' },
]
const EQUIPMENT = [
  { value: '', label: 'Any equipment' },
  { value: 'furnace', label: 'Gas Furnace' },
  { value: 'heat_pump', label: 'Heat Pump' },
  { value: 'mini_split', label: 'Mini-Split' },
  { value: 'package', label: 'Package Unit' },
  { value: 'ac', label: 'AC / Split System' },
]
const typeLabel = (v) => (TYPES.find((t) => t.value === v) || {}).label || v
const equipLabel = (v) => (EQUIPMENT.find((e) => e.value === (v || '')) || {}).label || v

export default function ChecklistTemplates({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [openId, setOpenId] = useState(null)

  const [form, setForm] = useState({ name: '', subtitle: '', checklist_type: 'maintenance', equipment_type: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function load(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('checklist_templates')
      .select('id, org_id, name, subtitle, description, checklist_type, equipment_type, offers_enabled, source_template_id, version, sort_order, is_active')
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .order('sort_order')
      .order('name')
    setTemplates(data || [])
    setLoading(false)
  }
  useEffect(() => { load(selectedOrg) }, [selectedOrg])

  const systemTemplates = templates.filter((t) => t.org_id === null && t.is_active)
  const myTemplates = templates.filter((t) => t.org_id === selectedOrg && (showArchived ? !t.is_active : t.is_active))

  async function createTemplate(e) {
    e.preventDefault()
    setErr('')
    if (!form.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('checklist_templates').insert({
      org_id: selectedOrg,
      name: form.name.trim(),
      subtitle: form.subtitle.trim() || null,
      checklist_type: form.checklist_type,
      equipment_type: form.equipment_type || null,
      version: 1,
      sort_order: myTemplates.length,
      is_active: true,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setForm({ name: '', subtitle: '', checklist_type: 'maintenance', equipment_type: '' })
    load(selectedOrg)
  }

  async function cloneSystem(t) {
    if (!window.confirm(`Make an editable copy of "${t.name}" for this organization?`)) return
    const { data: created, error } = await supabase.from('checklist_templates').insert({
      org_id: selectedOrg,
      name: t.name,
      subtitle: t.subtitle,
      description: t.description,
      checklist_type: t.checklist_type,
      equipment_type: t.equipment_type,
      offers_enabled: t.offers_enabled,
      source_template_id: t.id,
      version: t.version,
      sort_order: myTemplates.length,
      is_active: true,
    }).select('id').single()
    if (error) { setErr(error.message); return }
    const { data: items } = await supabase
      .from('checklist_template_items')
      .select('sort_order, label, guidance, requires_photo, recommendation_internal, recommendation_customer')
      .eq('template_id', t.id)
      .eq('is_active', true)
      .order('sort_order')
    if (items && items.length) {
      await supabase.from('checklist_template_items').insert(
        items.map((it) => ({ ...it, template_id: created.id, org_id: selectedOrg, is_active: true }))
      )
    }
    load(selectedOrg)
    setOpenId(created.id)
  }

  async function toggleActive(t) {
    const action = t.is_active ? 'archive' : 'reactivate'
    if (!window.confirm(`${action === 'archive' ? 'Archive' : 'Reactivate'} the "${t.name}" checklist?`)) return
    await supabase.from('checklist_templates').update({ is_active: !t.is_active }).eq('id', t.id)
    load(selectedOrg)
  }

  if (openId) {
    return <TemplateEditor templateId={openId} orgId={selectedOrg} onBack={() => { setOpenId(null); load(selectedOrg) }} />
  }

  return (
    <div>
      <h2 className="page-title">Checklist Templates</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 20 }}>
        Build the checklists your techs run in the field. Start from a system template and make it your own, or create one from scratch. Each completed checklist is saved to the customer's record and emailed to them.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <form className="inline-form" onSubmit={createTemplate} style={{ marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="tName">Checklist name</label>
          <input id="tName" type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Heat Pump Tune-Up" required />
        </div>
        <div className="field" style={{ minWidth: 260 }}>
          <label htmlFor="tSub">Subtitle (credibility line)</label>
          <input id="tSub" type="text" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} placeholder="e.g. Inspection performed to ANSI/ACCA standards" />
        </div>
        <div className="field">
          <label htmlFor="tType">Type</label>
          <select id="tType" value={form.checklist_type} onChange={(e) => setForm((f) => ({ ...f, checklist_type: e.target.value }))}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tEquip">Equipment</label>
          <select id="tEquip" value={form.equipment_type} onChange={(e) => setForm((f) => ({ ...f, equipment_type: e.target.value }))}>
            {EQUIPMENT.map((e2) => <option key={e2.value} value={e2.value}>{e2.label}</option>)}
          </select>
        </div>
        <button className="auth-button" type="submit" disabled={saving}>{saving ? 'Adding…' : 'New checklist'}</button>
      </form>
      {err && <div className="auth-error">{err}</div>}

      <h3 style={{ marginBottom: 6 }}>My checklists</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <label className="nav-link" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} style={{ marginRight: 6 }} />
          Show archived
        </label>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : myTemplates.length === 0 ? (
        <p style={{ color: 'var(--mist)', marginBottom: 28 }}>No checklists yet. Create one above, or copy a system template below.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
          {myTemplates.map((t) => (
            <div key={t.id} style={{ border: '1px solid var(--line, #E2E6ED)', borderRadius: 8, padding: '12px 16px', background: 'var(--panel)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.name}{t.offers_enabled && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#0F6E56', background: '#E1F5EE', padding: '1px 6px', borderRadius: 4 }}>OFFERS ON</span>}</div>
                <div style={{ fontSize: 12, color: 'var(--mist)' }}>{typeLabel(t.checklist_type)} · {equipLabel(t.equipment_type)}{t.source_template_id ? ' · copied from system' : ''}</div>
              </div>
              <div className="grid-actions">
                <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => setOpenId(t.id)}>Edit</button>
                <button className="logout-button" onClick={() => toggleActive(t)}>{t.is_active ? 'Archive' : 'Reactivate'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {systemTemplates.length > 0 && (
        <>
          <h3 style={{ marginBottom: 6 }}>System library</h3>
          <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>Journey's ready-made, standards-backed checklists. Copy one to customize it for your business — the original stays untouched.</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {systemTemplates.map((t) => (
              <div key={t.id} style={{ border: '1px solid var(--line, #E2E6ED)', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--mist)' }}>{typeLabel(t.checklist_type)} · {equipLabel(t.equipment_type)}</div>
                </div>
                <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => cloneSystem(t)}>Copy &amp; customize</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const emptyItem = { label: '', guidance: '', recommendation_internal: '', recommendation_customer: '', requires_photo: false }

function TemplateEditor({ templateId, orgId, onBack }) {
  const [tpl, setTpl] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState(null)
  const [metaSaved, setMetaSaved] = useState(false)
  const [newItem, setNewItem] = useState(emptyItem)
  const [editingId, setEditingId] = useState(null)
  const [editItem, setEditItem] = useState(emptyItem)
  const [libraryItems, setLibraryItems] = useState([])
  const [libPick, setLibPick] = useState('')

  async function load() {
    setLoading(true)
    const { data: t } = await supabase.from('checklist_templates')
      .select('id, name, subtitle, checklist_type, equipment_type, offers_enabled, source_template_id')
      .eq('id', templateId).single()
    setTpl(t)
    setMeta({
      name: t?.name || '', subtitle: t?.subtitle || '',
      checklist_type: t?.checklist_type || 'maintenance',
      equipment_type: t?.equipment_type || '', offers_enabled: !!t?.offers_enabled,
    })
    const { data: its } = await supabase.from('checklist_template_items')
      .select('id, sort_order, label, guidance, requires_photo, recommendation_internal, recommendation_customer')
      .eq('template_id', templateId).eq('is_active', true).order('sort_order')
    setItems(its || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [templateId])

  useEffect(() => {
    supabase.from('checklist_templates').select('id, name').is('org_id', null).eq('is_active', true).then(async ({ data: sys }) => {
      if (!sys || !sys.length) { setLibraryItems([]); return }
      const { data: lib } = await supabase.from('checklist_template_items')
        .select('label, guidance, requires_photo, template_id')
        .in('template_id', sys.map((s) => s.id)).eq('is_active', true).order('label')
      const seen = new Set()
      const uniq = []
      for (const it of lib || []) {
        const key = it.label.trim().toLowerCase()
        if (seen.has(key)) continue
        seen.add(key); uniq.push(it)
      }
      setLibraryItems(uniq)
    })
  }, [])

  async function saveMeta() {
    await supabase.from('checklist_templates').update({
      name: meta.name.trim(),
      subtitle: meta.subtitle.trim() || null,
      checklist_type: meta.checklist_type,
      equipment_type: meta.equipment_type || null,
      offers_enabled: meta.offers_enabled,
    }).eq('id', templateId)
    setMetaSaved(true)
    setTimeout(() => setMetaSaved(false), 2000)
    load()
  }

  async function addItem(data) {
    if (!data.label.trim()) return
    await supabase.from('checklist_template_items').insert({
      template_id: templateId, org_id: orgId, sort_order: items.length,
      label: data.label.trim(),
      guidance: data.guidance.trim() || null,
      recommendation_internal: data.recommendation_internal.trim() || null,
      recommendation_customer: data.recommendation_customer.trim() || null,
      requires_photo: !!data.requires_photo, is_active: true,
    })
    setNewItem(emptyItem)
    load()
  }

  async function addFromLibrary() {
    const it = libraryItems.find((l) => l.label === libPick)
    if (!it) return
    await addItem({ label: it.label, guidance: it.guidance || '', recommendation_internal: '', recommendation_customer: '', requires_photo: it.requires_photo })
    setLibPick('')
  }

  function startEdit(it) {
    setEditingId(it.id)
    setEditItem({
      label: it.label, guidance: it.guidance || '',
      recommendation_internal: it.recommendation_internal || '',
      recommendation_customer: it.recommendation_customer || '',
      requires_photo: !!it.requires_photo,
    })
  }
  async function saveEdit(id) {
    await supabase.from('checklist_template_items').update({
      label: editItem.label.trim(),
      guidance: editItem.guidance.trim() || null,
      recommendation_internal: editItem.recommendation_internal.trim() || null,
      recommendation_customer: editItem.recommendation_customer.trim() || null,
      requires_photo: !!editItem.requires_photo,
    }).eq('id', id)
    setEditingId(null)
    load()
  }
  async function removeItem(it) {
    if (!window.confirm(`Remove "${it.label}" from this checklist?`)) return
    await supabase.from('checklist_template_items').update({ is_active: false }).eq('id', it.id)
    load()
  }
  async function moveItem(it, dir) {
    const idx = items.findIndex((x) => x.id === it.id)
    const swap = dir === 'up' ? idx - 1 : idx + 1
    if (swap < 0 || swap >= items.length) return
    const other = items[swap]
    await Promise.all([
      supabase.from('checklist_template_items').update({ sort_order: other.sort_order }).eq('id', it.id),
      supabase.from('checklist_template_items').update({ sort_order: it.sort_order }).eq('id', other.id),
    ])
    load()
  }

  if (loading || !meta) return <p style={{ color: 'var(--mist)' }}>Loading…</p>

  const offersOn = meta.offers_enabled

  return (
    <div>
      <button className="logout-button" style={{ marginBottom: 12 }} onClick={onBack}>← Back to checklists</button>
      <h2 className="page-title" style={{ marginBottom: 4 }}>{tpl?.name}</h2>
      {tpl?.source_template_id && <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 0 }}>Copied from a system template — edits here only affect your copy.</p>}

      <div style={{ border: '1px solid var(--line, #E2E6ED)', borderRadius: 8, padding: 16, marginBottom: 24, background: 'var(--panel)' }}>
        <div className="inline-form" style={{ flexWrap: 'wrap' }}>
          <div className="field"><label>Name</label><input type="text" value={meta.name} onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))} /></div>
          <div className="field" style={{ minWidth: 280 }}><label>Subtitle</label><input type="text" value={meta.subtitle} onChange={(e) => setMeta((m) => ({ ...m, subtitle: e.target.value }))} placeholder="Shown to the customer under the title" /></div>
          <div className="field"><label>Type</label>
            <select value={meta.checklist_type} onChange={(e) => setMeta((m) => ({ ...m, checklist_type: e.target.value }))}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          </div>
          <div className="field"><label>Equipment</label>
            <select value={meta.equipment_type} onChange={(e) => setMeta((m) => ({ ...m, equipment_type: e.target.value }))}>{EQUIPMENT.map((e2) => <option key={e2.value} value={e2.value}>{e2.label}</option>)}</select>
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={meta.offers_enabled} onChange={(e) => setMeta((m) => ({ ...m, offers_enabled: e.target.checked }))} />
          <span>Show the recommendation / offer layer <span style={{ color: 'var(--mist)', fontSize: 12 }}>(when off, techs see only the inspection tasks — no upsell prompts, nothing to the customer)</span></span>
        </label>
        <div style={{ marginTop: 10 }}>
          <button className="auth-button" style={{ width: 'auto', padding: '8px 18px', margin: 0 }} onClick={saveMeta}>Save details</button>
          {metaSaved && <span style={{ marginLeft: 10, color: '#0F6E56', fontSize: 13 }}>Saved</span>}
        </div>
      </div>

      <h3 style={{ marginBottom: 10 }}>Checklist items <span style={{ color: 'var(--mist)', fontSize: 13, fontWeight: 400 }}>({items.length})</span></h3>

      {items.length === 0 && <p style={{ color: 'var(--mist)' }}>No items yet. Add one below, or pull from the library.</p>}
      <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
        {items.map((it, idx) => editingId === it.id ? (
          <div key={it.id} style={{ border: '1px solid var(--jc-blue, #2563EB)', borderRadius: 8, padding: 14 }}>
            <ItemFields data={editItem} setData={setEditItem} offersOn={offersOn} />
            <div style={{ marginTop: 8 }}>
              <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(it.id)}>Save item</button>
              <button className="logout-button" style={{ marginLeft: 8 }} onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div key={it.id} style={{ border: '1px solid var(--line, #E2E6ED)', borderRadius: 8, padding: '10px 14px', background: 'var(--panel)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{it.label}{it.requires_photo && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#185FA5', background: '#E6F1FB', padding: '1px 6px', borderRadius: 4 }}>PHOTO</span>}</div>
              {it.guidance && <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 2 }}>{it.guidance}</div>}
              {it.recommendation_internal && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  <span style={{ color: '#993C1D', fontWeight: 600 }}>Tech: {it.recommendation_internal}</span>
                  {offersOn && it.recommendation_customer && <span style={{ color: 'var(--mist)' }}>  ·  Customer sees: “{it.recommendation_customer}”</span>}
                </div>
              )}
            </div>
            <div className="grid-actions">
              <button className="logout-button" onClick={() => moveItem(it, 'up')} disabled={idx === 0} title="Move up">↑</button>
              <button className="logout-button" onClick={() => moveItem(it, 'down')} disabled={idx === items.length - 1} title="Move down">↓</button>
              <button className="logout-button" onClick={() => startEdit(it)}>Edit</button>
              <button className="logout-button" onClick={() => removeItem(it)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {libraryItems.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 320, marginBottom: 0 }}>
            <label>Add from library</label>
            <select value={libPick} onChange={(e) => setLibPick(e.target.value)}>
              <option value="">Pick a standard item…</option>
              {libraryItems.map((l) => <option key={l.label} value={l.label}>{l.label}</option>)}
            </select>
          </div>
          <button className="auth-button" style={{ width: 'auto', padding: '8px 16px', margin: 0 }} disabled={!libPick} onClick={addFromLibrary}>Add</button>
        </div>
      )}

      <div style={{ border: '1px dashed var(--line, #C9CED6)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Add a new item</div>
        <ItemFields data={newItem} setData={setNewItem} offersOn={offersOn} />
        <div style={{ marginTop: 8 }}>
          <button className="auth-button" style={{ width: 'auto', padding: '6px 16px', margin: 0 }} onClick={() => addItem(newItem)} disabled={!newItem.label.trim()}>Add item</button>
        </div>
      </div>
    </div>
  )
}

function ItemFields({ data, setData, offersOn }) {
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Inspection task <span style={{ color: 'var(--mist)', fontWeight: 400 }}>(the customer sees this)</span></label>
        <input type="text" value={data.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Inspect air filters for accumulation" />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Tech guidance <span style={{ color: 'var(--mist)', fontWeight: 400 }}>(optional coaching, tech-only)</span></label>
        <input type="text" value={data.guidance} onChange={(e) => set('guidance', e.target.value)} placeholder="e.g. Clean or replace if pressure drop exceeds design" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label style={{ color: '#993C1D' }}>Tech prompt <span style={{ color: 'var(--mist)', fontWeight: 400 }}>(blunt, never shown to customer)</span></label>
          <input type="text" value={data.recommendation_internal} onChange={(e) => set('recommendation_internal', e.target.value)} placeholder="e.g. Sell filter subscription" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Customer recommendation <span style={{ color: 'var(--mist)', fontWeight: 400 }}>{offersOn ? '(soft, shown on report)' : '(shown when offers are on)'}</span></label>
          <input type="text" value={data.recommendation_customer} onChange={(e) => set('recommendation_customer', e.target.value)} placeholder="e.g. We recommend a filter subscription" />
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
        <input type="checkbox" checked={data.requires_photo} onChange={(e) => set('requires_photo', e.target.checked)} />
        Require a photo on this item
      </label>
    </div>
  )
}
