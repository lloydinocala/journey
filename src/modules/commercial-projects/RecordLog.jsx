import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../utils/supabase'
import { fmtDate, num, today } from './data'
import { uploadFiles, openFile, removeFile } from './files'

// A configurable log (submittals, RFIs, equipment, daily logs, inspections, TAB,
// punch list). Each config names its table, fields, statuses, and an optional
// flag(row) that returns { tone: 'red'|'amber', text } for rows that need attention.
export default function RecordLog({ config, project, lookups = {}, profile, onChanged }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)   // row object (new rows have no id)
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from(config.table).select('*').eq('project_id', project.id)
      .order(config.orderBy || 'created_at', { ascending: !!config.orderAsc })
    setRows(data || []); setLoading(false)
  }, [config.table, config.orderBy, config.orderAsc, project.id])
  useEffect(() => { load() }, [load])

  const isOpen = (r) => !config.closedStatuses || !config.closedStatuses.includes(r.status)
  const shown = showAll ? rows : rows.filter(isOpen)
  const listFields = config.fields.filter((f) => f.list)

  function startNew() {
    const base = { ...(config.defaults ? config.defaults(profile) : {}) }
    if (config.numberField) base[config.numberField] = rows.reduce((m, r) => Math.max(m, num(r[config.numberField])), 0) + 1
    setEditing(base); setMsg('')
  }

  async function save() {
    for (const f of config.fields) if (f.required && (editing[f.key] == null || String(editing[f.key]).trim() === '')) { setMsg(`${f.label} is required.`); return }
    setBusy(true); setMsg('')
    const row = {}
    for (const f of config.fields) {
      let v = editing[f.key]
      if (f.type === 'number') v = v === '' || v == null ? null : num(v)
      else if (f.type === 'checkbox') v = !!v
      else if (f.type === 'files') v = Array.isArray(v) ? v : []
      else if (v === '') v = null
      row[f.key] = v
    }
    if (config.numberField) row[config.numberField] = editing[config.numberField]
    if (config.beforeSave) Object.assign(row, config.beforeSave(row, editing))
    const { error } = editing.id
      ? await supabase.from(config.table).update(row).eq('id', editing.id)
      : await supabase.from(config.table).insert({ ...row, org_id: project.org_id, project_id: project.id })
    setBusy(false)
    if (error) { setMsg(error.message); return }
    setEditing(null); load(); onChanged && onChanged()
  }

  async function remove() {
    if (!editing?.id || !window.confirm(`Delete this ${config.noun}?`)) return
    for (const f of config.fields) if (f.type === 'files') for (const a of editing[f.key] || []) await removeFile(a.path)
    await supabase.from(config.table).delete().eq('id', editing.id)
    setEditing(null); load(); onChanged && onChanged()
  }

  async function addFiles(key, fileList) {
    setBusy(true)
    const { files, error } = await uploadFiles(project.org_id, project.id, config.table, fileList)
    setBusy(false)
    if (error) setMsg(error)
    setEditing((e) => ({ ...e, [key]: [...(e[key] || []), ...files] }))
  }

  const display = (f, r) => {
    const v = r[f.key]
    if (f.type === 'date') return fmtDate(v)
    if (f.type === 'select') return (f.options.find((o) => o.value === v) || {}).label || v || '—'
    if (f.type === 'checkbox') return v ? 'Yes' : ''
    if (f.type === 'lookup') return (lookups[f.lookup] || []).find((o) => o.value === v)?.label || '—'
    if (f.type === 'files') return (v || []).length ? `📎 ${(v || []).length}` : ''
    if (f.render) return f.render(r)
    return v == null || v === '' ? '—' : String(v)
  }

  const input = (f) => {
    const v = editing[f.key]
    const set = (val) => setEditing({ ...editing, [f.key]: val })
    const auto = f.onSetDate ? (val) => setEditing({ ...editing, [f.key]: val, ...f.onSetDate(val, editing) }) : set
    if (f.type === 'textarea') return <textarea rows={f.rows || 3} style={{ width: '100%' }} value={v || ''} onChange={(e) => set(e.target.value)} />
    if (f.type === 'select') return (
      <select value={v || ''} onChange={(e) => (f.onSelect ? setEditing({ ...editing, [f.key]: e.target.value, ...f.onSelect(e.target.value, editing) }) : set(e.target.value))}>
        {!f.required && <option value="">—</option>}{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>)
    if (f.type === 'lookup') return (
      <select value={v || ''} onChange={(e) => set(e.target.value || null)}>
        <option value="">—</option>{(lookups[f.lookup] || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>)
    if (f.type === 'checkbox') return <input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} />
    if (f.type === 'files') return (
      <div>
        {(v || []).map((a, i) => (
          <div key={a.path} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, marginBottom: 4 }}>
            <button type="button" className="logout-button" style={{ padding: '2px 10px', fontSize: 13 }} onClick={() => openFile(a.path)}>Open</button>
            <span style={{ flex: 1 }}>{a.name}</span>
            <button type="button" className="logout-button" style={{ padding: '2px 8px', fontSize: 13 }} onClick={async () => { await removeFile(a.path); set((v || []).filter((_, j) => j !== i)) }}>✕</button>
          </div>
        ))}
        <input type="file" multiple accept={f.accept} onChange={(e) => { addFiles(f.key, e.target.files); e.target.value = '' }} />
      </div>)
    return <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} step={f.type === 'number' ? 'any' : undefined}
      value={v ?? ''} onChange={(e) => (f.type === 'date' ? auto(e.target.value) : set(e.target.value))} />
  }

  const tone = { red: '#B00020', amber: '#9a6a12' }
  const openCount = rows.filter(isOpen).length
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>{config.title}</h3>
        <span style={{ fontSize: 13, color: 'var(--mist)' }}>{config.closedStatuses ? `${openCount} open · ${rows.length} total` : `${rows.length} total`}</span>
        {config.closedStatuses && <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />Show closed</label>}
        <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', marginLeft: 'auto' }} onClick={startNew}>+ {config.addLabel || 'Add'}</button>
      </div>
      {config.help && <p style={{ fontSize: 13, color: 'var(--mist)', margin: '0 0 10px' }}>{config.help}</p>}

      {editing && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{editing.id ? 'Edit' : 'New'} {config.noun}{config.numberField ? ` #${editing[config.numberField]}` : ''}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {config.fields.map((f) => (
              <div key={f.key} className="field" style={{ minWidth: f.w || 180, flex: f.full ? '1 1 100%' : `1 1 ${f.w || 180}px` }}>
                <label>{f.label}{f.required ? ' *' : ''}</label>{input(f)}
              </div>
            ))}
          </div>
          {msg && <div style={{ color: '#B00020', margin: '6px 0' }}>{msg}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="auth-button" style={{ width: 'auto', padding: '7px 16px' }} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="logout-button" onClick={() => setEditing(null)}>Cancel</button>
            {editing.id && <button className="logout-button" style={{ marginLeft: 'auto' }} onClick={remove}>Delete</button>}
          </div>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : shown.length === 0 ? (
        <p style={{ color: 'var(--mist)', background: 'var(--panel)', border: '1px dashed var(--line-strong)', borderRadius: 10, padding: 18 }}>{config.empty}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: config.minWidth || 760 }}>
            <thead><tr>{config.numberField && <th>#</th>}{listFields.map((f) => <th key={f.key}>{f.label}</th>)}{config.flag && <th>Attention</th>}</tr></thead>
            <tbody>{shown.map((r) => {
              const fl = config.flag ? config.flag(r) : null
              return (
                <tr key={r.id} onClick={() => { setEditing({ ...r }); setMsg('') }} style={{ cursor: 'pointer' }}>
                  {config.numberField && <td style={{ fontWeight: 600 }}>{r[config.numberField]}{config.revisionField && r[config.revisionField] ? `.${r[config.revisionField]}` : ''}</td>}
                  {listFields.map((f) => <td key={f.key}>{display(f, r)}</td>)}
                  {config.flag && <td style={{ color: fl ? tone[fl.tone] : 'inherit', fontWeight: fl ? 600 : 400 }}>{fl ? fl.text : ''}</td>}
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

