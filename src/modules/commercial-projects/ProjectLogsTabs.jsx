import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../utils/supabase'
import RecordLog from './RecordLog'
import { CONFIGS, CLOSEOUT_DEFAULTS } from './logConfigs'
import { fmtDate, today, LIEN_DOC_LABEL } from './data'
import { uploadFiles, openFile, removeFile } from './files'

// Lookups (vendors, users, submittals, change orders) shared by the logs.
export function useLookups(project) {
  const [lk, setLk] = useState({})
  const load = useCallback(async () => {
    if (!project) return
    const [{ data: v }, { data: u }, { data: s }, { data: c }] = await Promise.all([
      supabase.from('vendors').select('id, name').eq('org_id', project.org_id).eq('is_active', true).order('name'),
      supabase.from('users').select('id, full_name').eq('org_id', project.org_id).eq('is_active', true).order('full_name'),
      supabase.from('cp_submittals').select('id, number, title').eq('project_id', project.id).order('number'),
      supabase.from('cp_change_orders').select('id, co_number, title').eq('project_id', project.id).order('co_number'),
    ])
    setLk({
      vendors: (v || []).map((x) => ({ value: x.id, label: x.name })),
      users: (u || []).map((x) => ({ value: x.id, label: x.full_name })),
      submittals: (s || []).map((x) => ({ value: x.id, label: `#${x.number} ${x.title}` })),
      changeOrders: (c || []).map((x) => ({ value: x.id, label: `CO #${x.co_number} ${x.title}` })),
    })
  }, [project])
  useEffect(() => { load() }, [load])
  return [lk, load]
}

const pill = (active) => ({ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--line-strong)', background: active ? 'var(--nav-bg, #002060)' : 'var(--panel)', color: active ? '#fff' : 'inherit', cursor: 'pointer', fontWeight: 600, fontSize: 14 })

export function SubmittalsRfisTab({ project, profile }) {
  const [lk, reload] = useLookups(project)
  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <RecordLog config={CONFIGS.submittals} project={project} lookups={lk} profile={profile} onChanged={reload} />
      <RecordLog config={CONFIGS.rfis} project={project} lookups={lk} profile={profile} />
    </div>
  )
}

export function EquipmentTab({ project, profile }) {
  const [lk] = useLookups(project)
  return <RecordLog config={CONFIGS.equipment} project={project} lookups={lk} profile={profile} />
}

export function FieldTab({ project, profile }) {
  const [sub, setSub] = useState('dailyLogs')
  const [lk] = useLookups(project)
  const tabs = [['dailyLogs', 'Daily logs'], ['inspections', 'Inspections'], ['tab', 'TAB'], ['punch', 'Punch list']]
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {tabs.map(([k, l]) => <button key={k} style={pill(sub === k)} onClick={() => setSub(k)}>{l}</button>)}
      </div>
      <RecordLog key={sub} config={CONFIGS[sub]} project={project} lookups={lk} profile={profile} />
    </div>
  )
}

// Closeout checklist: seeded with the standard items the first time it opens.
// Hints show what Journey already knows (inspection passed, waiver delivered…).
export function CloseoutTab({ project, docs, apps, onChanged }) {
  const [items, setItems] = useState(null)
  const [facts, setFacts] = useState({})
  const [newItem, setNewItem] = useState('')

  const load = useCallback(async () => {
    let { data } = await supabase.from('cp_closeout_items').select('*').eq('project_id', project.id).order('sort_order')
    if (!data || data.length === 0) {
      await supabase.from('cp_closeout_items').insert(CLOSEOUT_DEFAULTS.map((item, i) => ({ org_id: project.org_id, project_id: project.id, item, sort_order: i + 1 })))
      ;({ data } = await supabase.from('cp_closeout_items').select('*').eq('project_id', project.id).order('sort_order'))
    }
    const [{ data: insp }, { data: tab }, { data: punch }] = await Promise.all([
      supabase.from('cp_inspections').select('inspection_type, status, result_date').eq('project_id', project.id),
      supabase.from('cp_tab_reports').select('status, report_received_date').eq('project_id', project.id),
      supabase.from('cp_punch_items').select('status').eq('project_id', project.id),
    ])
    const finalInsp = (insp || []).find((x) => x.inspection_type === 'Final mechanical' && x.status === 'passed')
    const tabRep = (tab || []).find((x) => x.status === 'report_received' || x.status === 'closed')
    const punchOpen = (punch || []).filter((x) => x.status !== 'verified').length
    setFacts({
      'TAB report delivered': tabRep ? `TAB report received ${fmtDate(tabRep.report_received_date)}` : null,
      'Final mechanical inspection passed': finalInsp ? `Passed ${fmtDate(finalInsp.result_date)}` : null,
      'Punch list complete and verified': (punch || []).length ? (punchOpen ? `${punchOpen} punch item${punchOpen === 1 ? '' : 's'} still open` : 'All punch items verified') : null,
    })
    setItems(data || [])
  }, [project])
  useEffect(() => { load() }, [load])

  const delivered = (type) => docs.find((d) => d.doc_type === type && d.status === 'delivered')
  const finalApp = apps.find((a) => a.is_final && a.status === 'submitted')
  const hint = (item) => {
    if (item === 'Final waiver of lien delivered') { const d = delivered('final_waiver'); return d ? `${LIEN_DOC_LABEL.final_waiver} delivered ${fmtDate(d.delivered_date)}` : null }
    if (item === "Contractor's final payment affidavit delivered") { const d = delivered('final_affidavit'); return d ? `Affidavit delivered ${fmtDate(d.delivered_date)}` : null }
    if (item === 'Retainage released (final application submitted)') return finalApp ? `Final application #${finalApp.app_number} submitted` : null
    return facts[item] || null
  }

  async function setStatus(it, status) {
    await supabase.from('cp_closeout_items').update({ status, done_date: status === 'done' ? today() : null }).eq('id', it.id)
    load(); onChanged && onChanged()
  }
  async function addItem() {
    if (!newItem.trim()) return
    await supabase.from('cp_closeout_items').insert({ org_id: project.org_id, project_id: project.id, item: newItem.trim(), sort_order: (items?.at(-1)?.sort_order || 0) + 1 })
    setNewItem(''); load()
  }
  async function attach(it, files) {
    const { files: up, error } = await uploadFiles(project.org_id, project.id, 'closeout', files)
    if (error) { alert(error); return }
    await supabase.from('cp_closeout_items').update({ attachments: [...(it.attachments || []), ...up] }).eq('id', it.id)
    load()
  }

  if (!items) return <p style={{ color: 'var(--mist)' }}>Loading…</p>
  const done = items.filter((i) => i.status !== 'pending').length
  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--mist)', marginTop: 0 }}>{done} of {items.length} complete. The owner usually releases retainage only when this list is done. Attach the delivered manuals, warranties, and as-builts to each item.</p>
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map((it) => {
          const h = hint(it.item)
          return (
            <div key={it.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '9px 12px', background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 8, borderLeft: `4px solid ${it.status === 'done' ? '#1F7A43' : it.status === 'na' ? 'var(--line-strong)' : '#9a6a12'}` }}>
              <input type="checkbox" checked={it.status === 'done'} onChange={(e) => setStatus(it, e.target.checked ? 'done' : 'pending')} />
              <div style={{ flex: '1 1 260px' }}>
                <div style={{ fontWeight: 600, textDecoration: it.status === 'na' ? 'line-through' : 'none' }}>{it.item}</div>
                <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>
                  {it.status === 'done' ? `Done ${fmtDate(it.done_date)}` : it.status === 'na' ? 'Not applicable' : 'Pending'}{h ? ` · Journey shows: ${h}` : ''}
                </div>
                {(it.attachments || []).map((a) => <button key={a.path} className="logout-button" style={{ padding: '1px 8px', fontSize: 12, marginRight: 6, marginTop: 4 }} onClick={() => openFile(a.path)}>📎 {a.name}</button>)}
              </div>
              <label className="logout-button" style={{ padding: '3px 10px', fontSize: 13, cursor: 'pointer' }}>Attach<input type="file" multiple hidden onChange={(e) => { attach(it, e.target.files); e.target.value = '' }} /></label>
              {it.status !== 'na' ? <button className="logout-button" style={{ padding: '3px 10px', fontSize: 13 }} onClick={() => setStatus(it, 'na')}>N/A</button>
                : <button className="logout-button" style={{ padding: '3px 10px', fontSize: 13 }} onClick={() => setStatus(it, 'pending')}>Undo N/A</button>}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a closeout item required by this contract" style={{ flex: 1, padding: 8 }} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
        <button className="logout-button" onClick={addItem}>+ Add</button>
      </div>
    </div>
  )
}

const DOC_CATEGORIES = [['contract', 'Contract'], ['drawings', 'Drawings'], ['specs', 'Specifications'], ['permit', 'Permit'], ['insurance', 'Insurance certificate'], ['submittal', 'Submittal'], ['report', 'Report'], ['photo', 'Photo'], ['other', 'Other']]

export function DocumentsTab({ project, profile }) {
  const [docs, setDocs] = useState([])
  const [cat, setCat] = useState('contract')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const { data } = await supabase.from('cp_documents').select('*').eq('project_id', project.id).order('created_at', { ascending: false })
    setDocs(data || [])
  }, [project.id])
  useEffect(() => { load() }, [load])

  async function upload(files) {
    setBusy(true)
    const { files: up, error } = await uploadFiles(project.org_id, project.id, 'documents', files)
    if (up.length) await supabase.from('cp_documents').insert(up.map((f) => ({ org_id: project.org_id, project_id: project.id, category: cat, name: f.name, storage_path: f.path, content_type: f.type, size_bytes: f.size, uploaded_by: profile?.id || null })))
    setBusy(false)
    if (error) alert(error)
    load()
  }
  async function del(d) {
    if (!window.confirm(`Delete ${d.name}?`)) return
    await removeFile(d.storage_path)
    await supabase.from('cp_documents').delete().eq('id', d.id)
    load()
  }
  const label = (c) => (DOC_CATEGORIES.find((x) => x[0] === c) || [c, c])[1]
  const shown = docs.filter((d) => filter === 'all' || d.category === filter)
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: 12 }}>
        <strong>Upload</strong>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ padding: 7 }}>{DOC_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input type="file" multiple disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
        {busy && <span style={{ color: 'var(--mist)' }}>Uploading…</span>}
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: 7, marginLeft: 'auto' }}>
          <option value="all">All categories</option>{DOC_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {shown.length === 0 ? <p style={{ color: 'var(--mist)' }}>No documents yet. Keep the contract, drawings, specs, permits, and insurance certificates here so the whole team works from the same set.</p> : (
        <table className="data-table" style={{ minWidth: 640 }}>
          <thead><tr><th>Name</th><th>Category</th><th>Added</th><th>Size</th><th></th></tr></thead>
          <tbody>{shown.map((d) => (
            <tr key={d.id}>
              <td><button className="logout-button" style={{ padding: '2px 10px', fontSize: 14 }} onClick={() => openFile(d.storage_path)}>{d.name}</button></td>
              <td>{label(d.category)}</td><td>{fmtDate(d.created_at?.slice(0, 10))}</td>
              <td>{d.size_bytes ? (d.size_bytes > 1048576 ? (d.size_bytes / 1048576).toFixed(1) + ' MB' : Math.ceil(d.size_bytes / 1024) + ' KB') : '—'}</td>
              <td><button className="logout-button" style={{ padding: '2px 8px', fontSize: 13 }} onClick={() => del(d)}>Delete</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
