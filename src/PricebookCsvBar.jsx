import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { readFileSmart, normPrice } from './utils/csvImport'

// Import / Export / Download Template for a pricebook page — the same three tools every
// pricebook has. The page supplies its columns, how to fetch every row for export, an example
// row for the template, and what to do with the parsed rows on import (it returns a summary).
//   columns: [{ key, label, type: 'text' | 'number' | 'boolean', required }]
export default function PricebookCsvBar({ name, columns, fetchAll, example, onImport, disabled }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const download = (rows, filename) => {
    const csv = Papa.unparse({ fields: columns.map((c) => c.label), data: rows.map((r) => columns.map((c) => cell(r[c.key], c.type))) })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  async function doExport() {
    setBusy('export'); setErr(''); setMsg('')
    try {
      const rows = await fetchAll()
      download(rows, `${slug}-export-${new Date().toISOString().slice(0, 10)}.csv`)
      setMsg(`Exported ${rows.length.toLocaleString()} row${rows.length === 1 ? '' : 's'}.`)
    } catch (e) { setErr(e.message || String(e)) }
    setBusy('')
  }

  function doTemplate() { download([example], `${slug}-template.csv`) }

  async function doImport(file) {
    if (!file) return
    setBusy('import'); setErr(''); setMsg('')
    try {
      const text = await readFileSmart(file)
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => String(h || '').trim() })
      if (parsed.errors?.length) throw new Error(`CSV problem on row ${parsed.errors[0].row}: ${parsed.errors[0].message}`)
      const byLabel = Object.fromEntries(columns.map((c) => [c.label.toLowerCase(), c]))
      const rows = parsed.data.map((raw) => {
        const out = {}
        for (const [h, v] of Object.entries(raw)) {
          const c = byLabel[String(h).toLowerCase()]; if (!c) continue
          out[c.key] = parse(v, c.type)
        }
        return out
      }).filter((r) => Object.values(r).some((v) => v !== null && v !== undefined && v !== ''))
      const missing = columns.filter((c) => c.required && !parsed.meta.fields.some((f) => f.toLowerCase() === c.label.toLowerCase()))
      if (missing.length) throw new Error(`The file is missing column${missing.length > 1 ? 's' : ''}: ${missing.map((c) => c.label).join(', ')}. Download the template to see the layout.`)
      if (!rows.length) throw new Error('No rows found in the file.')
      setMsg(await onImport(rows))
    } catch (e) { setErr(e.message || String(e)) }
    setBusy('')
  }

  const btn = { width: 'auto', margin: 0, padding: '7px 14px' }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = '' }} />
      <button className="logout-button" style={btn} disabled={disabled || !!busy} onClick={() => fileRef.current?.click()}>{busy === 'import' ? 'Importing…' : 'Import CSV'}</button>
      <button className="logout-button" style={btn} disabled={disabled || !!busy} onClick={doExport}>{busy === 'export' ? 'Exporting…' : 'Export CSV'}</button>
      <button className="logout-button" style={btn} disabled={!!busy} onClick={doTemplate}>Download Template</button>
      {msg && <span style={{ fontSize: 13, color: '#1a7f37', fontWeight: 600 }}>{msg}</span>}
      {err && <span style={{ fontSize: 13, color: '#B00020', fontWeight: 600 }}>{err}</span>}
    </div>
  )
}

function cell(v, type) {
  if (v === null || v === undefined) return ''
  if (type === 'boolean') return v ? 'TRUE' : 'FALSE'
  return v
}
function parse(v, type) {
  const s = v === null || v === undefined ? '' : String(v).trim()
  if (type === 'number') return s === '' ? null : normPrice(s)
  if (type === 'boolean') return s === '' ? null : ['true', 'yes', 'y', '1', 'x'].includes(s.toLowerCase())
  return s === '' ? null : s
}
