// Elements-HVAC · Item catalog (SKUs) — parts and consumables
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import { listItems, addItem, updateItem } from './data'
import { useOrgSelector, OrgBar } from './shared'

const blank = {
  sku: '', description: '', category: '', item_class: 'part',
  base_uom: 'each', stock_uom: '', units_per_stock_uom: '', vendor_part_no: '',
  last_cost: '', barcode: '', primary_vendor_id: '',
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!form.sku.trim()) { setError('SKU is required.'); return }
    setSaving(true)
    const { error: err } = await addItem(org.selectedOrg, {
      sku: form.sku.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      item_class: form.item_class,
      base_uom: form.base_uom.trim() || 'each',
      stock_uom: form.stock_uom.trim() || null,
      units_per_stock_uom: form.units_per_stock_uom ? parseFloat(form.units_per_stock_uom) : null,
      vendor_part_no: form.vendor_part_no.trim() || null,
      last_cost: form.last_cost ? parseFloat(form.last_cost) : null,
      barcode: form.barcode.trim() || null,
      primary_vendor_id: form.primary_vendor_id || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(blank)
    setShowForm(false)
    load()
  }

  async function inlineUpdate(item, patch) {
    await updateItem(item.id, patch)
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
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Item'}
        </button>
      </div>
      <OrgBar {...org} />

      {showForm && (
        <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="field"><label>SKU</label><input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required /></div>
          <div className="field" style={{ minWidth: 220 }}><label>Description</label><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="field"><label>Category</label><input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div className="field">
            <label>Class</label>
            <select value={form.item_class} onChange={(e) => setForm({ ...form, item_class: e.target.value })}>
              <option value="part">Part (invoice-tracked)</option>
              <option value="consumable">Consumable (not invoiced)</option>
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
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Adding…' : 'Add item'}</button>
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
          <tr><th></th><th>SKU</th><th>Description</th><th>Category</th><th>Class</th><th>Units</th><th>Last cost</th></tr>
        </thead>
        <tbody>
          {filtered.map((it) => (
            <tr key={it.id}>
              <td><button className="logout-button" onClick={() => inlineUpdate(it, { is_active: !it.is_active })}>{it.is_active ? 'Archive' : 'Restore'}</button></td>
              <td>{it.sku}</td>
              <td>{it.description || '—'}</td>
              <td>{it.category || '—'}</td>
              <td>
                <select value={it.item_class} onChange={(e) => inlineUpdate(it, { item_class: e.target.value })}>
                  <option value="part">Part</option>
                  <option value="consumable">Consumable</option>
                </select>
              </td>
              <td style={{ color: 'var(--mist)', fontSize: 13 }}>
                {it.base_uom}{it.stock_uom ? ` · ${it.units_per_stock_uom || '?'}/${it.stock_uom}` : ''}
              </td>
              <td>{it.last_cost != null ? `$${Number(it.last_cost).toFixed(2)}` : '—'}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>No items. Add SKUs here, or use Service Mapping to auto-create them from your pricebook.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
