// Filter Price Book — the per-org retail price list for air filters, keyed by
// size (H×W×T) + type + MERV, with quantity-break pricing (1 / 4 / 6 / case of 12).
// Filled and edited here (grid + CSV paste); read by the customer portal for
// filter ordering and by the filter invoice.
import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

const COLS = [
  { key: 'height', label: 'Height', w: 70, num: true },
  { key: 'width', label: 'Width', w: 70, num: true },
  { key: 'thickness', label: 'Thickness', w: 80, num: true },
  { key: 'type', label: 'Type', w: 130, num: false },
  { key: 'merv', label: 'MERV', w: 70, num: true },
  { key: 'price_1', label: '1–3 ea', w: 84, num: true, money: true },
  { key: 'price_4', label: '4–5 ea', w: 84, num: true, money: true },
  { key: 'price_6', label: '6–11 ea', w: 88, num: true, money: true },
  { key: 'price_case', label: 'Case of 12', w: 96, num: true, money: true },
]
const BLANK = { height: '', width: '', thickness: '', type: '', merv: '', price_1: '', price_4: '', price_6: '', price_case: '' }

const money = (v) => (v == null || v === '' ? '—' : '$' + Number(v).toFixed(2))
const numOrNull = (v) => (v === '' || v == null ? null : Number(v))

export default function FilterPricebookImport({ profile }) {
  const isSuperAdmin = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const [addForm, setAddForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(BLANK)

  const [csvOpen, setCsvOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvBusy, setCsvBusy] = useState(false)
  const [csvMsg, setCsvMsg] = useState('')

  useEffect(() => {
    if (isSuperAdmin) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
  }, [isSuperAdmin])

  useEffect(() => { if (selectedOrg) loadRows(selectedOrg) }, [selectedOrg])

  async function loadRows(orgId) {
    setLoading(true)
    const { data } = await supabase.from('filter_pricebook')
      .select('*').eq('org_id', orgId)
      .order('height').order('width').order('thickness').order('merv')
    setRows(data || [])
    setLoading(false)
  }

  function payloadFrom(form) {
    return {
      height: numOrNull(form.height), width: numOrNull(form.width), thickness: numOrNull(form.thickness),
      type: (form.type || '').trim() || null,
      merv: form.merv === '' ? null : parseInt(form.merv, 10),
      price_1: numOrNull(form.price_1), price_4: numOrNull(form.price_4),
      price_6: numOrNull(form.price_6), price_case: numOrNull(form.price_case),
    }
  }

  async function addRow(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('filter_pricebook').insert({ ...payloadFrom(addForm), org_id: selectedOrg, is_active: true })
    setSaving(false)
    setAddForm(BLANK)
    loadRows(selectedOrg)
  }

  function startEdit(r) {
    setEditingId(r.id)
    setEditForm({
      height: r.height ?? '', width: r.width ?? '', thickness: r.thickness ?? '', type: r.type || '',
      merv: r.merv ?? '', price_1: r.price_1 ?? '', price_4: r.price_4 ?? '', price_6: r.price_6 ?? '', price_case: r.price_case ?? '',
    })
  }
  async function saveEdit(id) {
    await supabase.from('filter_pricebook').update({ ...payloadFrom(editForm), updated_at: new Date().toISOString() }).eq('id', id)
    setEditingId(null)
    loadRows(selectedOrg)
  }
  async function deleteRow(r) {
    if (!window.confirm('Delete this price row?')) return
    await supabase.from('filter_pricebook').delete().eq('id', r.id)
    loadRows(selectedOrg)
  }
  async function toggleActive(r) {
    await supabase.from('filter_pricebook').update({ is_active: !r.is_active }).eq('id', r.id)
    loadRows(selectedOrg)
  }

  async function importCsv() {
    setCsvBusy(true); setCsvMsg('')
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const parsed = []
    for (const line of lines) {
      const cells = line.split(line.includes('\t') ? '\t' : ',').map((c) => c.trim())
      // Skip a header row (non-numeric height)
      if (parsed.length === 0 && cells[0] && isNaN(Number(cells[0]))) continue
      if (cells.length < 5) continue
      const [height, width, thickness, type, merv, price_1, price_4, price_6, price_case] = cells
      parsed.push({
        org_id: selectedOrg, is_active: true,
        height: numOrNull(height), width: numOrNull(width), thickness: numOrNull(thickness),
        type: (type || '').trim() || null, merv: merv === '' || merv == null ? null : parseInt(merv, 10),
        price_1: numOrNull(price_1), price_4: numOrNull(price_4), price_6: numOrNull(price_6), price_case: numOrNull(price_case),
      })
    }
    if (!parsed.length) { setCsvBusy(false); setCsvMsg('No rows found. Expected: Height, Width, Thickness, Type, MERV, 1 ea, 4 ea, 6 ea, Case(12).'); return }
    const { error } = await supabase.from('filter_pricebook').insert(parsed)
    setCsvBusy(false)
    if (error) { setCsvMsg('Import failed: ' + error.message); return }
    setCsvMsg(`Imported ${parsed.length} row${parsed.length === 1 ? '' : 's'}.`)
    setCsvText('')
    loadRows(selectedOrg)
  }

  const cellInput = (form, setForm, col) => (
    <input
      type={col.num ? 'number' : 'text'} step={col.money ? '0.01' : 'any'}
      value={form[col.key]} onChange={(e) => setForm({ ...form, [col.key]: e.target.value })}
      style={{ width: col.w - 12 }}
    />
  )

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto' }}>
      <div className="page-header-bar"><h2>Filter Price Book</h2></div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 4, marginBottom: 16, maxWidth: 720 }}>
        Your retail filter prices by size, type, and MERV, with quantity breaks by total ordered — 1–3, 4–5, 6–11, and 12+ (case). The 1–3 / 4–5 / 6–11
        columns are the price PER FILTER at that quantity; “Case of 12” is the total for a full case (used at 12+).
        These feed the customer portal's filter ordering. Add rows below or paste a spreadsheet.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16, maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {/* Add a row */}
      <form onSubmit={addRow} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16, padding: 12, background: 'var(--panel)', borderRadius: 8 }}>
        {COLS.map((col) => (
          <div className="field" key={col.key} style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 12 }}>{col.label}</label>
            {cellInput(addForm, setAddForm, col)}
          </div>
        ))}
        <button className="auth-button" type="submit" style={{ width: 'auto', padding: '8px 18px' }} disabled={saving}>{saving ? 'Adding…' : 'Add row'}</button>
      </form>

      {/* CSV paste import */}
      <div style={{ marginBottom: 16 }}>
        <button className="logout-button" onClick={() => setCsvOpen((o) => !o)}>{csvOpen ? 'Hide CSV import' : 'Import from spreadsheet (CSV)'}</button>
        {csvOpen && (
          <div style={{ marginTop: 8, padding: 12, background: 'var(--panel)', borderRadius: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--mist)', marginTop: 0 }}>
              Paste rows in this column order (a header row is fine, it's skipped):<br />
              <strong>Height, Width, Thickness, Type, MERV, 1–3 ea, 4–5 ea, 6–11 ea, Case of 12</strong>
            </p>
            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={6} style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
              placeholder={'25,16,1,Pleated,8,6.99,24.99,34.99,64.99\n25,16,1,Pleated,11,7.99,28.99,39.99,74.99'} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
              <button className="auth-button" style={{ width: 'auto', padding: '8px 18px' }} disabled={csvBusy || !csvText.trim()} onClick={importCsv}>{csvBusy ? 'Importing…' : 'Import rows'}</button>
              {csvMsg && <span style={{ fontSize: 13, color: 'var(--mist)' }}>{csvMsg}</span>}
            </div>
          </div>
        )}
      </div>

      {/* The grid */}
      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : rows.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No filter prices yet. Add a row or import a spreadsheet above.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                {COLS.map((c) => <th key={c.key} style={{ textAlign: c.num ? 'right' : 'left' }}>{c.label}</th>)}
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const editing = editingId === r.id
                return (
                  <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.5 }}>
                    {COLS.map((c) => (
                      <td key={c.key} style={{ textAlign: c.num ? 'right' : 'left' }}>
                        {editing ? cellInput(editForm, setEditForm, c)
                          : c.money ? money(r[c.key])
                          : (r[c.key] ?? '—')}
                      </td>
                    ))}
                    <td>{r.is_active ? 'Active' : 'Hidden'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {editing ? (
                        <>
                          <button className="auth-button" style={{ width: 'auto', padding: '4px 12px', margin: 0 }} onClick={() => saveEdit(r.id)}>Save</button>{' '}
                          <button className="logout-button" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => setEditingId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="logout-button" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => startEdit(r)}>Edit</button>{' '}
                          <button className="logout-button" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => toggleActive(r)}>{r.is_active ? 'Hide' : 'Show'}</button>{' '}
                          <button className="logout-button" style={{ fontSize: 12, padding: '2px 8px', color: '#b0342f' }} onClick={() => deleteRow(r)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
