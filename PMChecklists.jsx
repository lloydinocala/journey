import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const TYPE_BADGE = {
  inspect: { label: 'Inspect', color: '#55607A' },
  measure: { label: 'Measure', color: '#2E7FC4' },
  perform: { label: 'Perform', color: '#1E8A7A' },
  safety: { label: 'Safety-test', color: '#B01818' },
}

// Admin library for PM checklist templates. Journey ships masters; an admin forks one with
// "Save as my version" (named), then edits their own copy. Techs run them, never fork them.
export default function PMChecklists({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const isAdmin = isSuperAdmin || profile.role === 'org_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [templates, setTemplates] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [niText, setNiText] = useState('')
  const [niSection, setNiSection] = useState('')
  const [niType, setNiType] = useState('inspect')
  const [niUnits, setNiUnits] = useState('')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadTemplates() {
    setLoading(true)
    // Masters (org_id null) + this org's forks.
    let query = supabase.from('pm_checklist_templates').select('*').eq('active', true)
    const { data } = await query.order('org_id', { nullsFirst: true }).order('name')
    const list = (data || []).filter((t) => t.org_id === null || t.org_id === selectedOrg)
    setTemplates(list)
    setLoading(false)
    if (list.length && !list.find((t) => t.id === selectedId)) setSelectedId(list[0].id)
  }
  useEffect(() => { if (selectedOrg || !isSuperAdmin) loadTemplates() }, [selectedOrg])

  async function loadItems(tid) {
    if (!tid) { setItems([]); return }
    const { data } = await supabase.from('pm_checklist_items').select('*').eq('template_id', tid).order('sort_order')
    setItems(data || [])
  }
  useEffect(() => { loadItems(selectedId) }, [selectedId])

  const selected = templates.find((t) => t.id === selectedId)
  const isMaster = selected && selected.org_id === null
  const canEdit = isAdmin && selected && !isMaster  // forks only (super-admin edits masters too handled below)
  const canEditThis = selected && (isSuperAdmin || (isAdmin && selected.org_id === selectedOrg && !isMaster))

  async function forkTemplate(master) {
    const suggested = master.name.replace(' — Journey Master', '') + ' — our version'
    const name = window.prompt('Save as my version — name it:', suggested)
    if (!name || !name.trim()) return
    setBusy(true)
    const { data: newTpl, error } = await supabase.from('pm_checklist_templates').insert({
      org_id: selectedOrg,
      name: name.trim(),
      system_type: master.system_type,
      based_on_template_id: master.id,
      based_on_version: master.version,
      version: 1,
    }).select('id').single()
    if (error) { alert(error.message); setBusy(false); return }
    const { data: src } = await supabase.from('pm_checklist_items')
      .select('section, item_text, item_type, record_units, priority, trend, sort_order')
      .eq('template_id', master.id).order('sort_order')
    if (src && src.length) {
      await supabase.from('pm_checklist_items').insert(src.map((it) => ({ ...it, template_id: newTpl.id })))
    }
    setBusy(false)
    await loadTemplates()
    setSelectedId(newTpl.id)
  }

  async function addItem() {
    if (!niText.trim()) return
    const maxSort = items.reduce((m, i) => Math.max(m, Number(i.sort_order) || 0), 0)
    await supabase.from('pm_checklist_items').insert({
      template_id: selectedId,
      section: niSection.trim() || 'Custom',
      item_text: niText.trim(),
      item_type: niType,
      record_units: niUnits.trim() || null,
      priority: 'core',
      trend: niType === 'measure',
      sort_order: maxSort + 1,
    })
    setNiText(''); setNiSection(''); setNiUnits(''); setNiType('inspect'); setShowAdd(false)
    loadItems(selectedId)
  }

  async function deleteItem(id) {
    await supabase.from('pm_checklist_items').delete().eq('id', id)
    loadItems(selectedId)
  }

  async function renameForm() {
    const name = window.prompt('Rename this form:', selected.name)
    if (!name || !name.trim()) return
    await supabase.from('pm_checklist_templates').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', selected.id)
    loadTemplates()
  }

  async function deleteForm() {
    if (!window.confirm(`Delete "${selected.name}"? This can't be undone.`)) return
    await supabase.from('pm_checklist_templates').delete().eq('id', selected.id)
    setSelectedId(null)
    loadTemplates()
  }

  const masters = templates.filter((t) => t.org_id === null)
  const forks = templates.filter((t) => t.org_id !== null)

  // group items by section preserving order
  const sections = []
  for (const it of items) {
    let s = sections.find((x) => x.name === (it.section || 'Other'))
    if (!s) { s = { name: it.section || 'Other', rows: [] }; sections.push(s) }
    s.rows.push(it)
  }

  const input = { width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--line, #D5DAE1)', fontSize: 13, boxSizing: 'border-box' }
  const smallLabel = { fontSize: 11, color: 'var(--mist)', display: 'block', marginBottom: 2 }

  return (
    <div>
      <h2 className="page-title">PM Checklists</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 16, maxWidth: 660 }}>
        Journey&rsquo;s master templates are the baseline. {isAdmin ? 'Fork one with “Save as my version,” then edit your copy — add checks, delete what you don’t use.' : 'Only an admin can create custom versions; you can view them here.'} The master always stays unchanged.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16, maxWidth: 420 }}>
          <label style={smallLabel}>Organization (whose forks to show)</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Left: template list */}
          <div style={{ width: 300, flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Journey Masters</div>
            {masters.map((t) => (
              <TemplateRow key={t.id} t={t} active={t.id === selectedId} onClick={() => setSelectedId(t.id)} master />
            ))}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '16px 0 6px' }}>Your Custom Forms</div>
            {forks.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--mist)', padding: '4px 2px' }}>None yet.</div>}
            {forks.map((t) => (
              <TemplateRow key={t.id} t={t} active={t.id === selectedId} onClick={() => setSelectedId(t.id)} />
            ))}
          </div>

          {/* Right: selected template */}
          {selected && (
            <div style={{ flex: 1, minWidth: 340 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--mist)' }}>
                    {items.length} checks · {isMaster ? 'Journey master (read-only)' : 'your form'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {isMaster && isAdmin && (
                    <button className="auth-button" style={{ width: 'auto', padding: '7px 16px' }} disabled={busy} onClick={() => forkTemplate(selected)}>
                      {busy ? 'Saving…' : 'Save as my version'}
                    </button>
                  )}
                  {canEditThis && (
                    <>
                      <button className="logout-button" style={{ width: 'auto', padding: '7px 14px' }} onClick={() => setShowAdd((s) => !s)}>+ Add check</button>
                      <button className="logout-button" style={{ width: 'auto', padding: '7px 14px' }} onClick={renameForm}>Rename</button>
                      <button className="logout-button" style={{ width: 'auto', padding: '7px 14px', color: '#C0392B' }} onClick={deleteForm}>Delete</button>
                    </>
                  )}
                </div>
              </div>

              {showAdd && canEditThis && (
                <div style={{ border: '1px solid var(--line, #E2E6ED)', borderRadius: 8, padding: 12, marginBottom: 14, background: 'var(--panel)' }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div><label style={smallLabel}>Check *</label><input style={input} value={niText} onChange={(e) => setNiText(e.target.value)} placeholder="e.g. Check surge protector operation" /></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 2 }}><label style={smallLabel}>Section</label><input style={input} value={niSection} onChange={(e) => setNiSection(e.target.value)} placeholder="Custom" /></div>
                      <div style={{ flex: 1 }}><label style={smallLabel}>Type</label>
                        <select style={input} value={niType} onChange={(e) => setNiType(e.target.value)}>
                          <option value="inspect">Inspect</option><option value="measure">Measure</option><option value="perform">Perform</option><option value="safety">Safety-test</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}><label style={smallLabel}>Units (if measure)</label><input style={input} value={niUnits} onChange={(e) => setNiUnits(e.target.value)} placeholder="psig" /></div>
                    </div>
                    <div><button className="auth-button" style={{ width: 'auto', padding: '7px 18px' }} onClick={addItem}>Add</button></div>
                  </div>
                </div>
              )}

              {sections.map((sec) => (
                <div key={sec.name} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1F3A5F', borderBottom: '2px solid #E8EEF5', paddingBottom: 3, marginBottom: 4 }}>{sec.name}</div>
                  {sec.rows.map((it) => {
                    const badge = TYPE_BADGE[it.item_type] || TYPE_BADGE.inspect
                    return (
                      <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', borderBottom: '1px solid #F1F4F8' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: badge.color, padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap', marginTop: 2 }}>{badge.label}</span>
                        <div style={{ flex: 1, fontSize: 13.5 }}>
                          {it.priority === 'safety' && <span style={{ color: '#B01818', fontWeight: 700 }}>⚠ </span>}
                          {it.item_text}
                          {it.record_units && <span style={{ color: 'var(--mist)', fontSize: 12 }}> — record {it.record_units}</span>}
                          {it.trend && <span style={{ color: '#2E7FC4', fontSize: 11, fontWeight: 700 }}> · trend</span>}
                        </div>
                        {canEditThis && (
                          <button onClick={() => deleteItem(it.id)} title="Remove" style={{ border: 'none', background: 'none', color: '#C0392B', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 4px' }}>×</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TemplateRow({ t, active, onClick, master }) {
  return (
    <div onClick={onClick} style={{
      padding: '9px 11px', borderRadius: 8, marginBottom: 5, cursor: 'pointer',
      border: '1px solid ' + (active ? '#2E7FC4' : 'var(--line, #E2E6ED)'),
      background: active ? 'rgba(46,127,196,0.08)' : 'var(--panel)',
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.name}</div>
      <div style={{ fontSize: 11, color: 'var(--mist)' }}>{master ? 'Journey master' : 'your form'} · {t.system_type.replace(/_/g, ' ')}</div>
    </div>
  )
}
