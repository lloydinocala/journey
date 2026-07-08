import { useState } from 'react'
import Papa from 'papaparse'
import { supabase } from './utils/supabase'

function normKey(v) {
  const t = (v || '').toString().trim()
  return t === '' ? null : t
}

export default function PricebookImport({ orgId }) {
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
          category: normKey(r.Category),
          name: normKey(r.Item),
          location: normKey(r.Location),
          access: normKey(r.Access),
          hours: normKey(r.Hours),
          part_source: normKey(r.PartSrc),
          customer_display: normKey(r.CustomerDisplay),
          price: parseFloat(r.Price) || 0,
          cost: parseFloat(r.Cost) || 0,
          task_hours: parseFloat(r.TaskHrs) || 0,
          is_tax_exempt: ['true', '1', 'yes'].includes((r.Exempt || '').toString().trim().toLowerCase()),
        }))
        .filter((r) => r.category && r.name)

      if (rows.length === 0) {
        throw new Error('No valid rows found. Check that your CSV has Category and Item columns filled in.')
      }

      const serviceMap = new Map()
      for (const r of rows) {
        const key = `${r.category}|${r.name}`
        if (!serviceMap.has(key)) {
          serviceMap.set(key, { category: r.category, name: r.name, is_tax_exempt: r.is_tax_exempt })
        } else if (r.is_tax_exempt) {
          serviceMap.get(key).is_tax_exempt = true
        }
      }

      const { data: existingServices, error: svcFetchErr } = await supabase
        .from('services')
        .select('id, category, name')
        .eq('org_id', orgId)
      if (svcFetchErr) throw svcFetchErr

      const existingServiceMap = new Map()
      for (const s of existingServices) {
        existingServiceMap.set(`${s.category}|${s.name}`, s.id)
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
          existingServiceMap.set(`${s.category}|${s.name}`, s.id)
        }
        servicesCreated += inserted.length
      }

      const { data: existingPrices, error: priceFetchErr } = await supabase
        .from('service_prices')
        .select('id, service_id, location, access, hours, part_source')
        .eq('org_id', orgId)
      if (priceFetchErr) throw priceFetchErr

      function comboKey(serviceId, r) {
        return [serviceId, r.location || '', r.access || '', r.hours || '', r.part_source || ''].join('~~')
      }

      const existingPriceMap = new Map()
      for (const p of existingPrices) {
        existingPriceMap.set(comboKey(p.service_id, p), p.id)
      }

      const toInsert = []
      const toUpdate = []
      for (const r of rows) {
        const serviceId = existingServiceMap.get(`${r.category}|${r.name}`)
        if (!serviceId) continue
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
          toUpdate.push({ id: existingId, ...payload })
        } else {
          toInsert.push(payload)
        }
      }

      let pricesCreated = 0
      for (let i = 0; i < toInsert.length; i += 300) {
        const batch = toInsert.slice(i, i + 300)
        const { error: insErr } = await supabase.from('service_prices').insert(batch)
        if (insErr) throw insErr
        pricesCreated += batch.length
      }

      let pricesUpdated = 0
      for (const u of toUpdate) {
        const { id, ...payload } = u
        await supabase.from('service_prices').update(payload).eq('id', id)
        pricesUpdated++
      }

      setSummary({ servicesCreated, pricesCreated, pricesUpdated, totalRows: rows.length })
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Pricebook import</h3>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -6, marginBottom: 16 }}>
        Upload a CSV with columns: Category, Item, Location, Access, Hours, PartSrc, Price, Cost, TaskHrs,
        CustomerDisplay, Exempt. Re-uploading is safe — existing items are matched and updated, not duplicated.
      </p>
      <input type="file" accept=".csv" onChange={handleFile} disabled={importing || !orgId} />
      {importing && <p style={{ color: 'var(--mist)', marginTop: 8 }}>Importing…</p>}
      {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
      {summary && (
        <div style={{ background: 'rgba(76, 217, 123, 0.12)', border: '1px solid rgba(76, 217, 123, 0.3)', color: '#1F7A43', fontSize: 13, padding: '10px 12px', borderRadius: 8, marginTop: 12 }}>
          Imported {summary.totalRows} rows: {summary.servicesCreated} new services, {summary.pricesCreated} new price points, {summary.pricesUpdated} updated.
        </div>
      )}
    </div>
  )
}
