import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { supabase } from './utils/supabase'
import { fetchAllRows, normalizeForMatch, readFileSmart, normPrice } from './utils/csvImport'
import OrgPicker from './OrgPicker'

function normText(v) {
  const t = (v || '').toString().trim()
  return t === '' ? null : t
}
function normBool(v) {
  return ['true', '1', 'yes'].includes((v || '').toString().trim().toLowerCase())
}
function normNumber(v) {
  return normPrice(v) === 0 && !String(v || '').trim() ? null : normPrice(v)
}
function normInt(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

// Accepts either this page's own PascalCase headers, or the human-readable
// headers produced by the Systems Pricebook page's own Export CSV button —
// the same underlying data, uploaded from either place, should just work.
function pick(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k]
  }
  return row[keys[0]]
}

// AHRI reference numbers are the HVAC industry's actual unique ID for a specific
// outdoor+indoor+furnace combination — the natural key for matching a re-import
// back to an existing system. When a row has no AHRI ref, fall back to matching
// on the model combination itself; if even that's blank, the row can't be
// reliably matched against anything already on file, so it's always inserted
// fresh rather than risking a wrong match.
function matchKey(r) {
  if (r.ahri_ref) return 'ahri:' + normalizeForMatch(r.ahri_ref)
  if (r.outdoor_model || r.indoor_model || r.furnace_model) {
    return 'combo:' + [r.outdoor_model, r.indoor_model, r.furnace_model, r.size_tons].map(normalizeForMatch).join('~~')
  }
  return null
}

export default function EquipmentImport({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const orgId = selectedOrg

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [summary, setSummary] = useState(null)
  const [failedRows, setFailedRows] = useState([])
  const [error, setError] = useState('')

  function downloadTemplate() {
    const csv = Papa.unparse([
      {
        AhriRef: '217730630', Recommended: 'TRUE', HomeType: 'Both', BrandFamily: 'Trending in 2026',
        OutdoorBrand: 'BRYANT', OutdoorSeries: 'D5C Series', OutdoorModel: 'D5CUHAH18AAK', IndoorBrand: 'BRYANT',
        IndoorModel: 'D5MUWAQ18XA3', FurnaceModel: '', SizeTons: '1.5', CoolingCapacity: '18000', EER2: '12.1',
        SEER2: '19.3', ManufacturedIn: '', SystemType: 'Apt CrossOver', EnergyStar: 'TRUE', FloridaRating: '4.5',
        ClientRating: '4.9', LaborWarranty: '2', QualityPledge: 'FALSE', QualityPledgeYears: '', QualityPledgeIssuer: '',
        LinesetRequirements: '3/4" & 3/8" Copper Lines', Subtotal: '6500', InstallationCosts: '', InstallationPrice: '25000',
        Active: 'TRUE',
      },
    ])
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'systems-pricebook-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file || !orgId) return
    setError('')
    setSummary(null)
    setFailedRows([])
    setImporting(true)

    try {
      const text = await readFileSmart(file)
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      if (parsed.errors && parsed.errors.length > 0) {
        throw new Error(`CSV parse error: ${parsed.errors[0].message} (row ${parsed.errors[0].row})`)
      }

      const rows = parsed.data
        .map((r) => ({
          ahri_ref: normText(pick(r, 'AhriRef', 'AHRI Ref #')),
          recommended: normBool(pick(r, 'Recommended', 'Recommended')),
          home_type: normText(pick(r, 'HomeType', 'Home Type')),
          brand_family: normText(pick(r, 'BrandFamily', 'Brand Family')),
          outdoor_brand: normText(pick(r, 'OutdoorBrand', 'Outdoor Brand')),
          outdoor_series: normText(pick(r, 'OutdoorSeries', 'Outdoor Series')),
          outdoor_model: normText(pick(r, 'OutdoorModel', 'Outdoor Model')),
          indoor_brand: normText(pick(r, 'IndoorBrand', 'Indoor Brand')),
          indoor_model: normText(pick(r, 'IndoorModel', 'Indoor Model')),
          furnace_model: normText(pick(r, 'FurnaceModel', 'Furnace Model')),
          size_tons: normNumber(pick(r, 'SizeTons', 'Size (Tons)')),
          cooling_capacity: normInt(pick(r, 'CoolingCapacity', 'Cooling Cap')),
          eer2: normNumber(pick(r, 'EER2', 'EER2')),
          seer2: normNumber(pick(r, 'SEER2', 'SEER2')),
          manufactured_in: normText(pick(r, 'ManufacturedIn', 'Manufactured In')),
          system_type: normText(pick(r, 'SystemType', 'System Type')),
          energy_star: normBool(pick(r, 'EnergyStar', 'Energy Star')),
          florida_rating: normNumber(pick(r, 'FloridaRating', 'FL Rating')),
          client_rating: normNumber(pick(r, 'ClientRating', 'Client Rating')),
          labor_warranty: normText(pick(r, 'LaborWarranty', 'Labor Warranty')),
          quality_pledge: normBool(pick(r, 'QualityPledge', 'Quality Pledge')),
          quality_pledge_years: normInt(pick(r, 'QualityPledgeYears', 'Pledge Years')),
          quality_pledge_issuer: normText(pick(r, 'QualityPledgeIssuer', 'Pledge Issuer')),
          lineset_requirements: normText(pick(r, 'LinesetRequirements', 'Lineset')),
          subtotal: normNumber(pick(r, 'Subtotal', 'Subtotal')),
          installation_costs: normNumber(pick(r, 'InstallationCosts', 'Our Cost')),
          installation_price: normNumber(pick(r, 'InstallationPrice', 'Installation Price')),
          active: (() => {
            const v = pick(r, 'Active', 'Active')
            return v === undefined || v === '' ? true : normBool(v)
          })(),
        }))
        .filter((r) => r.ahri_ref || r.outdoor_model)

      if (rows.length === 0) {
        throw new Error('No valid rows found. Each row needs at least an AhriRef (or "AHRI Ref #") or an OutdoorModel (or "Outdoor Model") to identify the system.')
      }

      const existingEquipment = await fetchAllRows(() =>
        supabase
          .from('equipment')
          .select('id, ahri_ref, outdoor_model, indoor_model, furnace_model, size_tons')
          .eq('org_id', orgId)
      )

      const existingMap = new Map()
      for (const eq of existingEquipment) {
        const key = matchKey(eq)
        if (key) existingMap.set(key, eq.id)
      }

      const toInsert = []
      const toUpdate = []
      const failedRows = []
      let unmatched = 0

      for (const r of rows) {
        const key = matchKey(r)
        const existingId = key ? existingMap.get(key) : null
        if (existingId) {
          toUpdate.push({ id: existingId, row: r })
        } else {
          toInsert.push({ row: { org_id: orgId, ...r } })
          if (!key) unmatched++
        }
      }

      function rowLabel(r) {
        return r.ahri_ref || [r.outdoor_model, r.indoor_model, r.furnace_model].filter(Boolean).join(' / ') || '(no identifying model or AHRI ref)'
      }

      // Batch inserts are atomic — one bad row fails the whole batch of up to
      // 300, including every good row riding along with it. On a batch
      // failure, retry that batch's rows one at a time so the good ones
      // still get saved, and only the genuinely bad ones get reported.
      let created = 0
      for (let i = 0; i < toInsert.length; i += 300) {
        const batch = toInsert.slice(i, i + 300)
        const { error: insErr } = await supabase.from('equipment').insert(batch.map((b) => b.row))
        if (!insErr) {
          created += batch.length
        } else {
          for (const item of batch) {
            const { error: rowErr } = await supabase.from('equipment').insert(item.row)
            if (rowErr) failedRows.push({ system: rowLabel(item.row), reason: rowErr.message })
            else created++
          }
        }
        setProgress(`Adding systems… ${Math.min(i + 300, toInsert.length)} of ${toInsert.length}`)
      }

      let updated = 0
      const updateChunkSize = 15
      for (let i = 0; i < toUpdate.length; i += updateChunkSize) {
        const chunk = toUpdate.slice(i, i + updateChunkSize)
        const results = await Promise.all(
          chunk.map(({ id, row }) => supabase.from('equipment').update(row).eq('id', id))
        )
        results.forEach((r, idx) => {
          if (r.error) failedRows.push({ system: rowLabel(chunk[idx].row), reason: r.error.message })
          else updated++
        })
        setProgress(`Updating systems… ${Math.min(i + updateChunkSize, toUpdate.length)} of ${toUpdate.length}`)
      }

      setSummary({ created, updated, unmatched, totalRows: rows.length, failed: failedRows.length })
      setFailedRows(failedRows)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
      setProgress('')
      e.target.value = ''
    }
  }

  return (
    <div>
      <h2 className="page-title">Import Systems Pricebook</h2>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>
            Importing into organization
          </label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <p style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 8 }}>
        Upload a CSV with columns: AhriRef, Recommended, HomeType, BrandFamily, OutdoorBrand, OutdoorSeries,
        OutdoorModel, IndoorBrand, IndoorModel, FurnaceModel, SizeTons, CoolingCapacity, EER2, SEER2, ManufacturedIn,
        SystemType, EnergyStar, FloridaRating, ClientRating, LaborWarranty, QualityPledge, QualityPledgeYears,
        QualityPledgeIssuer, LinesetRequirements, Subtotal, InstallationCosts, InstallationPrice, Active.
      </p>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginBottom: 8 }}>
        A file exported from the Systems Pricebook page itself also works — its column names ("AHRI Ref #", "Size
        (Tons)", "Our Cost", etc.) are recognized automatically, no renaming needed.
      </p>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginBottom: 16 }}>
        Re-uploading is safe — a system already on file (matched by AHRI reference, or by the outdoor/indoor/furnace
        model combination when no AHRI reference is given) gets updated rather than duplicated.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="file" accept=".csv" onChange={handleFile} disabled={importing || !orgId} />
        <button className="logout-button" onClick={downloadTemplate} type="button">Download Template</button>
      </div>
      {importing && <p style={{ color: 'var(--mist)', marginTop: 8 }}>{progress || 'Importing…'}</p>}
      {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
      {summary && (
        <div style={{ background: 'rgba(76, 217, 123, 0.12)', border: '1px solid rgba(76, 217, 123, 0.3)', color: '#1F7A43', fontSize: 13, padding: '10px 12px', borderRadius: 8, marginTop: 12 }}>
          Imported {summary.totalRows} rows: {summary.created} new systems, {summary.updated} updated
          {summary.failed ? `, ${summary.failed} failed` : ''}.
          {summary.unmatched > 0 && ` ${summary.unmatched} row(s) had no AHRI reference or model to match on, so they were added as new.`}
        </div>
      )}
      {failedRows.length > 0 && (
        <p style={{ marginTop: 8 }}>
          <button
            className="logout-button"
            onClick={() => {
              const csv = Papa.unparse(failedRows.map((r) => ({ System: r.system, Reason: r.reason })))
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `systems-pricebook-import-failures-${new Date().toISOString().slice(0, 10)}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            Download {failedRows.length} failed row{failedRows.length === 1 ? '' : 's'} (CSV)
          </button>
        </p>
      )}
    </div>
  )
}
