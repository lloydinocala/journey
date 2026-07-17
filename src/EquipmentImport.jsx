import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { supabase } from './utils/supabase'
import { fetchAllRows, normalizeForMatch } from './utils/csvImport'
import OrgPicker from './OrgPicker'

function normText(v) {
  const t = (v || '').toString().trim()
  return t === '' ? null : t
}
function normBool(v) {
  return ['true', '1', 'yes'].includes((v || '').toString().trim().toLowerCase())
}
function normNumber(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}
function normInt(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
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
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file || !orgId) return
    setError('')
    setSummary(null)
    setImporting(true)

    try {
      const text = await file.text()
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      if (parsed.errors && parsed.errors.length > 0) {
        throw new Error(`CSV parse error: ${parsed.errors[0].message} (row ${parsed.errors[0].row})`)
      }

      const rows = parsed.data
        .map((r) => ({
          ahri_ref: normText(r.AhriRef),
          recommended: normBool(r.Recommended),
          home_type: normText(r.HomeType),
          brand_family: normText(r.BrandFamily),
          outdoor_brand: normText(r.OutdoorBrand),
          outdoor_series: normText(r.OutdoorSeries),
          outdoor_model: normText(r.OutdoorModel),
          indoor_brand: normText(r.IndoorBrand),
          indoor_model: normText(r.IndoorModel),
          furnace_model: normText(r.FurnaceModel),
          size_tons: normNumber(r.SizeTons),
          cooling_capacity: normInt(r.CoolingCapacity),
          eer2: normNumber(r.EER2),
          seer2: normNumber(r.SEER2),
          manufactured_in: normText(r.ManufacturedIn),
          system_type: normText(r.SystemType),
          energy_star: normBool(r.EnergyStar),
          florida_rating: normNumber(r.FloridaRating),
          client_rating: normNumber(r.ClientRating),
          labor_warranty: normText(r.LaborWarranty),
          quality_pledge: normBool(r.QualityPledge),
          quality_pledge_years: normInt(r.QualityPledgeYears),
          quality_pledge_issuer: normText(r.QualityPledgeIssuer),
          lineset_requirements: normText(r.LinesetRequirements),
          subtotal: normNumber(r.Subtotal),
          installation_costs: normNumber(r.InstallationCosts),
          installation_price: normNumber(r.InstallationPrice),
          active: r.Active === undefined || r.Active === '' ? true : normBool(r.Active),
        }))
        .filter((r) => r.ahri_ref || r.outdoor_model)

      if (rows.length === 0) {
        throw new Error('No valid rows found. Each row needs at least an AhriRef or an OutdoorModel to identify the system.')
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
      let unmatched = 0

      for (const r of rows) {
        const key = matchKey(r)
        const existingId = key ? existingMap.get(key) : null
        if (existingId) {
          toUpdate.push({ id: existingId, ...r })
        } else {
          toInsert.push({ org_id: orgId, ...r })
          if (!key) unmatched++
        }
      }

      let created = 0
      for (let i = 0; i < toInsert.length; i += 300) {
        const batch = toInsert.slice(i, i + 300)
        const { error: insErr } = await supabase.from('equipment').insert(batch)
        if (insErr) throw insErr
        created += batch.length
      }

      let updated = 0
      for (const u of toUpdate) {
        const { id, ...payload } = u
        await supabase.from('equipment').update(payload).eq('id', id)
        updated++
      }

      setSummary({ created, updated, unmatched, totalRows: rows.length })
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
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
      <p style={{ color: 'var(--mist)', fontSize: 13, marginBottom: 16 }}>
        Re-uploading is safe — a system already on file (matched by AHRI reference, or by the outdoor/indoor/furnace
        model combination when no AHRI reference is given) gets updated rather than duplicated.
      </p>
      <input type="file" accept=".csv" onChange={handleFile} disabled={importing || !orgId} />
      {importing && <p style={{ color: 'var(--mist)', marginTop: 8 }}>Importing…</p>}
      {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
      {summary && (
        <div style={{ background: 'rgba(76, 217, 123, 0.12)', border: '1px solid rgba(76, 217, 123, 0.3)', color: '#1F7A43', fontSize: 13, padding: '10px 12px', borderRadius: 8, marginTop: 12 }}>
          Imported {summary.totalRows} rows: {summary.created} new systems, {summary.updated} updated.
          {summary.unmatched > 0 && ` ${summary.unmatched} row(s) had no AHRI reference or model to match on, so they were added as new.`}
        </div>
      )}
    </div>
  )
}
