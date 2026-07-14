import { useState } from 'react'
import { supabase } from './utils/supabase'
import { parseCSV } from './utils/csvImport'

// Shared engine used by each dedicated import page (CustomerImport, PropertyImport, etc).
// Not a route itself — each task-specific page renders this with its own config.
//
// config = {
//   title, table, templateHeaders: string[],
//   fields: [{ key, header, aliases: [], required, type: 'text'|'number'|'date' }],
//   defaults: {} | (orgId) => {},
//   lookupCaches: async (orgId) => ({ ...anything the page's resolveRow needs }),
//   resolveRow: (mappedRow, caches, orgId) => { data: {...} } | { error: 'reason' },
// }

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function autoMap(headers, fields) {
  const mapping = {}
  const missingRequired = []
  fields.forEach((f) => {
    const candidates = [f.header, ...(f.aliases || [])].map(normalize)
    const match = headers.find((h) => candidates.includes(normalize(h)))
    mapping[f.key] = match || null
    if (f.required && !match) missingRequired.push(f.header)
  })
  return { mapping, missingRequired }
}

function downloadTemplate(headers, filename) {
  const csv = headers.join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportEngine({ config, orgId }) {
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('idle') // idle | mapped-error | preview | importing | done
  const [missingRequired, setMissingRequired] = useState([])
  const [validRows, setValidRows] = useState([])
  const [errorRows, setErrorRows] = useState([])
  const [results, setResults] = useState(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setStatus('idle')
    setResults(null)

    const text = await file.text()
    const { headers, rows } = parseCSV(text)
    const { mapping, missingRequired: missing } = autoMap(headers, config.fields)

    if (missing.length > 0) {
      setMissingRequired(missing)
      setStatus('mapped-error')
      return
    }

    const caches = config.lookupCaches ? await config.lookupCaches(orgId) : {}
    const defaults = typeof config.defaults === 'function' ? config.defaults(orgId) : config.defaults || {}

    const good = []
    const bad = []
    rows.forEach((row, idx) => {
      const mappedRow = {}
      config.fields.forEach((f) => {
        const csvHeader = mapping[f.key]
        mappedRow[f.key] = csvHeader ? row[csvHeader] : ''
      })

      if (config.fields.some((f) => f.required && !mappedRow[f.key])) {
        bad.push({ rowNum: idx + 2, reason: 'Missing a required value', raw: mappedRow })
        return
      }

      const result = config.resolveRow(mappedRow, caches, orgId)
      if (result.error) {
        bad.push({ rowNum: idx + 2, reason: result.error, raw: mappedRow })
      } else {
        good.push({ ...defaults, org_id: orgId, ...result.data })
      }
    })

    setValidRows(good)
    setErrorRows(bad)
    setStatus('preview')
  }

  async function runImport() {
    setStatus('importing')
    let succeeded = 0
    const failed = []
    const chunkSize = 15

    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize)
      const outcomes = await Promise.all(
        chunk.map(async (row) => {
          const { error } = await supabase.from(config.table).insert(row)
          return error ? { row, error: error.message } : { row, error: null }
        })
      )
      outcomes.forEach((o) => {
        if (o.error) failed.push({ reason: o.error, raw: o.row })
        else succeeded++
      })
    }

    setResults({ succeeded, failed })
    setStatus('done')
  }

  function downloadErrors(rows, label) {
    if (rows.length === 0) return
    const keys = Object.keys(rows[0].raw)
    const csv = [
      ['Row', 'Reason', ...keys].join(','),
      ...rows.map((r) =>
        [r.rowNum || '', `"${r.reason.replace(/"/g, '""')}"`, ...keys.map((k) => `"${String(r.raw[k] ?? '').replace(/"/g, '""')}"`)].join(',')
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = label + '-errors.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h2 className="page-title">{config.title}</h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="logout-button" onClick={() => downloadTemplate(config.templateHeaders, config.table + '-template.csv')}>
          Download CSV Template
        </button>
        <label className="auth-button" style={{ width: 'auto', padding: '8px 20px', margin: 0, cursor: 'pointer' }}>
          Choose CSV File
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
        </label>
        {fileName && <span style={{ color: 'var(--mist)', fontSize: 13 }}>{fileName}</span>}
      </div>

      {status === 'mapped-error' && (
        <div className="auth-error">
          Couldn't find a column for: <strong>{missingRequired.join(', ')}</strong>. Rename that column in your CSV
          (or use the template) and upload again.
        </div>
      )}

      {status === 'preview' && (
        <div>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: '#2a7' }}>{validRows.length} ready to import</strong>
            {errorRows.length > 0 && (
              <span style={{ color: '#a33', marginLeft: 16 }}>{errorRows.length} rows have problems</span>
            )}
          </p>

          {errorRows.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorRows.slice(0, 100).map((r, i) => (
                      <tr key={i}>
                        <td>{r.rowNum}</td>
                        <td>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="logout-button" style={{ marginTop: 8 }} onClick={() => downloadErrors(errorRows, config.table)}>
                Download Error List
              </button>
            </div>
          )}

          <button className="auth-button" style={{ width: 'auto', padding: '10px 24px' }} onClick={runImport} disabled={validRows.length === 0}>
            Import {validRows.length} Rows
          </button>
        </div>
      )}

      {status === 'importing' && <p style={{ color: 'var(--mist)' }}>Importing…</p>}

      {status === 'done' && results && (
        <div>
          <p style={{ color: '#2a7', fontWeight: 600 }}>{results.succeeded} imported successfully.</p>
          {results.failed.length > 0 && (
            <div>
              <p style={{ color: '#a33' }}>{results.failed.length} failed during import.</p>
              <button className="logout-button" onClick={() => downloadErrors(results.failed, config.table + '-import')}>
                Download Failure List
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
