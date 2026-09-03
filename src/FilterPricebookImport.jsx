// Filter Price Book — the per-org retail price list for air filters, keyed by
// size (H×W×T) + type + MERV, with quantity-break pricing (1-3 / 4-5 / 6-11 / 12+
// as a case of 12). The 1-3/4-5/6-11 columns are the price PER FILTER at that
// quantity; "Case of 12" is the total for a full case (used at 12+). Filled and
// edited here (grid + file import); read by the customer portal for ordering.
import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { supabase } from './utils/supabase'
import { readFileSmart } from './utils/csvImport'
import OrgPicker from './OrgPicker'

const COLS = [
  { key: 'height', label: 'Height', w: 70, num: true },
  { key: 'width', label: 'Width', w: 70, num: true },
  { key: 'thickness', label: 'Thickness', w: 80, num: true },
  { key: 'type', label: 'Type', w: 120, num: false },
  { key: 'merv', label: 'MERV', w: 70, num: true },
  { key: 'price_1', label: '1–3 ea', w: 84, num: true, money: true },
  { key: 'price_4', label: '4–5 ea', w: 84, num: true, money: true },
  { key: 'price_6', label: '6–11 ea', w: 88, num: true, money: true },
  { key: 'price_case', label: 'Case of 12', w: 96, num: true, money: true },
  { key: 'vendor', label: 'Vendor', w: 120, num: false },
  { key: 'notes', label: 'Notes', w: 150, num: false },
  { key: 'product_url', label: 'Product URL', w: 180, num: false, link: true },
]
const BLANK = { height: '', width: '', thickness: '', type: '', merv: '', price_1: '', price_4: '', price_6: '', price_case: '', vendor: '', notes: '', product_url: '' }

// Template / import headers (a spreadsheet-friendly, round-trippable column set).
const TEMPLATE_ROW = {
  Height: '25', Width: '16', Thickness: '1', Type: 'Pleated', MERV: '8',
  '1-3 ea': '6.99', '4-5 ea': '5.99', '6-11 ea': '5.49', 'Case of 12': '59.88',
  Vendor: 'Acme Supply', Notes: '', 'Product URL': 'https://vendor.com/item',
}

const money = (v) => (v == null || v === '' ? '—' : '$' + Number(v).toFixed(2))
const numOrNull = (v) => (v === '' || v == null ? null : Number(v))
const csvNum = (v) => { const t = (v ?? '').toString().trim().replace(/[$,]/g, ''); if (t === '') return null; const n = parseFloat(t); return isNaN(n) ? null : n }
const csvInt = (v) => { const n = csvNum(v); return n == null ? null : Math.round(n) }
const csvTxt = (v) => { const t = (v ?? '').toString().trim(); return t === '' ? null : t }

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

  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState(null)
  const [failed, setFailed] = useState([])
  const [skipped, setSkipped] = useState([])
  const [clearFirst, setClearFirst] = useState(false)
  const [error, setError] = useState('')

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
      vendor: (form.vendor || '').trim() || null, notes: (form.notes || '').trim() || null, product_url: (form.product_url || '').trim() || null,
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
    const f = { ...BLANK }
    COLS.forEach((c) => { f[c.key] = r[c.key] ?? '' })
    setEditForm(f)
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

  function downloadTemplate() {
    const blob = new Blob([Papa.unparse([TEMPLATE_ROW])], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'filter-pricebook-template.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file || !selectedOrg) return
    setError(''); setSummary(null); setFailed([]); setSkipped([]); setImporting(true)
    try {
      const text = await readFileSmart(file)
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      if (parsed.errors?.length) throw new Error(`CSV parse error: ${parsed.errors[0].message} (row ${parsed.errors[0].row})`)
      const mappedAll = parsed.data.map((r, idx) => ({
        __row: idx + 2,
        height: csvNum(r.Height ?? r.height),
        width: csvNum(r.Width ?? r.width),
        thickness: csvNum(r.Thickness ?? r.thickness),
        type: csvTxt(r.Type ?? r.type),
        merv: csvInt(r.MERV ?? r.merv),
        price_1: csvNum(r['1-3 ea'] ?? r['1\u20133 ea'] ?? r['Price 1-3'] ?? r['1 ea'] ?? r.price_1),
        price_4: csvNum(r['4-5 ea'] ?? r['4\u20135 ea'] ?? r['Price 4-5'] ?? r['4 ea'] ?? r.price_4),
        price_6: csvNum(r['6-11 ea'] ?? r['6\u201311 ea'] ?? r['Price 6-11'] ?? r['6 ea'] ?? r.price_6),
        price_case: csvNum(r['Case of 12'] ?? r['Case'] ?? r['Case Price'] ?? r.price_case),
        vendor: csvTxt(r.Vendor ?? r.vendor),
        notes: csvTxt(r.Notes ?? r.notes),
        product_url: csvTxt(r['Product URL'] ?? r.product_url ?? r.URL ?? r.url),
      }))

      // Keep every row that has at least a Height and Width. Nothing is silently
      // dropped: rows without them are reported as "skipped" (downloadable).
      const valid = [], skips = []
      for (const r of mappedAll) {
        if (r.height == null || r.width == null) { skips.push({ Row: r.__row, Height: r.height ?? '', Width: r.width ?? '', Type: r.type ?? '', MERV: r.merv ?? '', reason: 'missing Height/Width' }); continue }
        valid.push(r)
      }
      if (!valid.length) throw new Error('No rows had a readable Height and Width \u2014 check the column headers against the template.')

      if (clearFirst) {
        const { error: delErr } = await supabase.from('filter_pricebook').delete().eq('org_id', selectedOrg)
        if (delErr) throw new Error('Could not clear existing prices: ' + delErr.message)
      }

      let created = 0
      const fails = []
      const sizeStr = (x) => `${x.height ?? ''}x${x.width ?? ''}x${x.thickness ?? ''}${x.merv ? ' MERV ' + x.merv : ''}`
      for (let i = 0; i < valid.length; i += 300) {
        const batch = valid.slice(i, i + 300).map(({ __row, ...r }) => ({ ...r, org_id: selectedOrg, is_active: true }))
        const { error: insErr } = await supabase.from('filter_pricebook').insert(batch)
        if (!insErr) { created += batch.length; continue }
        for (const row of batch) {
          const { error: rowErr } = await supabase.from('filter_pricebook').insert(row)
          if (rowErr) fails.push({ Size: sizeStr(row), Vendor: row.vendor ?? '', reason: rowErr.message }); else created++
        }
      }

      setSummary({ created, skipped: skips.length, failed: fails.length, total: mappedAll.length })
      setFailed(fails); setSkipped(skips)
      loadRows(selectedOrg)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  function downloadRows(list, name) {
    const blob = new Blob([Papa.unparse(list)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const cellInput = (form, setForm, col) => (
    <input
      type={col.num ? 'number' : 'text'} step={col.money ? '0.01' : 'any'}
      value={form[col.key]} onChange={(e) => setForm({ ...form, [col.key]: e.target.value })}
      style={{ width: col.w - 12 }}
    />
  )

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto' }}>
      <div className="page-header-bar"><h2>Filter Price Book</h2></div>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 4, marginBottom: 16, maxWidth: 760 }}>
        Your retail filter prices by size, type, and MERV, with quantity breaks by total ordered — 1–3, 4–5,
        6–11, and 12+ (case). The 1–3 / 4–5 / 6–11 columns are the price PER FILTER at that quantity; “Case of 12”
        is the total for a full case (used at 12+). These feed the customer portal’s filter ordering.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16, maxWidth: 360 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {/* Bulk import: download a template, then pick a CSV from your computer */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <button className="logout-button" onClick={downloadTemplate}>Download template</button>
        <label className="auth-button" style={{ width: 'auto', padding: '9px 18px', cursor: 'pointer', display: 'inline-block', opacity: selectedOrg ? 1 : 0.5 }}>
          {importing ? 'Importing…' : 'Choose CSV & Import'}
          <input type="file" accept=".csv,text/csv" onChange={handleFile} disabled={importing || !selectedOrg} style={{ display: 'none' }} />
        </label>
        <label style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={clearFirst} onChange={(e) => setClearFirst(e.target.checked)} />
          Clear existing prices before import (recommended for a full vendor upload)
        </label>
      </div>
      <p style={{ fontSize: 12, color: 'var(--mist)', marginTop: 0, marginBottom: 16 }}>
        Columns: Height, Width, Thickness, Type, MERV, 1-3 ea, 4-5 ea, 6-11 ea, Case of 12, Vendor, Notes, Product URL.
      </p>

      {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
      {summary && (
        <div style={{ marginBottom: 18, padding: 16, border: '1px solid var(--border, rgba(255,255,255,0.15))', borderRadius: 10, maxWidth: 460 }}>
          <h3 style={{ marginTop: 0 }}>Import complete</h3>
          <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 8 }}>{summary.total} rows in file</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 26, fontWeight: 700, color: '#1a7f37' }}>{summary.created}</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>created</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 700, color: summary.skipped ? '#9a6a12' : 'var(--mist)' }}>{summary.skipped}</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>skipped</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 700, color: summary.failed ? '#b0342f' : 'var(--mist)' }}>{summary.failed}</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>failed</div></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {summary.skipped > 0 && <button className="logout-button" onClick={() => downloadRows(skipped, 'filter-pricebook-skipped.csv')}>Download skipped rows</button>}
            {summary.failed > 0 && <button className="logout-button" onClick={() => downloadRows(failed, 'filter-pricebook-errors.csv')}>Download failed rows</button>}
          </div>
        </div>
      )}

      {/* Add a single row */}
      <form onSubmit={addRow} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16, padding: 12, background: 'var(--panel)', borderRadius: 8 }}>
        {COLS.map((col) => (
          <div className="field" key={col.key} style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 12 }}>{col.label}</label>
            {cellInput(addForm, setAddForm, col)}
          </div>
        ))}
        <button className="auth-button" type="submit" style={{ width: 'auto', padding: '8px 18px' }} disabled={saving}>{saving ? 'Adding…' : 'Add row'}</button>
      </form>

      {/* The grid */}
      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : rows.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No filter prices yet. Import a CSV above or add a row.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 1050 }}>
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
                          : c.link && r[c.key] ? <a href={r[c.key]} target="_blank" rel="noreferrer">link</a>
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
