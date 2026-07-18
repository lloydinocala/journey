import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { supabase } from './utils/supabase'
import { fetchAllRows, normalizeForMatch, normPrice, readFileSmart } from './utils/csvImport'
import OrgPicker from './OrgPicker'

function normKey(v) {
  const t = (v || '').toString().trim()
  return t === '' ? null : t
}

export default function PricebookImport({ profile }) {
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
  const [failedRows, setFailedRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

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
          category: normKey(r.Category),
          name: normKey(r.Item),
          location: normKey(r.Location),
          access: normKey(r.Access),
          hours: normKey(r.Hours),
          part_source: normKey(r.PartSrc),
          customer_display: normKey(r.CustomerDisplay),
          price: normPrice(r.Price),
          cost: normPrice(r.Cost),
          task_hours: normPrice(r.TaskHrs),
          is_tax_exempt: ['true', '1', 'yes'].includes((r.Exempt || '').toString().trim().toLowerCase()),
        }))
        .filter((r) => r.category && r.name)

      if (rows.length === 0) {
        throw new Error('No valid rows found. Check that your CSV has Category and Item columns filled in.')
      }

      const serviceMap = new Map()
      for (const r of rows) {
        const key = `${normalizeForMatch(r.category)}|${normalizeForMatch(r.name)}`
        if (!serviceMap.has(key)) {
          serviceMap.set(key, { category: r.category, name: r.name, is_tax_exempt: r.is_tax_exempt })
        } else if (r.is_tax_exempt) {
          serviceMap.get(key).is_tax_exempt = true
        }
      }

      const existingServices = await fetchAllRows(() =>
        supabase.from('services').select('id, category, name').eq('org_id', orgId)
      )

      const existingServiceMap = new Map()
      for (const s of existingServices) {
        existingServiceMap.set(`${normalizeForMatch(s.category)}|${normalizeForMatch(s.name)}`, s.id)
      }

      const newServices = []
      for (const [key, svc] of serviceMap.entries()) {
        if (!existingServiceMap.has(key)) {
          newServices.push({ org_id: orgId, category: svc.category, name: svc.name, is_tax_exempt: svc.is_tax_exempt })
        }
      }

      let servicesCreated = 0
      for (let i = 0; i < newServices.length; i += 300) {
        const batch = newServices.slice(i, i + 300)
        const { data: inserted, error: insErr } = await supabase.from('services').insert(batch).select('id, category, name')
        if (insErr) throw insErr
        for (const s of inserted) {
          existingServiceMap.set(`${normalizeForMatch(s.category)}|${normalizeForMatch(s.name)}`, s.id)
        }
        servicesCreated += inserted.length
      }

      const existingPrices = await fetchAllRows(() =>
        supabase.from('service_prices').select('id, service_id, location, access, hours, part_source').eq('org_id', orgId)
      )

      function comboKey(serviceId, r) {
        return [serviceId, normalizeForMatch(r.location), normalizeForMatch(r.access), normalizeForMatch(r.hours), normalizeForMatch(r.part_source)].join('~~')
      }

      const existingPriceMap = new Map()
      for (const p of existingPrices) {
        existingPriceMap.set(comboKey(p.service_id, p), p.id)
      }

      const toInsert = []
      const toUpdate = []
      const failedRows = []
      for (const r of rows) {
        const serviceId = existingServiceMap.get(`${normalizeForMatch(r.category)}|${normalizeForMatch(r.name)}`)
        if (!serviceId) {
          failedRows.push({ category: r.category, name: r.name, location: r.location, access: r.access, hours: r.hours, part_source: r.part_source, reason: 'Could not resolve or create a matching service for this Category/Item.' })
          continue
        }
        const key = comboKey(serviceId, r)
        const existingId = existingPriceMap.get(key)
        const payload = {
          service_id: serviceId,
          org_id: orgId,
          location: r.location,
          access: r.access,
          hours: r.hours,
          part_source: r.part_source,
          customer_display: r.customer_display || r.name,
          price: r.price,
          cost: r.cost,
          task_hours: r.task_hours,
        }
        if (existingId) {
          toUpdate.push({ id: existingId, payload, source: r })
        } else {
          toInsert.push({ row: payload, source: r })
        }
      }

      // Batch inserts are atomic — one bad row fails the whole batch of up to
      // 300, including every good row riding along with it. On a batch
      // failure, retry that batch's rows one at a time so the good ones
      // still get saved, and only the genuinely bad ones get reported.
      let pricesCreated = 0
      for (let i = 0; i < toInsert.length; i += 300) {
        const batch = toInsert.slice(i, i + 300)
        const { error: insErr } = await supabase.from('service_prices').insert(batch.map((b) => b.row))
        if (!insErr) {
          pricesCreated += batch.length
        } else {
          for (const item of batch) {
            const { error: rowErr } = await supabase.from('service_prices').insert(item.row)
            if (rowErr) {
              const r = item.source
              failedRows.push({ category: r.category, name: r.name, location: r.location, access: r.access, hours: r.hours, part_source: r.part_source, reason: rowErr.message })
            } else {
              pricesCreated++
            }
          }
        }
        setProgress(`Adding price points… ${Math.min(i + 300, toInsert.length)} of ${toInsert.length}`)
      }

      let pricesUpdated = 0
      const updateChunkSize = 15
      for (let i = 0; i < toUpdate.length; i += updateChunkSize) {
        const chunk = toUpdate.slice(i, i + updateChunkSize)
        const results = await Promise.all(
          chunk.map(({ id, payload }) => supabase.from('service_prices').update(payload).eq('id', id))
        )
        results.forEach((r, idx) => {
          if (r.error) {
            const src = chunk[idx].source
            failedRows.push({ category: src.category, name: src.name, location: src.location, access: src.access, hours: src.hours, part_source: src.part_source, reason: r.error.message })
          } else {
            pricesUpdated++
          }
        })
        setProgress(`Updating price points… ${Math.min(i + updateChunkSize, toUpdate.length)} of ${toUpdate.length}`)
      }

      setSummary({ servicesCreated, pricesCreated, pricesUpdated, totalRows: rows.length, failed: failedRows.length })
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
      <h2 className="page-title">Import Services Pricebook</h2>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>
            Importing into organization
          </label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <p style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 16 }}>
        Upload a CSV with columns: Category, Item, Location, Access, Hours, PartSrc, Price, Cost, TaskHrs,
        CustomerDisplay, Exempt. Re-uploading is safe — existing items are matched and updated, not duplicated.
      </p>
      <input type="file" accept=".csv" onChange={handleFile} disabled={importing || !orgId} />
      {importing && <p style={{ color: 'var(--mist)', marginTop: 8 }}>{progress || 'Importing…'}</p>}
      {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
      {summary && (
        <div style={{ background: 'rgba(76, 217, 123, 0.12)', border: '1px solid rgba(76, 217, 123, 0.3)', color: '#1F7A43', fontSize: 13, padding: '10px 12px', borderRadius: 8, marginTop: 12 }}>
          Imported {summary.totalRows} rows: {summary.servicesCreated} new services, {summary.pricesCreated} new price points, {summary.pricesUpdated} updated
          {summary.failed ? `, ${summary.failed} failed` : ''}.
        </div>
      )}
      {failedRows.length > 0 && (
        <p style={{ marginTop: 8 }}>
          <button
            className="logout-button"
            onClick={() => {
              const csv = Papa.unparse(failedRows.map((r) => ({
                Category: r.category, Item: r.name, Location: r.location, Access: r.access, Hours: r.hours, PartSrc: r.part_source, Reason: r.reason,
              })))
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `services-pricebook-import-failures-${new Date().toISOString().slice(0, 10)}.csv`
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
