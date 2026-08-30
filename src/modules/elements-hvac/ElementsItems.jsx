// Elements-HVAC · Item catalog (SKUs) — parts and consumables
import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { supabase } from '../../utils/supabase'
import { listItems, addItem, updateItem, deleteItem, deriveSku } from './data'
import { fetchAllRows, readFileSmart, normPrice, normalizeForMatch } from '../../utils/csvImport'
import { useOrgSelector, OrgBar } from './shared'

const blank = {
  description: '', category: '', item_class: 'part', stock_type: 'stock',
  base_uom: 'each', stock_uom: '', units_per_stock_uom: '', vendor_part_no: '',
  last_cost: '', barcode: '', primary_vendor_id: '',
}

// On import, a blank/absent "Active" means active. Only an explicit falsey turns it off.
function parseActiveForImport(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return true
  const v = String(raw).trim().toLowerCase()
  return !['false', '0', 'no', 'n', 'inactive', 'archived', 'f', 'off'].includes(v)
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ElementsItems({ profile }) {
  const org = useOrgSelector(profile)
  const [items, setItems] = useState([])
  const [vendors, setVendors] = useState([])
  const [classFilter, setClassFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)   // null = adding; otherwise editing this row
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState('')
  const [importProgress, setImportProgress] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const [its, vs] = await Promise.all([
      listItems(org.selectedOrg, { includeInactive: showArchived }),
      supabase.from('vendors').select('id, name').eq('org_id', org.selectedOrg).eq('is_active', true).order('name'),
    ])
    setItems(its)
    setVendors(vs.data || [])
  }
  useEffect(() => { load() }, [org.selectedOrg, showArchived])

  const vendorName = (id) => vendors.find((v) => v.id === id)?.name || ''

  // Bulk CSV import. Recognizes the standard template headers and common
  // vendor-catalog headers (Item #, Mfg #, Source, Price per unit). Re-imports
  // match existing parts by SKU then description and UPDATE instead of
  // duplicating; blank rows are skipped; a blank Active defaults to active.
  async function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true); setImportSummary(''); setImportProgress('')
    const text = await readFileSmart(file)
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const orgId = org.selectedOrg
        const existing = await fetchAllRows(() =>
          supabase.from('elements_items').select('id, sku, description').eq('org_id', orgId))
        const bySku = new Map(), byDesc = new Map(), takenSku = new Set()
        for (const it of existing) {
          if (it.sku) { bySku.set(normalizeForMatch(it.sku), it.id); takenSku.add(it.sku.toLowerCase()) }
          if (it.description) byDesc.set(normalizeForMatch(it.description), it.id)
        }
        const vendorByName = new Map()
        for (const v of vendors) vendorByName.set(normalizeForMatch(v.name), v.id)

        const headers = results.meta.fields || []
        const findHeader = (aliases) => headers.find((h) => aliases.some((a) => normalizeForMatch(h) === normalizeForMatch(a)))
        const H = {
          id: findHeader(['ID']),
          sku: findHeader(['SKU', 'Item #', 'Item Number']),
          description: findHeader(['Description', 'Part', 'Name']),
          category: findHeader(['Category', 'Source', 'Top Category']),
          item_class: findHeader(['Class', 'Item Class']),
          base_uom: findHeader(['Base Unit', 'Base UOM', 'Unit']),
          stock_uom: findHeader(['Stock Unit', 'Stock UOM']),
          units_per_stock_uom: findHeader(['Units per Stock', 'Base per Stock']),
          vendor_part_no: findHeader(['Vendor Part #', 'Vendor Part', 'Mfg #', 'Mfg Number']),
          last_cost: findHeader(['Last Cost', 'Cost', 'Price per unit', 'Price']),
          barcode: findHeader(['Barcode', 'UPC']),
          vendor: findHeader(['Vendor', 'Primary Vendor', 'Supplier']),
          active: findHeader(['Active', 'Is Active']),
        }
        const get = (row, hdr) => (hdr && row[hdr] !== undefined ? String(row[hdr]).trim() : '')

        const toInsert = [], toUpdate = []
        let skipped = 0
        for (const row of results.data) {
          const description = get(row, H.description)
          const skuIn = get(row, H.sku)
          if (!description && !skuIn) { skipped++; continue }
          const vname = get(row, H.vendor)
          const fields = {
            description: description || null,
            category: get(row, H.category) || null,
            item_class: (get(row, H.item_class) || 'part').toLowerCase() === 'consumable' ? 'consumable' : 'part',
            base_uom: get(row, H.base_uom) || 'each',
            stock_uom: get(row, H.stock_uom) || null,
            units_per_stock_uom: get(row, H.units_per_stock_uom) ? normPrice(get(row, H.units_per_stock_uom)) : null,
            vendor_part_no: get(row, H.vendor_part_no) || null,
            last_cost: get(row, H.last_cost) ? normPrice(get(row, H.last_cost)) : null,
            barcode: get(row, H.barcode) || null,
            primary_vendor_id: vname ? (vendorByName.get(normalizeForMatch(vname)) || null) : null,
            is_active: parseActiveForImport(get(row, H.active)),
            org_id: orgId,
          }
          let targetId = get(row, H.id)
          if (!targetId && skuIn) targetId = bySku.get(normalizeForMatch(skuIn))
          if (!targetId && description) targetId = byDesc.get(normalizeForMatch(description))
          if (targetId) {
            toUpdate.push({ id: targetId, fields })
          } else {
            let sku = skuIn
            if (!sku) sku = deriveSku(description, takenSku)
            else takenSku.add(sku.toLowerCase())
            toInsert.push({ sku, ...fields })
          }
        }

        let inserted = 0, updated = 0, failed = 0
        const failedRows = []
        for (let i = 0; i < toInsert.length; i += 300) {
          const batch = toInsert.slice(i, i + 300)
          const { error: insErr } = await supabase.from('elements_items').insert(batch)
          if (!insErr) inserted += batch.length
          else {
            for (const one of batch) {
              const { error: e2 } = await supabase.from('elements_items').insert(one)
              if (e2) { failed++; if (failedRows.length < 5) failedRows.push(`${one.sku || one.description}: ${e2.message}`) }
              else inserted++
            }
          }
          setImportProgress(`Adding parts… ${Math.min(i + 300, toInsert.length)} of ${toInsert.length}`)
        }
        for (let i = 0; i < toUpdate.length; i += 20) {
          const chunk = toUpdate.slice(i, i + 20)
          const res = await Promise.all(chunk.map(({ id, fields }) => supabase.from('elements_items').update(fields).eq('id', id)))
          res.forEach((r) => { if (r.error) failed++; else updated++ })
          setImportProgress(`Updating parts… ${Math.min(i + 20, toUpdate.length)} of ${toUpdate.length}`)
        }
        setImportSummary(`${inserted} added, ${updated} updated` + (skipped ? `, ${skipped} blank skipped` : '') + (failed ? `, ${failed} failed (e.g. ${failedRows[0] || ''})` : '') + '.')
        setImporting(false); setImportProgress(''); e.target.value = ''
        load()
      },
      error: (err) => { setImportSummary('Import failed to parse: ' + err.message); setImporting(false); e.target.value = '' },
    })
  }

  function handleExport() {
    const rows = filtered.map((it) => ({
      ID: it.id, SKU: it.sku, Description: it.description || '', Category: it.category || '',
      Class: it.item_class, 'Base Unit': it.base_uom || '', 'Stock Unit': it.stock_uom || '',
      'Units per Stock': it.units_per_stock_uom ?? '', Vendor: vendorName(it.primary_vendor_id),
      'Vendor Part #': it.vendor_part_no || '', 'Last Cost': it.last_cost ?? '', Barcode: it.barcode || '',
      Active: it.is_active ? 'TRUE' : 'FALSE',
    }))
    downloadCsv(Papa.unparse(rows), `item-catalog-export-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function downloadTemplate() {
    const example = { ID: '', SKU: '', Description: 'Blower Motor 1/2 HP', Category: 'PARTS', Class: 'part', 'Base Unit': 'each', 'Stock Unit': '', 'Units per Stock': '', Vendor: '', 'Vendor Part #': '', 'Last Cost': '', Barcode: '', Active: 'TRUE' }
    downloadCsv(Papa.unparse([example]), 'item-catalog-template.csv')
  }

  function buildRow() {
    return {
      description: form.description.trim(),
      category: form.category.trim() || null,
      item_class: form.item_class,
      stock_type: form.stock_type || 'stock',
      base_uom: form.base_uom.trim() || 'each',
      stock_uom: form.stock_uom.trim() || null,
      units_per_stock_uom: form.units_per_stock_uom ? parseFloat(form.units_per_stock_uom) : null,
      vendor_part_no: form.vendor_part_no.trim() || null,
      last_cost: form.last_cost ? parseFloat(form.last_cost) : null,
      barcode: form.barcode.trim() || null,
      primary_vendor_id: form.primary_vendor_id || null,
    }
  }

  function closeForm() {
    setForm(blank)
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  function startEdit(it) {
    setError('')
    setEditingId(it.id)
    setForm({
      description: it.description || '',
      category: it.category || '',
      item_class: it.item_class || 'part',
      stock_type: it.stock_type || 'stock',
      base_uom: it.base_uom || 'each',
      stock_uom: it.stock_uom || '',
      units_per_stock_uom: it.units_per_stock_uom != null ? String(it.units_per_stock_uom) : '',
      vendor_part_no: it.vendor_part_no || '',
      last_cost: it.last_cost != null ? String(it.last_cost) : '',
      barcode: it.barcode || '',
      primary_vendor_id: it.primary_vendor_id || '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.description.trim()) { setError('Part description is required.'); return }
    setSaving(true)
    let err
    if (editingId) {
      err = (await updateItem(editingId, buildRow())).error
    } else {
      const taken = new Set(items.map((i) => (i.sku || '').toLowerCase()))
      err = (await addItem(org.selectedOrg, { sku: deriveSku(form.description, taken), ...buildRow() })).error
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    closeForm()
    load()
  }

  async function inlineUpdate(item, patch) {
    await updateItem(item.id, patch)
    load()
  }

  async function handleDelete(it) {
    if (!window.confirm(`Permanently delete "${it.description || it.sku}"? This can't be undone. If it's mapped to a service or has stock history, use Archive instead.`)) return
    setError('')
    const { error: err } = await deleteItem(it.id)
    if (err) { setError(`Couldn't delete "${it.description || it.sku}" — it may be mapped or have stock. Try Archive instead. (${err.message})`); return }
    if (editingId === it.id) closeForm()
    load()
  }

  const filtered = items.filter((it) => {
    if (classFilter !== 'all' && it.item_class !== classFilter) return false
    if (search && !(`${it.sku} ${it.description || ''} ${it.category || ''}`.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Item Catalog</h2>
          <span className="badge">{items.length} items</span>
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => (showForm ? closeForm() : setShowForm(true))}>
          {showForm ? 'Cancel' : '+ New Item'}
        </button>
      </div>
      <OrgBar {...org} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, margin: '8px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="logout-button" style={{ cursor: 'pointer', margin: 0 }}>
          {importing ? 'Importing…' : 'Import CSV'}
          <input type="file" accept=".csv" onChange={handleImportFile} disabled={importing} style={{ display: 'none' }} />
        </label>
        <button className="logout-button" onClick={handleExport} type="button">Export CSV</button>
        <button className="logout-button" onClick={downloadTemplate} type="button">Download Template</button>
      </div>
      {importProgress && <p style={{ textAlign: 'right', fontSize: 13, color: 'var(--mist)', margin: '0 0 8px' }}>{importProgress}</p>}
      {importSummary && (
        <div style={{ margin: '4px 0 12px', padding: '10px 14px', borderRadius: 8, background: '#EEF3FB', border: '1px solid #1B3A6B', color: '#1B3A6B', fontWeight: 600 }}>
          Import complete — {importSummary}
        </div>
      )}

      {showForm && (
        <form className="inline-form" onSubmit={handleSubmit} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          {editingId && <div style={{ width: '100%', fontSize: 13, color: '#1B3A6B', fontWeight: 700 }}>Editing item</div>}
          <div className="field" style={{ minWidth: 240 }}><label>Part description</label><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Blower Motor 1/2 HP" required /></div>
          <div className="field"><label>Category</label><input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div className="field">
            <label>Class</label>
            <select value={form.item_class} onChange={(e) => setForm({ ...form, item_class: e.target.value })}>
              <option value="part">Part (invoice-tracked)</option>
              <option value="consumable">Consumable (not invoiced)</option>
            </select>
          </div>
          <div className="field">
            <label>Type</label>
            <select value={form.stock_type} onChange={(e) => setForm({ ...form, stock_type: e.target.value })}>
              <option value="stock">Stock (reordered)</option>
              <option value="special_order">Special order</option>
            </select>
          </div>
          <div className="field" style={{ width: 90 }}><label>Base unit</label><input type="text" value={form.base_uom} onChange={(e) => setForm({ ...form, base_uom: e.target.value })} placeholder="each / oz" /></div>
          <div className="field" style={{ width: 110 }}><label>Stock unit</label><input type="text" value={form.stock_uom} onChange={(e) => setForm({ ...form, stock_uom: e.target.value })} placeholder="cylinder" /></div>
          <div className="field" style={{ width: 120 }}><label>Base per stock</label><input type="number" step="any" value={form.units_per_stock_uom} onChange={(e) => setForm({ ...form, units_per_stock_uom: e.target.value })} placeholder="400" /></div>
          <div className="field" style={{ width: 110 }}><label>Last cost</label><input type="number" step="any" value={form.last_cost} onChange={(e) => setForm({ ...form, last_cost: e.target.value })} /></div>
          <div className="field" style={{ minWidth: 180 }}>
            <label>Primary vendor</label>
            <select value={form.primary_vendor_id} onChange={(e) => setForm({ ...form, primary_vendor_id: e.target.value })}>
              <option value="">—</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Vendor part #</label><input type="text" value={form.vendor_part_no} onChange={(e) => setForm({ ...form, vendor_part_no: e.target.value })} /></div>
          <div className="field"><label>Barcode</label><input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add item'}</button>
        </form>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}><label>Search</label><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU, description, category…" /></div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Class</label>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="part">Parts</option>
            <option value="consumable">Consumables</option>
          </select>
        </div>
        <label className="nav-link" style={{ cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} style={{ marginRight: 6 }} />
          Show archived
        </label>
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Actions</th><th>Part</th><th>Category</th><th>Class</th><th>Vendor part #</th><th>Units</th><th>Last cost</th></tr>
        </thead>
        <tbody>
          {filtered.map((it) => (
            <tr key={it.id} style={editingId === it.id ? { background: '#EEF3FB' } : undefined}>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="auth-button" style={{ width: 'auto', margin: 0, marginRight: 6, padding: '4px 10px' }} onClick={() => startEdit(it)}>Edit</button>
                <button className="logout-button" style={{ marginRight: 6 }} onClick={() => inlineUpdate(it, { is_active: !it.is_active })}>{it.is_active ? 'Archive' : 'Restore'}</button>
                <button className="logout-button" onClick={() => handleDelete(it)}>Delete</button>
              </td>
              <td>{it.description || '—'}</td>
              <td>{it.category || '—'}</td>
              <td>
                <select value={it.item_class} onChange={(e) => inlineUpdate(it, { item_class: e.target.value })}>
                  <option value="part">Part</option>
                  <option value="consumable">Consumable</option>
                </select>
              </td>
              <td style={{ color: 'var(--mist)' }}>{it.vendor_part_no || '—'}</td>
              <td style={{ color: 'var(--mist)', fontSize: 13 }}>
                {it.base_uom}{it.stock_uom ? ` · ${it.units_per_stock_uom || '?'}/${it.stock_uom}` : ''}
              </td>
              <td>{it.last_cost != null ? `$${Number(it.last_cost).toFixed(2)}` : '—'}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>No parts yet. Add them here, or use Service Mapping to auto-create them from your pricebook.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
