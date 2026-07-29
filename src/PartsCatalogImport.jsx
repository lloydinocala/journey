import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { fetchAllRows, normalizeForMatch, readFileSmart } from './utils/csvImport'
import OrgPicker from './OrgPicker'

const BASE_UNITS = ['each', 'ounce', 'pound', 'foot', 'linear foot', 'gallon', 'quart', 'box', 'roll', 'kit']

function txt(v) {
  const t = (v ?? '').toString().trim()
  return t === '' ? null : t
}
function num(v) {
  const t = (v ?? '').toString().trim().replace(/[$,]/g, '')
  if (t === '') return null
  const n = parseFloat(t)
  return isNaN(n) ? null : n
}
function unit(v, fallback) {
  const t = (v ?? '').toString().trim().toLowerCase()
  return BASE_UNITS.includes(t) ? t : fallback
}

// Column headers the importer understands. Matches the catalog's Export CSV so a
// file can be exported, edited in a spreadsheet, and re-imported (round-trip).
const TEMPLATE_ROW = {
  Name: 'Dual Run Capacitor 45/5 MFD 440V',
  Category: 'Capacitors',
  'Base Unit': 'each',
  'Sell Unit': 'each',
  'Sell Unit Factor': '1',
  'Reorder Level': '10',
  'Markup %': '',
  Description: '',
}

export default function PartsCatalogImport({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const orgId = selectedOrg

  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState(null)
  const [failed, setFailed] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  function downloadTemplate() {
    const blob = new Blob([Papa.unparse([TEMPLATE_ROW])], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'parts-catalog-template.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file || !orgId) return
    setError(''); setSummary(null); setFailed([]); setImporting(true)
    try {
      const text = await readFileSmart(file)
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      if (parsed.errors?.length) throw new Error(`CSV parse error: ${parsed.errors[0].message} (row ${parsed.errors[0].row})`)

      const rows = parsed.data
        .map((r) => ({
          generic_name: txt(r.Name ?? r['Generic Name'] ?? r.Item),
          category: txt(r.Category),
          base_unit: unit(r['Base Unit'], 'each'),
          sell_unit: unit(r['Sell Unit'], 'each'),
          sell_unit_factor: num(r['Sell Unit Factor']) ?? 1,
          reorder_level: num(r['Reorder Level']),
          markup_percent: num(r['Markup %'] ?? r['Markup Percent']),
          description: txt(r.Description),
        }))
        .filter((r) => r.generic_name)

      if (rows.length === 0) throw new Error('No valid rows. Each row needs at least a Name.')

      // Existing items for update-vs-insert, matched by name (case-insensitive).
      const existing = await fetchAllRows(() =>
        supabase.from('part_items').select('id, generic_name').eq('org_id', orgId))
      const byName = new Map()
      for (const it of existing) byName.set(normalizeForMatch(it.generic_name), it.id)

      const toInsert = []
      const toUpdate = []
      const seen = new Set()
      for (const r of rows) {
        const key = normalizeForMatch(r.generic_name)
        if (seen.has(key)) continue          // de-dupe within the file itself
        seen.add(key)
        const payload = {
          generic_name: r.generic_name, category: r.category,
          base_unit: r.base_unit, sell_unit: r.sell_unit, sell_unit_factor: r.sell_unit_factor,
          reorder_level: r.reorder_level, markup_percent: r.markup_percent, description: r.description,
          updated_at: new Date().toISOString(),
        }
        const id = byName.get(key)
        if (id) toUpdate.push({ id, payload }); else toInsert.push({ ...payload, org_id: orgId })
      }

      let created = 0
      const fails = []
      for (let i = 0; i < toInsert.length; i += 300) {
        const batch = toInsert.slice(i, i + 300)
        const { error: insErr } = await supabase.from('part_items').insert(batch)
        if (!insErr) { created += batch.length; continue }
        for (const row of batch) {
          const { error: rowErr } = await supabase.from('part_items').insert(row)
          if (rowErr) fails.push({ Name: row.generic_name, reason: rowErr.message }); else created++
        }
      }

      let updated = 0
      for (const u of toUpdate) {
        const { error: upErr } = await supabase.from('part_items').update(u.payload).eq('id', u.id)
        if (upErr) fails.push({ Name: u.payload.generic_name, reason: upErr.message }); else updated++
      }

      setSummary({ created, updated, failed: fails.length, total: rows.length })
      setFailed(fails)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  function downloadFailed() {
    const blob = new Blob([Papa.unparse(failed)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'parts-catalog-import-errors.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <h2 className="page-title">Import Parts Catalog</h2>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 16 }}>
        Bulk-load or update catalog items from a spreadsheet. Rows are matched to existing items by
        <b> Name</b> — a match updates that item, a new name creates one. Cost and on-hand aren't set here;
        those come from receiving. <Link to="/parts-catalog">← Back to Parts Catalog</Link>
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="logout-button" onClick={downloadTemplate}>Download template</button>
        <label className="auth-button" style={{ width: 'auto', padding: '9px 18px', cursor: 'pointer', display: 'inline-block' }}>
          {importing ? 'Importing…' : 'Choose CSV & Import'}
          <input type="file" accept=".csv,text/csv" onChange={handleFile} disabled={importing || !orgId} style={{ display: 'none' }} />
        </label>
      </div>

      <p style={{ fontSize: 13, color: 'var(--mist)' }}>
        Columns: <b>Name</b> (required), Category, Base Unit, Sell Unit, Sell Unit Factor, Reorder Level, Markup %, Description.
      </p>

      {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}

      {summary && (
        <div style={{ marginTop: 18, padding: 16, border: '1px solid var(--border,#e2e4e8)', borderRadius: 10, maxWidth: 460 }}>
          <h3 style={{ marginTop: 0 }}>Import complete</h3>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 26, fontWeight: 700, color: '#1a7f37' }}>{summary.created}</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>created</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 700, color: '#002060' }}>{summary.updated}</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>updated</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 700, color: summary.failed ? '#FF0000' : 'var(--mist)' }}>{summary.failed}</div><div style={{ fontSize: 12, color: 'var(--mist)' }}>failed</div></div>
          </div>
          {summary.failed > 0 && <button className="logout-button" style={{ marginTop: 12 }} onClick={downloadFailed}>Download failed rows</button>}
        </div>
      )}
    </div>
  )
}
