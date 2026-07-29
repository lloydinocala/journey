import { useState, useEffect, useMemo } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { exportToCSV } from './utils/csvExport'

// The smallest unit an item is sold/consumed in. Everything (stock, cost) is
// stored in this base unit; purchase packs and sell units convert to it.
const BASE_UNITS = ['each', 'ounce', 'pound', 'foot', 'linear foot', 'gallon', 'quart', 'box', 'roll', 'kit']

// Suggest base-units-per-sell-unit when the pairing is unambiguous.
function suggestFactor(baseUnit, sellUnit) {
  if (baseUnit === sellUnit) return 1
  if (baseUnit === 'ounce' && sellUnit === 'pound') return 16
  if (baseUnit === 'ounce' && sellUnit === 'gallon') return 128
  return null
}

function money(n) {
  if (n == null || n === '' || isNaN(n)) return '—'
  return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}
function qtyFmt(n) {
  if (n == null || isNaN(n)) return '0'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
}
function dateFmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

const blankItem = {
  generic_name: '', category: '', base_unit: 'each', sell_unit: 'each',
  sell_unit_factor: '1', reorder_level: '', markup_percent: '', description: '',
}
const blankOffering = {
  vendor_id: '', vendor_sku: '', vendor_description: '', pack_label: '',
  pack_base_qty: '1', cost_per_pack: '',
}

export default function PartsCatalog({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')

  const [items, setItems] = useState([])
  const [stockByItem, setStockByItem] = useState({})       // item_id -> shop qty
  const [offersByItem, setOffersByItem] = useState({})     // item_id -> [offerings]
  const [vendors, setVendors] = useState([])
  const [shopLocationId, setShopLocationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  // Item add/edit modal
  const [showItemModal, setShowItemModal] = useState(false)
  const [itemForm, setItemForm] = useState(blankItem)
  const [editingItemId, setEditingItemId] = useState(null)
  const [savingItem, setSavingItem] = useState(false)

  // Vendor offerings drawer
  const [offerItem, setOfferItem] = useState(null)         // the item whose offerings we're editing
  const [offerForm, setOfferForm] = useState(blankOffering)
  const [savingOffer, setSavingOffer] = useState(false)

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  useEffect(() => { if (selectedOrg) loadAll() }, [selectedOrg])

  async function loadAll() {
    setLoading(true)
    setError('')
    const [loc, itemsRes, vendorsRes] = await Promise.all([
      supabase.from('part_locations').select('id').eq('org_id', selectedOrg).eq('kind', 'shop').limit(1).maybeSingle(),
      supabase.from('part_items').select('*').eq('org_id', selectedOrg).order('generic_name'),
      supabase.from('vendors').select('id, name').eq('org_id', selectedOrg).eq('is_active', true).order('name'),
    ])
    const locId = loc.data?.id || null
    setShopLocationId(locId)
    const its = itemsRes.data || []
    setItems(its)
    setVendors(vendorsRes.data || [])

    const ids = its.map((i) => i.id)
    if (ids.length) {
      const [stockRes, offerRes] = await Promise.all([
        supabase.from('part_stock').select('item_id, qty, location_id').eq('org_id', selectedOrg).in('item_id', ids),
        supabase.from('part_vendor_offerings').select('*, vendors(name)').eq('org_id', selectedOrg).in('item_id', ids),
      ])
      const sMap = {}
      for (const s of stockRes.data || []) {
        if (s.location_id === locId) sMap[s.item_id] = (sMap[s.item_id] || 0) + Number(s.qty)
      }
      setStockByItem(sMap)
      const oMap = {}
      for (const o of offerRes.data || []) (oMap[o.item_id] = oMap[o.item_id] || []).push(o)
      setOffersByItem(oMap)
    } else {
      setStockByItem({}); setOffersByItem({})
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => {
      const offers = offersByItem[i.id] || []
      const hay = [i.generic_name, i.category, i.description,
        ...offers.map((o) => `${o.vendor_sku} ${o.vendor_description} ${o.vendors?.name}`)].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [items, offersByItem, search])

  // Cheapest current cost per base unit across an item's vendor offerings.
  function cheapest(itemId) {
    const offers = (offersByItem[itemId] || []).filter((o) => o.last_cost_per_base_unit != null)
    if (!offers.length) return null
    return offers.reduce((best, o) =>
      (best == null || Number(o.last_cost_per_base_unit) < Number(best.last_cost_per_base_unit)) ? o : best, null)
  }

  function openAdd() {
    setEditingItemId(null); setItemForm(blankItem); setError(''); setShowItemModal(true)
  }
  function openEdit(it) {
    setEditingItemId(it.id)
    setItemForm({
      generic_name: it.generic_name || '', category: it.category || '',
      base_unit: it.base_unit || 'each', sell_unit: it.sell_unit || 'each',
      sell_unit_factor: String(it.sell_unit_factor ?? '1'),
      reorder_level: it.reorder_level != null ? String(it.reorder_level) : '',
      markup_percent: it.markup_percent != null ? String(it.markup_percent) : '',
      description: it.description || '',
    })
    setError(''); setShowItemModal(true)
  }

  async function saveItem(e) {
    e.preventDefault()
    if (!itemForm.generic_name.trim()) { setError('A name is required.'); return }
    setSavingItem(true)
    const payload = {
      generic_name: itemForm.generic_name.trim(),
      category: itemForm.category.trim() || null,
      base_unit: itemForm.base_unit,
      sell_unit: itemForm.sell_unit,
      sell_unit_factor: parseFloat(itemForm.sell_unit_factor) || 1,
      reorder_level: itemForm.reorder_level === '' ? null : parseFloat(itemForm.reorder_level),
      markup_percent: itemForm.markup_percent === '' ? null : parseFloat(itemForm.markup_percent),
      description: itemForm.description.trim() || null,
      updated_at: new Date().toISOString(),
    }
    let err
    if (editingItemId) {
      ({ error: err } = await supabase.from('part_items').update(payload).eq('id', editingItemId))
    } else {
      ({ error: err } = await supabase.from('part_items').insert({ ...payload, org_id: selectedOrg }))
    }
    setSavingItem(false)
    if (err) { setError(err.message); return }
    setShowItemModal(false)
    loadAll()
  }

  function openOfferings(it) {
    setOfferItem(it); setOfferForm(blankOffering); setError('')
  }

  async function saveOffering(e) {
    e.preventDefault()
    if (!offerForm.vendor_id) { setError('Pick a vendor.'); return }
    const packQty = parseFloat(offerForm.pack_base_qty) || 1
    const costPack = offerForm.cost_per_pack === '' ? null : parseFloat(offerForm.cost_per_pack)
    const costBase = costPack != null && packQty > 0 ? costPack / packQty : null
    setSavingOffer(true)
    const { error: offErr } = await supabase.from('part_vendor_offerings').insert({
      org_id: selectedOrg,
      item_id: offerItem.id,
      vendor_id: offerForm.vendor_id,
      vendor_sku: offerForm.vendor_sku.trim() || null,
      vendor_description: offerForm.vendor_description.trim() || null,
      pack_label: offerForm.pack_label.trim() || null,
      pack_base_qty: packQty,
      last_cost_per_pack: costPack,
      last_cost_per_base_unit: costBase,
      last_seen_at: costPack != null ? new Date().toISOString() : null,
    })
    if (offErr) { setSavingOffer(false); setError(offErr.message); return }
    // Manual entry with a cost also refreshes the item's last/avg cost so the
    // catalog reflects the newest known price. (Moving average with on-hand
    // arrives with the receiving ledger in a later phase.)
    if (costBase != null) {
      const cur = items.find((i) => i.id === offerItem.id)
      await supabase.from('part_items').update({
        last_cost: costBase,
        avg_cost: cur?.avg_cost != null ? cur.avg_cost : costBase,
        last_cost_update_at: new Date().toISOString(),
      }).eq('id', offerItem.id)
    }
    setSavingOffer(false)
    setOfferForm(blankOffering)
    await loadAll()
    // Keep the drawer open on the same item with refreshed data
    setOfferItem((prev) => prev ? { ...prev } : prev)
  }

  async function deleteOffering(id) {
    await supabase.from('part_vendor_offerings').delete().eq('id', id)
    loadAll()
  }

  function exportCsv() {
    const cols = [
      { label: 'Updated', value: (i) => dateFmt(i.last_cost_update_at || i.updated_at) },
      { label: 'Name', key: 'generic_name' },
      { label: 'Category', value: (i) => i.category || '' },
      { label: 'Base Unit', key: 'base_unit' },
      { label: 'Sell Unit', value: (i) => `${i.sell_unit} (${i.sell_unit_factor} ${i.base_unit})` },
      { label: 'On Hand (Shop)', value: (i) => qtyFmt(stockByItem[i.id] || 0) },
      { label: 'Last Cost / Unit', value: (i) => (i.last_cost != null ? Number(i.last_cost).toFixed(4) : '') },
      { label: 'Avg Cost / Unit', value: (i) => (i.avg_cost != null ? Number(i.avg_cost).toFixed(4) : '') },
      { label: 'Vendors', value: (i) => (offersByItem[i.id] || []).length },
      { label: 'Reorder Level', value: (i) => (i.reorder_level != null ? i.reorder_level : '') },
    ]
    exportToCSV(filtered, cols, 'parts-catalog.csv')
  }

  const offerItemLive = offerItem ? items.find((i) => i.id === offerItem.id) || offerItem : null
  const offerList = offerItem ? (offersByItem[offerItem.id] || []) : []

  return (
    <div>
      <h2 className="page-title">Parts Catalog</h2>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, category, vendor SKU or description…"
          style={{ flex: '1 1 320px', minWidth: 240, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #ccc)' }}
        />
        <button className="auth-button" style={{ width: 'auto', padding: '9px 18px' }} onClick={openAdd}>+ Add Item</button>
        <button className="logout-button" onClick={exportCsv}>Export CSV</button>
        <span style={{ color: 'var(--mist)', fontSize: 13 }}>{filtered.length} item{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {error && !showItemModal && !offerItem && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No items yet. Use “+ Add Item”, or (soon) let Quincy add them from a vendor invoice.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border, #e2e4e8)', borderRadius: 10 }}>
          <table className="parts-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#002060', color: '#fff', textAlign: 'left' }}>
                <th style={thStyle}>Updated</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Base Unit</th>
                <th style={thStyle}>Sells As</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>On Hand</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Last Cost</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Avg Cost</th>
                <th style={thStyle}>Vendors</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Reorder</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const onHand = stockByItem[it.id] || 0
                const low = it.reorder_level != null && onHand <= Number(it.reorder_level)
                const ch = cheapest(it.id)
                const offers = offersByItem[it.id] || []
                return (
                  <tr key={it.id} style={{ borderTop: '1px solid var(--border, #e2e4e8)' }}>
                    <td style={tdStyle}>{dateFmt(it.last_cost_update_at || it.updated_at)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#002060' }}>{it.generic_name}
                      {it.description && <div style={{ fontWeight: 400, color: 'var(--mist,#777)', fontSize: 12 }}>{it.description}</div>}
                    </td>
                    <td style={tdStyle}>{it.category || '—'}</td>
                    <td style={tdStyle}>{it.base_unit}</td>
                    <td style={tdStyle}>{it.sell_unit}{Number(it.sell_unit_factor) !== 1 ? ` (${it.sell_unit_factor} ${it.base_unit})` : ''}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <span style={low ? { color: '#FF0000', fontWeight: 700 } : undefined}>{qtyFmt(onHand)}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(it.last_cost)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(it.avg_cost)}</td>
                    <td style={tdStyle}>
                      <button className="link-btn" onClick={() => openOfferings(it)}
                        style={{ background: 'none', border: 'none', color: '#215F9A', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                        {offers.length} vendor{offers.length === 1 ? '' : 's'}
                      </button>
                      {ch && <div style={{ fontSize: 12, color: 'var(--mist,#777)' }}>best {money(ch.last_cost_per_base_unit)} · {ch.vendors?.name}</div>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{it.reorder_level != null ? qtyFmt(it.reorder_level) : '—'}</td>
                    <td style={tdStyle}>
                      <button className="logout-button" onClick={() => openEdit(it)}>Edit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit item modal */}
      {showItemModal && (
        <div className="modal-backdrop" onClick={() => setShowItemModal(false)} style={backdrop}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={modalCard}>
            <h3 style={{ marginTop: 0 }}>{editingItemId ? 'Edit Item' : 'Add Item'}</h3>
            <form onSubmit={saveItem}>
              <div className="field">
                <label>Generic name (our name)</label>
                <input value={itemForm.generic_name} onChange={(e) => setItemForm({ ...itemForm, generic_name: e.target.value })} placeholder="e.g. Dual Run Capacitor 45/5 MFD 440V" required />
              </div>
              <div className="field">
                <label>Category</label>
                <input value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} placeholder="e.g. Capacitors" />
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label>Base unit (stock/consume in)</label>
                  <select value={itemForm.base_unit} onChange={(e) => {
                    const base = e.target.value
                    const f = suggestFactor(base, itemForm.sell_unit)
                    setItemForm({ ...itemForm, base_unit: base, ...(f != null ? { sell_unit_factor: String(f) } : {}) })
                  }}>
                    {BASE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="field" style={{ flex: 1, minWidth: 140 }}>
                  <label>Sell unit (Pricebook)</label>
                  <select value={itemForm.sell_unit} onChange={(e) => {
                    const sell = e.target.value
                    const f = suggestFactor(itemForm.base_unit, sell)
                    setItemForm({ ...itemForm, sell_unit: sell, ...(f != null ? { sell_unit_factor: String(f) } : {}) })
                  }}>
                    {BASE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="field" style={{ width: 150 }}>
                  <label>Base units per sell unit</label>
                  <input type="number" step="any" min="0" value={itemForm.sell_unit_factor}
                    onChange={(e) => setItemForm({ ...itemForm, sell_unit_factor: e.target.value })} />
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--mist,#777)', marginTop: -4 }}>
                e.g. refrigerant: base <b>ounce</b>, sell <b>pound</b>, factor <b>16</b>. A 12-pack sold singly: base <b>each</b>, sell <b>each</b>, factor <b>1</b>.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="field" style={{ width: 170 }}>
                  <label>Reorder level (base units)</label>
                  <input type="number" step="any" min="0" value={itemForm.reorder_level}
                    onChange={(e) => setItemForm({ ...itemForm, reorder_level: e.target.value })} placeholder="optional" />
                </div>
                <div className="field" style={{ width: 150 }}>
                  <label>Markup % (sell)</label>
                  <input type="number" step="any" min="0" value={itemForm.markup_percent}
                    onChange={(e) => setItemForm({ ...itemForm, markup_percent: e.target.value })} placeholder="org default" />
                </div>
              </div>
              <div className="field">
                <label>Description / spec (optional)</label>
                <input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
              </div>
              {error && <div className="auth-error" style={{ marginBottom: 10 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="auth-button" type="submit" disabled={savingItem} style={{ width: 'auto', padding: '10px 22px' }}>
                  {savingItem ? 'Saving…' : editingItemId ? 'Save Changes' : 'Add Item'}
                </button>
                <button type="button" className="logout-button" onClick={() => setShowItemModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vendor offerings drawer */}
      {offerItem && (
        <div className="modal-backdrop" onClick={() => setOfferItem(null)} style={backdrop}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ ...modalCard, maxWidth: 720 }}>
            <h3 style={{ marginTop: 0 }}>Vendors for “{offerItemLive?.generic_name}”</h3>
            <p style={{ fontSize: 13, color: 'var(--mist,#777)', marginTop: -6 }}>
              Each vendor's SKU, pack and cost. Cost per base unit = cost per pack ÷ pack size in base units.
              This is what lets the system cross-reference vendor part numbers and pick the cheapest source.
            </p>
            {offerList.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#002060' }}>
                    <th style={thStyle}>Vendor</th><th style={thStyle}>SKU</th><th style={thStyle}>Pack</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Cost/Pack</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Cost/{offerItemLive?.base_unit}</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {offerList.map((o) => (
                    <tr key={o.id} style={{ borderTop: '1px solid var(--border,#e2e4e8)' }}>
                      <td style={tdStyle}>{o.vendors?.name || '—'}</td>
                      <td style={tdStyle}>{o.vendor_sku || '—'}</td>
                      <td style={tdStyle}>{o.pack_label || '—'}{o.pack_base_qty ? ` (${o.pack_base_qty} ${offerItemLive?.base_unit})` : ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{money(o.last_cost_per_pack)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{money(o.last_cost_per_base_unit)}</td>
                      <td style={tdStyle}><button className="logout-button" onClick={() => deleteOffering(o.id)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <form onSubmit={saveOffering} style={{ borderTop: '1px solid var(--border,#e2e4e8)', paddingTop: 12 }}>
              <strong style={{ fontSize: 13 }}>Add a vendor offering</strong>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                <div className="field" style={{ flex: 1, minWidth: 160 }}>
                  <label>Vendor</label>
                  <select value={offerForm.vendor_id} onChange={(e) => setOfferForm({ ...offerForm, vendor_id: e.target.value })} required>
                    <option value="">— pick vendor —</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ width: 150 }}>
                  <label>Vendor SKU / Part #</label>
                  <input value={offerForm.vendor_sku} onChange={(e) => setOfferForm({ ...offerForm, vendor_sku: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Vendor description / product name</label>
                <input value={offerForm.vendor_description} onChange={(e) => setOfferForm({ ...offerForm, vendor_description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="field" style={{ width: 160 }}>
                  <label>Pack label</label>
                  <input value={offerForm.pack_label} onChange={(e) => setOfferForm({ ...offerForm, pack_label: e.target.value })} placeholder="e.g. 25 lb jug, 12-pack" />
                </div>
                <div className="field" style={{ width: 150 }}>
                  <label>Pack size ({offerItemLive?.base_unit})</label>
                  <input type="number" step="any" min="0" value={offerForm.pack_base_qty} onChange={(e) => setOfferForm({ ...offerForm, pack_base_qty: e.target.value })} />
                </div>
                <div className="field" style={{ width: 140 }}>
                  <label>Cost per pack</label>
                  <input type="number" step="any" min="0" value={offerForm.cost_per_pack} onChange={(e) => setOfferForm({ ...offerForm, cost_per_pack: e.target.value })} placeholder="$" />
                </div>
              </div>
              {offerForm.cost_per_pack && parseFloat(offerForm.pack_base_qty) > 0 && (
                <p style={{ fontSize: 12, color: '#002060', marginTop: -2 }}>
                  = {money(parseFloat(offerForm.cost_per_pack) / parseFloat(offerForm.pack_base_qty))} per {offerItemLive?.base_unit}
                </p>
              )}
              {error && <div className="auth-error" style={{ marginBottom: 10 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button className="auth-button" type="submit" disabled={savingOffer} style={{ width: 'auto', padding: '9px 18px' }}>
                  {savingOffer ? 'Saving…' : 'Add Vendor Offering'}
                </button>
                <button type="button" className="logout-button" onClick={() => setOfferItem(null)}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle = { padding: '10px 12px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }
const tdStyle = { padding: '9px 12px', verticalAlign: 'top' }
const backdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto', zIndex: 1000 }
const modalCard = { background: '#fff', borderRadius: 12, padding: 24, maxWidth: 560, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }
