// Elements-HVAC · Item catalog (SKUs) — parts and consumables
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import { listItems, addItem, updateItem, deleteItem, deriveSku } from './data'
import { useOrgSelector, OrgBar } from './shared'

const blank = {
  description: '', category: '', item_class: 'part',
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
  const [editingId, setEditingId] = useState(null)   // null = adding; otherwise editing this row
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

  function buildRow() {
    return {
      description: form.description.trim(),
      category: form.category.trim() || null,
      item_class: form.item_class,
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
