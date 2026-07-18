import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { fetchAllRows, normalizeForMatch, readFileSmart, normPrice } from './utils/csvImport'

const LOCATIONS = ['Ground Level', 'Attic or Ceiling', 'Roof or Sub-Level']
const ACCESS_OPTS = ['Standard Access', 'Difficult Access']
const HOURS_OPTS = ['Standard Hours', 'Extended Hours']
const PART_SOURCES = ['', 'OEM', 'Aftermarket']

export default function Pricebook({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [services, setServices] = useState([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [importFailedRows, setImportFailedRows] = useState([])
  const [importSummary, setImportSummary] = useState('')

  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceCategory, setNewServiceCategory] = useState('')
  const [useNewCategory, setUseNewCategory] = useState(false)
  const [newServiceExempt, setNewServiceExempt] = useState(false)
  const [taxableByDefault, setTaxableByDefault] = useState(false)
  const [savingService, setSavingService] = useState(false)
  const [serviceError, setServiceError] = useState('')

  const [editingServiceId, setEditingServiceId] = useState(null)
  const [editServiceName, setEditServiceName] = useState('')
  const [editServiceCategory, setEditServiceCategory] = useState('')

  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const [selectedServiceInfo, setSelectedServiceInfo] = useState(null)
  const [variants, setVariants] = useState([])
  const [loadingVariants, setLoadingVariants] = useState(false)

  const [newLocation, setNewLocation] = useState(LOCATIONS[0])
  const [newAccess, setNewAccess] = useState(ACCESS_OPTS[0])
  const [newHours, setNewHours] = useState(HOURS_OPTS[0])
  const [newPartSource, setNewPartSource] = useState('')
  const [newDisplay, setNewDisplay] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCost, setNewCost] = useState('')
  const [newTaskHours, setNewTaskHours] = useState('')
  const [savingVariant, setSavingVariant] = useState(false)
  const [variantError, setVariantError] = useState('')

  const [editingVariantId, setEditingVariantId] = useState(null)
  const [editLocation, setEditLocation] = useState('')
  const [editAccess, setEditAccess] = useState('')
  const [editHours, setEditHours] = useState('')
  const [editPartSource, setEditPartSource] = useState('')
  const [editDisplay, setEditDisplay] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editTaskHours, setEditTaskHours] = useState('')

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  useEffect(() => {
    if (!selectedOrg) return
    supabase
      .from('organizations')
      .select('services_taxable_by_default')
      .eq('id', selectedOrg)
      .single()
      .then(({ data }) => {
        if (data) {
          setTaxableByDefault(data.services_taxable_by_default)
          setNewServiceExempt(!data.services_taxable_by_default)
        }
      })
  }, [selectedOrg])

  async function loadServices(orgId) {
    if (!orgId) return
    setLoadingServices(true)
    const data = await fetchAllRows(() =>
      supabase
        .from('services')
        .select('id, category, name, is_tax_exempt, is_active')
        .eq('org_id', orgId)
        .eq('is_active', !showArchived)
        .order('category')
        .order('name')
    )
    setServices(data)
    setLoadingServices(false)
  }

  useEffect(() => {
    loadServices(selectedOrg)
    setSelectedServiceId(null)
    setVariants([])
  }, [selectedOrg, showArchived])

  const categories = [...new Set(services.map((s) => s.category))].sort()
  const filteredServices = services.filter((s) => {
    if (categoryFilter && s.category !== categoryFilter) return false
    return true
  })

  async function handleAddService(e) {
    e.preventDefault()
    setServiceError('')
    if (!newServiceName.trim() || !newServiceCategory.trim()) return
    setSavingService(true)
    const { error } = await supabase.from('services').insert({
      org_id: selectedOrg,
      category: newServiceCategory.trim(),
      name: newServiceName.trim(),
      is_tax_exempt: newServiceExempt,
    })
    setSavingService(false)
    if (error) {
      setServiceError(error.message)
    } else {
      setNewServiceName('')
      setNewServiceExempt(!taxableByDefault)
      loadServices(selectedOrg)
    }
  }

  function startEditService(s) {
    setEditingServiceId(s.id)
    setEditServiceName(s.name)
    setEditServiceCategory(s.category)
  }

  async function saveEditService(id) {
    await supabase
      .from('services')
      .update({ name: editServiceName.trim(), category: editServiceCategory.trim() })
      .eq('id', id)
    setEditingServiceId(null)
    loadServices(selectedOrg)
  }

  async function toggleServiceActive(s) {
    const action = s.is_active ? 'archive' : 'reactivate'
    if (!window.confirm(`Are you sure you want to ${action} "${s.name}"? This does not delete its price history.`)) return
    await supabase.from('services').update({ is_active: !s.is_active }).eq('id', s.id)
    if (selectedServiceId === s.id) setSelectedServiceId(null)
    loadServices(selectedOrg)
  }

  async function handleExport() {
    setExporting(true)
    const allServices = await fetchAllRows(() =>
      supabase.from('services').select('id, category, name, is_tax_exempt').eq('org_id', selectedOrg)
    )
    const allVariants = await fetchAllRows(() =>
      supabase
        .from('service_prices')
        .select('id, service_id, location, access, hours, part_source, customer_display, price, cost, task_hours')
        .eq('org_id', selectedOrg)
    )

    const serviceMap = new Map(allServices.map((s) => [s.id, s]))
    const rows = allVariants.map((v) => {
      const svc = serviceMap.get(v.service_id)
      return {
        PriceID: v.id,
        Category: svc?.category || '',
        Item: svc?.name || '',
        Location: v.location || '',
        Access: v.access || '',
        Hours: v.hours || '',
        PartSrc: v.part_source || '',
        Price: v.price,
        Cost: v.cost,
        TaskHrs: v.task_hours,
        CustomerDisplay: v.customer_display || '',
        Exempt: svc?.is_tax_exempt ? 'TRUE' : 'FALSE',
      }
    })

    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pricebook-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  // Mirrors Systems Pricebook's export/edit/re-import workflow: a row with a
  // PriceID updates that exact existing service_prices row (and keeps its
  // parent service's category/name/exempt flag in sync); a row with no
  // PriceID is a brand-new price point, same find-or-create-service logic
  // the standalone Import Services Pricebook page uses.
  async function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file || !selectedOrg) return
    setImporting(true)
    setImportSummary('')
    setImportFailedRows([])

    const text = await readFileSmart(file)

    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data
            .map((r) => ({
              priceId: (r.PriceID || '').toString().trim() || null,
              category: (r.Category || '').toString().trim(),
              name: (r.Item || '').toString().trim(),
              location: (r.Location || '').toString().trim() || null,
              access: (r.Access || '').toString().trim() || null,
              hours: (r.Hours || '').toString().trim() || null,
              part_source: (r.PartSrc || '').toString().trim() || null,
              customer_display: (r.CustomerDisplay || '').toString().trim() || null,
              price: r.Price === '' || r.Price === undefined ? null : normPrice(r.Price),
              cost: r.Cost === '' || r.Cost === undefined ? null : normPrice(r.Cost),
              task_hours: r.TaskHrs === '' || r.TaskHrs === undefined ? null : normPrice(r.TaskHrs),
              is_tax_exempt: ['true', '1', 'yes'].includes((r.Exempt || '').toString().trim().toLowerCase()),
            }))
            .filter((r) => r.category && r.name)

          // Find-or-create every service referenced, same as the standalone importer.
          const existingServices = await fetchAllRows(() =>
            supabase.from('services').select('id, category, name').eq('org_id', selectedOrg)
          )
          const serviceMap = new Map(existingServices.map((s) => [`${normalizeForMatch(s.category)}|${normalizeForMatch(s.name)}`, s.id]))

          const neededKeys = new Map()
          for (const r of rows) {
            const key = `${normalizeForMatch(r.category)}|${normalizeForMatch(r.name)}`
            if (!serviceMap.has(key) && !neededKeys.has(key)) {
              neededKeys.set(key, { category: r.category, name: r.name, is_tax_exempt: r.is_tax_exempt })
            } else if (r.is_tax_exempt && neededKeys.has(key)) {
              neededKeys.get(key).is_tax_exempt = true
            }
          }
          if (neededKeys.size > 0) {
            const newServicesList = [...neededKeys.values()].map((s) => ({ org_id: selectedOrg, ...s }))
            for (let i = 0; i < newServicesList.length; i += 300) {
              const batch = newServicesList.slice(i, i + 300)
              const { data: created, error: createErr } = await supabase.from('services').insert(batch).select('id, category, name')
              if (createErr) throw createErr
              for (const s of created) serviceMap.set(`${normalizeForMatch(s.category)}|${normalizeForMatch(s.name)}`, s.id)
            }
          }

          // Tax-exempt only needs setting once per service, not once per price row.
          const exemptServiceIds = new Set()
          for (const r of rows) {
            if (r.is_tax_exempt) {
              const sid = serviceMap.get(`${normalizeForMatch(r.category)}|${normalizeForMatch(r.name)}`)
              if (sid) exemptServiceIds.add(sid)
            }
          }
          for (const sid of exemptServiceIds) {
            await supabase.from('services').update({ is_tax_exempt: true }).eq('id', sid)
          }

          // Split into inserts vs updates so brand-new rows (the overwhelming
          // majority on a fresh import) go in true multi-row batches — a few
          // hundred network calls instead of one per row, which is what was
          // silently failing past the first ~100 rows before.
          let failed = 0
          const toInsert = []
          const toUpdate = []
          const failedRows = []
          for (const r of rows) {
            const serviceId = serviceMap.get(`${normalizeForMatch(r.category)}|${normalizeForMatch(r.name)}`)
            if (!serviceId) {
              failed++
              failedRows.push({ category: r.category, name: r.name, location: r.location, access: r.access, hours: r.hours, part_source: r.part_source, reason: 'Could not resolve or create a matching service for this Category/Item.' })
              continue
            }
            const payload = {
              service_id: serviceId,
              location: r.location,
              access: r.access,
              hours: r.hours,
              part_source: r.part_source,
              customer_display: r.customer_display,
              price: r.price,
              cost: r.cost,
              task_hours: r.task_hours,
            }
            if (r.priceId) toUpdate.push({ priceId: r.priceId, payload, source: r })
            else toInsert.push({ row: { org_id: selectedOrg, ...payload }, source: r })
          }

          // Batch inserts are atomic — one bad row fails the whole batch of up
          // to 300, including every good row riding along with it. On a batch
          // failure, retry that batch's rows one at a time so the good ones
          // still get saved, and only the genuinely bad ones get reported.
          let inserted = 0
          for (let i = 0; i < toInsert.length; i += 300) {
            const batch = toInsert.slice(i, i + 300)
            const { error: insErr } = await supabase.from('service_prices').insert(batch.map((b) => b.row))
            if (!insErr) {
              inserted += batch.length
            } else {
              for (const item of batch) {
                const { error: rowErr } = await supabase.from('service_prices').insert(item.row)
                if (rowErr) {
                  failed++
                  const r = item.source
                  failedRows.push({ category: r.category, name: r.name, location: r.location, access: r.access, hours: r.hours, part_source: r.part_source, reason: rowErr.message })
                } else {
                  inserted++
                }
              }
            }
            setImportProgress(`Adding price points… ${Math.min(i + 300, toInsert.length)} of ${toInsert.length}`)
          }

          let updated = 0
          const updateChunkSize = 15
          for (let i = 0; i < toUpdate.length; i += updateChunkSize) {
            const chunk = toUpdate.slice(i, i + updateChunkSize)
            const results = await Promise.all(
              chunk.map(({ priceId, payload }) => supabase.from('service_prices').update(payload).eq('id', priceId).eq('org_id', selectedOrg))
            )
            results.forEach((r, idx) => {
              if (r.error) {
                failed++
                const src = chunk[idx].source
                failedRows.push({ category: src.category, name: src.name, location: src.location, access: src.access, hours: src.hours, part_source: src.part_source, reason: r.error.message })
              } else {
                updated++
              }
            })
            setImportProgress(`Updating price points… ${Math.min(i + updateChunkSize, toUpdate.length)} of ${toUpdate.length}`)
          }

          setImportSummary(`${updated} updated, ${inserted} added` + (failed ? `, ${failed} failed` : '') + '.')
          setImportFailedRows(failedRows)
        } catch (err) {
          setImportSummary('Import failed: ' + err.message)
        }
        setImporting(false)
        setImportProgress('')
        e.target.value = ''
        loadServices(selectedOrg)
        if (selectedServiceId) loadVariants(selectedServiceId)
      },
      error: (err) => {
        setImportSummary('Import failed to parse: ' + err.message)
        setImporting(false)
        setImportProgress('')
        e.target.value = ''
      },
    })
  }
async function loadVariants(serviceId) {
    setLoadingVariants(true)
    const { data } = await supabase
      .from('service_prices')
      .select('id, location, access, hours, part_source, customer_display, price, cost, task_hours, is_active')
      .eq('service_id', serviceId)
      .order('location')
      .order('access')
      .order('hours')
    setVariants(data || [])
    setLoadingVariants(false)
  }

  function selectService(s) {
    setSelectedServiceId(s.id)
    setSelectedServiceInfo(s)
    setEditingVariantId(null)
    loadVariants(s.id)
  }

  const variantsPanelRef = useRef(null)
  useEffect(() => {
    if (selectedServiceId && variantsPanelRef.current) {
      variantsPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedServiceId])

  async function handleAddVariant(e) {
    e.preventDefault()
    setVariantError('')
    if (!newPrice) return
    setSavingVariant(true)
    const { error } = await supabase.from('service_prices').insert({
      org_id: selectedOrg,
      service_id: selectedServiceId,
      location: newLocation,
      access: newAccess,
      hours: newHours,
      part_source: newPartSource || null,
      customer_display: newDisplay.trim() || selectedServiceInfo.name,
      price: parseFloat(newPrice) || 0,
      cost: parseFloat(newCost) || 0,
      task_hours: parseFloat(newTaskHours) || 0,
    })
    setSavingVariant(false)
    if (error) {
      setVariantError(error.message)
    } else {
      setNewDisplay('')
      setNewPrice('')
      setNewCost('')
      setNewTaskHours('')
      loadVariants(selectedServiceId)
    }
  }

  function startEditVariant(v) {
    setEditingVariantId(v.id)
    setEditLocation(v.location || LOCATIONS[0])
    setEditAccess(v.access || ACCESS_OPTS[0])
    setEditHours(v.hours || HOURS_OPTS[0])
    setEditPartSource(v.part_source || '')
    setEditDisplay(v.customer_display || '')
    setEditPrice(String(v.price))
    setEditCost(String(v.cost))
    setEditTaskHours(String(v.task_hours))
  }

  async function saveEditVariant(id) {
    await supabase
      .from('service_prices')
      .update({
        location: editLocation,
        access: editAccess,
        hours: editHours,
        part_source: editPartSource || null,
        customer_display: editDisplay.trim() || selectedServiceInfo.name,
        price: parseFloat(editPrice) || 0,
        cost: parseFloat(editCost) || 0,
        task_hours: parseFloat(editTaskHours) || 0,
      })
      .eq('id', id)
    setEditingVariantId(null)
    loadVariants(selectedServiceId)
  }

  async function toggleVariantActive(v) {
    await supabase.from('service_prices').update({ is_active: !v.is_active }).eq('id', v.id)
    loadVariants(selectedServiceId)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Pricebook</h2>
        <span className="badge">{services.length.toLocaleString()} total</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="logout-button" style={{ cursor: 'pointer', margin: 0 }}>
          {importing ? 'Importing…' : 'Import CSV'}
          <input type="file" accept=".csv" onChange={handleImportFile} disabled={importing} style={{ display: 'none' }} />
        </label>
        <button className="logout-button" onClick={handleExport} disabled={exporting || !selectedOrg}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
      {importing && importProgress && (
        <p style={{ textAlign: 'right', color: 'var(--mist)', fontSize: 13, marginTop: -14, marginBottom: 16 }}>{importProgress}</p>
      )}
      {importSummary && (
        <p style={{ textAlign: 'right', color: 'var(--mist)', fontSize: 13, marginTop: -14, marginBottom: 16 }}>{importSummary}</p>
      )}
      {importFailedRows.length > 0 && (
        <p style={{ textAlign: 'right', marginTop: -14, marginBottom: 16 }}>
          <button
            className="logout-button"
            onClick={() => {
              const csv = Papa.unparse(importFailedRows.map((r) => ({
                Category: r.category, Item: r.name, Location: r.location, Access: r.access, Hours: r.hours, PartSrc: r.part_source, Reason: r.reason,
              })))
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `pricebook-import-failures-${new Date().toISOString().slice(0, 10)}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            Download {importFailedRows.length} failed row{importFailedRows.length === 1 ? '' : 's'} (CSV)
          </button>
        </p>
      )}

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <form className="inline-form" onSubmit={handleAddService} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="svcCategory">Category</label>
          {useNewCategory ? (
            <input
              id="svcCategory"
              type="text"
              value={newServiceCategory}
              onChange={(e) => setNewServiceCategory(e.target.value)}
              placeholder="New category name"
              required
            />
          ) : (
            <select
              id="svcCategory"
              value={newServiceCategory}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setUseNewCategory(true)
                  setNewServiceCategory('')
                } else {
                  setNewServiceCategory(e.target.value)
                }
              }}
              required
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__new__">+ New category…</option>
            </select>
          )}
          {useNewCategory && (
            <button
              type="button"
              className="logout-button"
              style={{ marginTop: 4, fontSize: 12, padding: '2px 8px' }}
              onClick={() => { setUseNewCategory(false); setNewServiceCategory('') }}
            >
              Use existing category
            </button>
          )}
        </div>
        <div className="field">
          <label htmlFor="svcName">Service name</label>
          <input id="svcName" type="text" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} placeholder="e.g. 5 mf Run Capacitor" required />
        </div>
        <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
          <label style={{ marginBottom: 0, cursor: 'pointer' }}>
            <input type="checkbox" checked={!newServiceExempt} onChange={(e) => setNewServiceExempt(!e.target.checked)} style={{ marginRight: 4 }} />
            Taxable
          </label>
        </div>
        <button className="auth-button" type="submit" disabled={savingService}>
          {savingService ? 'Adding…' : 'Add service'}
        </button>
      </form>

      {serviceError && <div className="auth-error">{serviceError}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
          <label htmlFor="catFilter">Category</label>
          <select id="catFilter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 240 }}>
          <label htmlFor="serviceJump">Service</label>
          <select
            id="serviceJump"
            value={selectedServiceId || ''}
            onChange={(e) => {
              const svc = services.find((s) => s.id === e.target.value)
              if (svc) selectService(svc)
            }}
            disabled={!categoryFilter}
          >
            <option value="">{categoryFilter ? 'Select a service…' : 'Choose a category first'}</option>
            {services
              .filter((s) => s.category === categoryFilter)
              .map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
          </select>
        </div>
        <label className="nav-link" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} style={{ marginRight: 6 }} />
          Show archived
        </label>
      </div>

      {loadingServices ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div className="grid-table" style={{ gridTemplateColumns: '1fr 1.2fr 1.6fr 0.8fr 0.8fr' }}>
          <div className="grid-cell grid-head"></div>
          <div className="grid-cell grid-head">Category</div>
          <div className="grid-cell grid-head">Service</div>
          <div className="grid-cell grid-head">Taxable</div>
          <div className="grid-cell grid-head">Status</div>

          {filteredServices.map((s) =>
            editingServiceId === s.id ? (
              <>
                <div className="grid-cell grid-actions">
                  <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEditService(s.id)}>Save</button>
                  <button className="logout-button" onClick={() => setEditingServiceId(null)}>Cancel</button>
                </div>
                <div className="grid-cell"><input type="text" value={editServiceCategory} onChange={(e) => setEditServiceCategory(e.target.value)} /></div>
                <div className="grid-cell"><input type="text" value={editServiceName} onChange={(e) => setEditServiceName(e.target.value)} /></div>
                <div className="grid-cell">{s.is_tax_exempt ? 'No' : 'Yes'}</div>
                <div className="grid-cell">{s.is_active ? 'Active' : 'Archived'}</div>
              </>
            ) : (
              <>
                <div className="grid-cell grid-actions">
                  <button className="logout-button" onClick={() => selectService(s)}>Prices</button>
                  <button className="logout-button" onClick={() => startEditService(s)}>Rename</button>
                  <button className="logout-button" onClick={() => toggleServiceActive(s)}>{s.is_active ? 'Archive' : 'Reactivate'}</button>
                </div>
                <div className="grid-cell">{s.category}</div>
                <div className="grid-cell">{s.name}</div>
                <div className="grid-cell">{s.is_tax_exempt ? 'No' : 'Yes'}</div>
                <div className="grid-cell">
                  <span className={`status-pill ${s.is_active ? 'status-active' : 'status-canceled'}`}>{s.is_active ? 'Active' : 'Archived'}</span>
                </div>
              </>
            )
          )}
          {filteredServices.length === 0 && (
            <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No services found.</div>
          )}
        </div>
      )}
{selectedServiceId && (
        <div ref={variantsPanelRef} style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>{selectedServiceInfo?.category} — {selectedServiceInfo?.name}</h3>
          <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>Price variants for this service</p>

          <form className="inline-form" onSubmit={handleAddVariant} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
            <div className="field">
              <label htmlFor="vLoc">Location</label>
              <select id="vLoc" value={newLocation} onChange={(e) => setNewLocation(e.target.value)}>
                {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="vAcc">Access</label>
              <select id="vAcc" value={newAccess} onChange={(e) => setNewAccess(e.target.value)}>
                {ACCESS_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="vHrs">Hours</label>
              <select id="vHrs" value={newHours} onChange={(e) => setNewHours(e.target.value)}>
                {HOURS_OPTS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="vPart">Part source</label>
              <select id="vPart" value={newPartSource} onChange={(e) => setNewPartSource(e.target.value)}>
                {PART_SOURCES.map((p) => <option key={p} value={p}>{p || 'N/A'}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="vDisplay">Customer display text</label>
              <input id="vDisplay" type="text" value={newDisplay} onChange={(e) => setNewDisplay(e.target.value)} placeholder={selectedServiceInfo?.name} />
            </div>
            <div className="field">
              <label htmlFor="vPrice">Price</label>
              <input id="vPrice" type="number" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} required style={{ width: 90 }} />
            </div>
            <div className="field">
              <label htmlFor="vCost">Cost</label>
              <input id="vCost" type="number" step="0.01" value={newCost} onChange={(e) => setNewCost(e.target.value)} style={{ width: 90 }} />
            </div>
            <div className="field">
              <label htmlFor="vTaskHrs">Task hrs</label>
              <input id="vTaskHrs" type="number" step="0.01" value={newTaskHours} onChange={(e) => setNewTaskHours(e.target.value)} style={{ width: 90 }} />
            </div>
            <button className="auth-button" type="submit" disabled={savingVariant}>
              {savingVariant ? 'Adding…' : 'Add variant'}
            </button>
          </form>

          {variantError && <div className="auth-error">{variantError}</div>}

          {loadingVariants ? (
            <p style={{ color: 'var(--mist)' }}>Loading…</p>
          ) : (
            <div className="grid-table" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1fr 0.8fr 1.4fr 0.8fr 0.8fr 0.8fr' }}>
              <div className="grid-cell grid-head"></div>
              <div className="grid-cell grid-head">Location</div>
              <div className="grid-cell grid-head">Access</div>
              <div className="grid-cell grid-head">Hours</div>
              <div className="grid-cell grid-head">Part</div>
              <div className="grid-cell grid-head">Display text</div>
              <div className="grid-cell grid-head">Price</div>
              <div className="grid-cell grid-head">Cost</div>
              <div className="grid-cell grid-head">Task hrs</div>

              {variants.map((v) =>
                editingVariantId === v.id ? (
                  <>
                    <div className="grid-cell grid-actions">
                      <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEditVariant(v.id)}>Save</button>
                      <button className="logout-button" onClick={() => setEditingVariantId(null)}>Cancel</button>
                    </div>
                    <div className="grid-cell">
                      <select value={editLocation} onChange={(e) => setEditLocation(e.target.value)}>
                        {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="grid-cell">
                      <select value={editAccess} onChange={(e) => setEditAccess(e.target.value)}>
                        {ACCESS_OPTS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className="grid-cell">
                      <select value={editHours} onChange={(e) => setEditHours(e.target.value)}>
                        {HOURS_OPTS.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div className="grid-cell">
                      <select value={editPartSource} onChange={(e) => setEditPartSource(e.target.value)}>
                        {PART_SOURCES.map((p) => <option key={p} value={p}>{p || 'N/A'}</option>)}
                      </select>
                    </div>
                    <div className="grid-cell"><input type="text" value={editDisplay} onChange={(e) => setEditDisplay(e.target.value)} /></div>
                    <div className="grid-cell"><input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} /></div>
                    <div className="grid-cell"><input type="number" step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} /></div>
                    <div className="grid-cell"><input type="number" step="0.01" value={editTaskHours} onChange={(e) => setEditTaskHours(e.target.value)} /></div>
                  </>
                ) : (
                  <>
                    <div className="grid-cell grid-actions">
                      <button className="logout-button" onClick={() => startEditVariant(v)}>Edit</button>
                      <button className="logout-button" onClick={() => toggleVariantActive(v)}>{v.is_active ? 'Off' : 'On'}</button>
                    </div>
                    <div className="grid-cell">{v.location || '—'}</div>
                    <div className="grid-cell">{v.access || '—'}</div>
                    <div className="grid-cell">{v.hours || '—'}</div>
                    <div className="grid-cell">{v.part_source || 'N/A'}</div>
                    <div className="grid-cell">{v.customer_display}</div>
                    <div className="grid-cell">${v.price.toFixed(2)}</div>
                    <div className="grid-cell">${v.cost.toFixed(2)}</div>
                    <div className="grid-cell">{v.task_hours}</div>
                  </>
                )
              )}
              {variants.length === 0 && (
                <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No price variants yet.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
