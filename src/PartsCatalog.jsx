import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import ItemSearchSelect from './ItemSearchSelect'
import QuincyInvoiceImport from './QuincyInvoiceImport'
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
  is_inventory: true,
}
const blankOffering = {
  vendor_id: '', vendor_sku: '', vendor_description: '', pack_label: '',
  pack_base_qty: '1', cost_per_pack: '',
}

export default function PartsCatalog({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')

  const [vendors, setVendors] = useState([])
  const [shopLocationId, setShopLocationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  // Server-side catalog grid (scales to tens of thousands of parts)
  const CAT_PAGE = 100
  const [rows, setRows] = useState([])
  const [catFilter, setCatFilter] = useState('active')   // active | all | depleted | archived | deleted
  const [loadingRows, setLoadingRows] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  // Autocomplete suggestions under the search bar
  const [suggest, setSuggest] = useState([])
  const [showSuggest, setShowSuggest] = useState(false)

  // Item add/edit modal
  const [showItemModal, setShowItemModal] = useState(false)
  const [itemForm, setItemForm] = useState(blankItem)
  const [editingItemId, setEditingItemId] = useState(null)
  const [savingItem, setSavingItem] = useState(false)

  // Delete / deactivate item
  const [deleteTarget, setDeleteTarget] = useState(null)   // the item pending removal
  const [deleting, setDeleting] = useState(false)

  // Vendor offerings drawer
  const [offerItem, setOfferItem] = useState(null)         // the item whose offerings we're editing
  const [offerList, setOfferList] = useState([])           // that item's offerings (fetched on open)
  const [offerForm, setOfferForm] = useState(blankOffering)
  const [savingOffer, setSavingOffer] = useState(false)

  // Receiving
  const emptyLine = () => ({ item_id: '', item: null, offerings: [], offering_id: '', packs: '1', pack_base_qty: '1', cost_per_pack: '' })
  const [showReceive, setShowReceive] = useState(false)
  const [rcvVendor, setRcvVendor] = useState('')
  const [rcvRef, setRcvRef] = useState('')
  const [rcvDate, setRcvDate] = useState('')
  const [rcvNote, setRcvNote] = useState('')
  const [rcvLines, setRcvLines] = useState([emptyLine()])
  const [savingRcv, setSavingRcv] = useState(false)

  // Receipts / reverse
  const [showReceipts, setShowReceipts] = useState(false)
  const [receipts, setReceipts] = useState([])
  const [loadingReceipts, setLoadingReceipts] = useState(false)

  // Quincy invoice import
  const [showQuincy, setShowQuincy] = useState(false)
  const [seedInbound, setSeedInbound] = useState(null)

  // Quincy Inbox (emailed invoices awaiting review)
  const [showInbox, setShowInbox] = useState(false)
  const [inbound, setInbound] = useState([])
  const [loadingInbound, setLoadingInbound] = useState(false)
  const [pendingInbound, setPendingInbound] = useState(0)

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
    // Aux data only (small): shop location, vendors, pending-inbound count. The
    // catalog itself is fetched server-side by loadCatalog (scales to 44k+).
    const [loc, vendorsRes] = await Promise.all([
      supabase.from('part_locations').select('id').eq('org_id', selectedOrg).eq('kind', 'shop').limit(1).maybeSingle(),
      supabase.from('vendors').select('id, name').eq('org_id', selectedOrg).eq('is_active', true).order('name'),
    ])
    setShopLocationId(loc.data?.id || null)
    setVendors(vendorsRes.data || [])
    const { count } = await supabase.from('part_inbound_invoices')
      .select('id', { count: 'exact', head: true }).eq('org_id', selectedOrg).eq('status', 'pending')
    setPendingInbound(count || 0)
    setLoading(false)
    loadCatalog(0)   // refresh the server-side grid
  }

  // Server-side catalog fetch (search + Show filter + pagination).
  async function loadCatalog(offset = 0, append = false) {
    if (!selectedOrg) return
    setLoadingRows(true)
    const { data, error: err } = await supabase.rpc('search_parts', {
      p_org: selectedOrg, p_q: search.trim(), p_filter: catFilter, p_limit: CAT_PAGE, p_offset: offset,
    })
    if (err) { setError(err.message); setLoadingRows(false); return }
    const d = data || []
    setHasMore(d.length === CAT_PAGE)
    setRows((prev) => (append ? [...prev, ...d] : d))
    setLoadingRows(false)
  }

  // Reload the grid when org or filter changes.
  useEffect(() => { if (selectedOrg) loadCatalog(0) }, [selectedOrg, catFilter])  // eslint-disable-line react-hooks/exhaustive-deps
  // Debounced search (drives the grid).
  useEffect(() => {
    if (!selectedOrg) return
    const t = setTimeout(() => loadCatalog(0), 250)
    return () => clearTimeout(t)
  }, [search])  // eslint-disable-line react-hooks/exhaustive-deps

  // Autocomplete suggestions dropdown (searches the whole library as you type).
  useEffect(() => {
    if (!selectedOrg || !showSuggest || search.trim().length < 2) { setSuggest([]); return }
    let cancel = false
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_parts', { p_org: selectedOrg, p_q: search.trim(), p_filter: 'all', p_limit: 8, p_offset: 0 })
      if (!cancel) setSuggest(data || [])
    }, 180)
    return () => { cancel = true; clearTimeout(t) }
  }, [search, showSuggest, selectedOrg])

  async function loadInbound() {
    setLoadingInbound(true)
    const { data } = await supabase.from('part_inbound_invoices')
      .select('*').eq('org_id', selectedOrg).eq('status', 'pending').order('received_at', { ascending: false })
    setInbound(data || [])
    setLoadingInbound(false)
  }
  function openInbox() { setShowInbox(true); loadInbound() }
  async function dismissInbound(id) {
    await supabase.from('part_inbound_invoices').update({ status: 'dismissed' }).eq('id', id)
    loadInbound(); loadAll()
  }
  function reviewInbound(row) { setSeedInbound({ id: row.id, extracted: row.extracted }); setShowInbox(false); setShowQuincy(true) }

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
      is_inventory: it.is_inventory !== false,
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
      is_inventory: itemForm.is_inventory !== false,
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

  async function loadOfferings(itemId) {
    const { data } = await supabase.from('part_vendor_offerings')
      .select('*, vendors(name)').eq('org_id', selectedOrg).eq('item_id', itemId).order('last_cost_per_base_unit', { nullsFirst: false })
    setOfferList(data || [])
  }
  function openOfferings(it) {
    setOfferItem(it); setOfferForm(blankOffering); setError(''); setOfferList([]); loadOfferings(it.id)
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
      await supabase.from('part_items').update({
        last_cost: costBase,
        avg_cost: offerItem?.avg_cost != null ? offerItem.avg_cost : costBase,
        last_cost_update_at: new Date().toISOString(),
      }).eq('id', offerItem.id)
    }
    setSavingOffer(false)
    setOfferForm(blankOffering)
    await loadOfferings(offerItem.id)   // refresh the drawer
    loadCatalog(0)                       // refresh the grid's vendor/cost columns
  }

  async function deleteOffering(id) {
    await supabase.from('part_vendor_offerings').delete().eq('id', id)
    await loadOfferings(offerItem.id)
    loadCatalog(0)
  }

  // ---- Delete / deactivate item ------------------------------------------
  // "Deactivate" hides the item but preserves its receiving history (the safe
  // default for a real item you no longer stock). "Delete permanently" is for
  // accidental duplicates — it cascades the item's offerings, stock, and ledger.
  function confirmDelete(it) { setDeleteTarget(it); setError('') }

  async function deactivateItem() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error: err } = await supabase.from('part_items')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', deleteTarget.id)
    setDeleting(false)
    if (err) { setError(err.message); return }
    setDeleteTarget(null)
    loadAll()
  }

  async function softDeleteItem() {
    if (!deleteTarget) return
    setDeleting(true)
    // Soft delete: recoverable from the "Recently deleted" view. Nothing is
    // destroyed, so a confused click is never a disaster.
    const { error: err } = await supabase.from('part_items')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', deleteTarget.id)
    setDeleting(false)
    if (err) { setError(err.message); return }
    setDeleteTarget(null)
    loadAll()
  }

  async function restoreItem(it) {
    await supabase.from('part_items')
      .update({ deleted_at: null, is_active: true, updated_at: new Date().toISOString() })
      .eq('id', it.id)
    loadAll()
  }

  // ---- Receiving ----------------------------------------------------------
  function openReceive() {
    setRcvVendor(''); setRcvRef(''); setRcvDate(''); setRcvNote(''); setRcvLines([emptyLine()]); setError(''); setShowReceive(true)
  }
  function setLine(idx, patch) {
    setRcvLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  // Pick a catalog item for a receive line; fetch that item's vendor offerings on demand.
  async function pickReceiveItem(idx, it) {
    if (!it) { setLine(idx, { item_id: '', item: null, offerings: [], offering_id: '' }); return }
    setLine(idx, { item_id: it.id, item: it, offerings: [], offering_id: '' })
    const { data } = await supabase.from('part_vendor_offerings')
      .select('*, vendors(name)').eq('org_id', selectedOrg).eq('item_id', it.id)
    setRcvLines((ls) => ls.map((l, i) => (i === idx ? { ...l, offerings: data || [] } : l)))
  }
  function chooseOffering(idx, offeringId) {
    const line = rcvLines[idx]
    const o = (line.offerings || []).find((x) => x.id === offeringId)
    if (o) setLine(idx, {
      offering_id: offeringId,
      pack_base_qty: String(o.pack_base_qty ?? 1),
      cost_per_pack: o.last_cost_per_pack != null ? String(o.last_cost_per_pack) : line.cost_per_pack,
    })
    else setLine(idx, { offering_id: '' })
  }
  async function submitReceive(e) {
    e.preventDefault()
    const lines = rcvLines
      .filter((l) => l.item_id)
      .map((l) => {
        const packs = parseFloat(l.packs) || 0
        const packBase = parseFloat(l.pack_base_qty) || 1
        const costPack = l.cost_per_pack === '' ? null : parseFloat(l.cost_per_pack)
        return {
          item_id: l.item_id,
          qty_base: packs * packBase,
          cost_per_base: costPack != null && packBase > 0 ? costPack / packBase : null,
        }
      })
      .filter((l) => l.qty_base > 0)
    if (!lines.length) { setError('Add at least one line with a quantity received.'); return }
    setSavingRcv(true)
    const { error: rpcErr } = await supabase.rpc('part_receive', {
      p_org: selectedOrg,
      p_vendor: rcvVendor || null,
      p_reference: rcvRef.trim() || null,
      p_received_at: rcvDate ? new Date(rcvDate + 'T12:00:00').toISOString() : null,
      p_note: rcvNote.trim() || null,
      p_lines: lines,
    })
    setSavingRcv(false)
    if (rpcErr) { setError(rpcErr.message); return }
    setShowReceive(false)
    loadAll()
  }

  async function loadReceipts() {
    setLoadingReceipts(true)
    const { data } = await supabase
      .from('part_receipts').select('*, vendors(name)')
      .eq('org_id', selectedOrg).order('received_at', { ascending: false }).limit(50)
    const ids = (data || []).map((r) => r.id)
    const lm = {}
    if (ids.length) {
      const { data: led } = await supabase.from('part_ledger').select('batch_id, flagged, kind').in('batch_id', ids)
      for (const l of led || []) {
        if (l.kind !== 'receive') continue
        lm[l.batch_id] = lm[l.batch_id] || { lines: 0, flags: 0 }
        lm[l.batch_id].lines++; if (l.flagged) lm[l.batch_id].flags++
      }
    }
    setReceipts((data || []).map((r) => ({ ...r, _lines: lm[r.id]?.lines || 0, _flags: lm[r.id]?.flags || 0 })))
    setLoadingReceipts(false)
  }
  function openReceipts() { setShowReceipts(true); loadReceipts() }
  async function reverseReceipt(id) {
    if (!window.confirm('Reverse this receipt? It backs out the stock it added and recalculates cost.')) return
    const { error: rpcErr } = await supabase.rpc('part_reverse_receipt', { p_batch: id })
    if (rpcErr) { alert(rpcErr.message); return }
    await loadReceipts(); await loadAll()
  }

  async function exportCsv() {
    // Export the current view (Show filter + search), paged from the server so it
    // scales. Column headers match the importer for round-trip edits.
    const cols = [
      { label: 'Name', key: 'generic_name' },
      { label: 'Category', value: (i) => i.category || '' },
      { label: 'Base Unit', key: 'base_unit' },
      { label: 'Sell Unit', key: 'sell_unit' },
      { label: 'Sell Unit Factor', value: (i) => i.sell_unit_factor },
      { label: 'Reorder Level', value: (i) => (i.reorder_level != null ? i.reorder_level : '') },
      { label: 'Markup %', value: (i) => (i.markup_percent != null ? i.markup_percent : '') },
      { label: 'Description', value: (i) => i.description || '' },
      { label: 'On Hand (Shop)', value: (i) => qtyFmt(i.on_hand || 0) },
      { label: 'Last Cost / Unit', value: (i) => (i.last_cost != null ? Number(i.last_cost).toFixed(4) : '') },
      { label: 'Avg Cost / Unit', value: (i) => (i.avg_cost != null ? Number(i.avg_cost).toFixed(4) : '') },
      { label: 'Vendors', value: (i) => i.vendor_count || 0 },
      { label: 'Updated', value: (i) => dateFmt(i.last_cost_update_at || i.updated_at) },
    ]
    const all = []
    for (let off = 0; off < 60000; off += 1000) {
      const { data } = await supabase.rpc('search_parts', { p_org: selectedOrg, p_q: search.trim(), p_filter: catFilter, p_limit: 1000, p_offset: off })
      const d = data || []
      all.push(...d)
      if (d.length < 1000) break
    }
    exportToCSV(all, cols, 'parts-catalog.csv')
  }

  const offerItemLive = offerItem

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
        <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 240 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSuggest(true) }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            placeholder="Search name, vendor SKU, model # or description…"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border, #ccc)' }}
          />
          {showSuggest && suggest.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 60, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d7dbe2', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 340, overflowY: 'auto', marginTop: 3 }}>
              {suggest.map((s) => (
                <div key={s.id}
                  onMouseDown={(e) => { e.preventDefault(); setSearch(s.generic_name); setShowSuggest(false); if (catFilter !== 'all' && Number(s.on_hand) <= 0 && !(s.reorder_level > 0)) setCatFilter('all') }}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid #f0f1f4' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#EEF3FB')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#002060' }}>{s.generic_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--mist,#777)' }}>
                    {s.category || 'Uncategorized'}{s.model_number ? ` · ${s.model_number}` : ''}
                    {s.cheapest_cost != null ? ` · ${money(s.cheapest_cost)}${s.cheapest_vendor ? ' · ' + s.cheapest_vendor : ''}` : ''}
                    {Number(s.on_hand) > 0 ? ` · ${qtyFmt(s.on_hand)} on hand` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} title="Which items to show"
          style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border, #ccc)' }}>
          <option value="active">Active (stocked / kept / bought ≤30d)</option>
          <option value="all">All parts (full library)</option>
          <option value="depleted">Depleted (now empty)</option>
          <option value="archived">Archived</option>
          <option value="deleted">Recently deleted</option>
        </select>
        <button className="auth-button" style={{ width: 'auto', padding: '9px 18px' }} onClick={openAdd}>+ Add Item</button>
        <button className="auth-button" style={{ width: 'auto', padding: '9px 18px', background: '#215F9A' }} onClick={openReceive}>Receive Stock</button>
        <button className="auth-button" style={{ width: 'auto', padding: '9px 18px', background: '#FF0000' }} onClick={() => { setSeedInbound(null); setShowQuincy(true) }}>Import from Invoice · Quincy</button>
        <button className="logout-button" onClick={openInbox}>Quincy Inbox{pendingInbound > 0 ? ` (${pendingInbound})` : ''}</button>
        <button className="logout-button" onClick={openReceipts}>Receipts</button>
        <button className="logout-button" onClick={exportCsv}>Export CSV</button>
        <Link className="logout-button" to="/import/parts-catalog" style={{ textDecoration: 'none' }}>Import CSV</Link>
        <Link className="logout-button" to="/import/vendor-prices" style={{ textDecoration: 'none' }}>Import Vendor File</Link>
        <span style={{ color: 'var(--mist)', fontSize: 13 }}>{rows.length}{hasMore ? '+' : ''} item{rows.length === 1 ? '' : 's'}</span>
      </div>

      {error && !showItemModal && !offerItem && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}

      {loading && rows.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>
          {search.trim()
            ? 'No parts match your search.'
            : catFilter === 'active'
              ? 'Nothing active yet. Add an item, receive stock, or switch “Show” to All parts / let Quincy add them from a vendor invoice.'
              : 'No items in this view.'}
        </p>
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
              {rows.map((it) => {
                const isInv = it.is_inventory !== false
                const onHand = Number(it.on_hand) || 0
                const low = isInv && it.reorder_level != null && onHand <= Number(it.reorder_level)
                return (
                  <tr key={it.id} style={{ borderTop: '1px solid var(--border, #e2e4e8)' }}>
                    <td style={tdStyle}>{dateFmt(it.last_cost_update_at || it.updated_at)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#002060' }}>{it.generic_name}
                      {!isInv && <span title="Non-inventory — expensed, no on-hand" style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#7A5C00', background: '#FFF3CD', border: '1px solid #FFE39A', borderRadius: 4, padding: '1px 5px', verticalAlign: 'middle' }}>NON-INV</span>}
                      {it.description && <div style={{ fontWeight: 400, color: 'var(--mist,#777)', fontSize: 12 }}>{it.description}</div>}
                    </td>
                    <td style={tdStyle}>{it.category || '—'}</td>
                    <td style={tdStyle}>{it.base_unit}</td>
                    <td style={tdStyle}>{it.sell_unit}{Number(it.sell_unit_factor) !== 1 ? ` (${it.sell_unit_factor} ${it.base_unit})` : ''}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {isInv
                        ? <span style={low ? { color: '#FF0000', fontWeight: 700 } : undefined}>{qtyFmt(onHand)}</span>
                        : <span style={{ color: 'var(--mist,#bbb)' }}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(it.last_cost)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(it.avg_cost)}</td>
                    <td style={tdStyle}>
                      <button className="link-btn" onClick={() => openOfferings(it)}
                        style={{ background: 'none', border: 'none', color: '#215F9A', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                        {it.vendor_count || 0} vendor{it.vendor_count === 1 ? '' : 's'}
                      </button>
                      {it.cheapest_cost != null && <div style={{ fontSize: 12, color: 'var(--mist,#777)' }}>best {money(it.cheapest_cost)}{it.cheapest_vendor ? ` · ${it.cheapest_vendor}` : ''}</div>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{it.reorder_level != null ? qtyFmt(it.reorder_level) : '—'}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {catFilter === 'deleted' ? (
                          <button className="logout-button" onClick={() => restoreItem(it)}>Restore</button>
                        ) : (
                          <>
                            <button className="logout-button" onClick={() => openEdit(it)}>Edit</button>
                            <button
                              onClick={() => confirmDelete(it)}
                              title="Delete or deactivate this item"
                              style={{ background: 'none', border: '1px solid #FF0000', color: '#FF0000', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                            >Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {hasMore && (
            <div style={{ textAlign: 'center', padding: 12 }}>
              <button className="logout-button" disabled={loadingRows} onClick={() => loadCatalog(rows.length, true)}>
                {loadingRows ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete / deactivate confirmation */}
      {deleteTarget && (() => {
        const onHand = Number(deleteTarget.on_hand ?? 0)
        const offerCount = Number(deleteTarget.vendor_count ?? 0)
        const hasHistory = onHand !== 0 || offerCount > 0 || deleteTarget.last_cost != null
        return (
          <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)} style={backdrop}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ ...modalCard, maxWidth: 520 }}>
              <h3 style={{ marginTop: 0, color: '#002060' }}>Remove “{deleteTarget.generic_name}”?</h3>
              {hasHistory ? (
                <div style={{ background: '#FFF4F4', border: '1px solid #FFD1D1', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#B00020', marginBottom: 6 }}>This item has activity</div>
                  <div style={{ fontSize: 14, color: '#334155' }}>
                    On-hand: <b>{qtyFmt(onHand)} {deleteTarget.base_unit}</b> · Vendor offerings: <b>{offerCount}</b>
                    {deleteTarget.last_cost != null && <> · Last cost: <b>{money(deleteTarget.last_cost)}</b></>}.
                    Deleting moves it to <b>Recently deleted</b> (recoverable). If you simply no longer stock it,
                    <b> Archive</b> keeps it fully in place, just out of the active view.
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 14, color: '#334155', marginBottom: 16 }}>
                  This item has no stock or history. Deleting moves it to <b>Recently deleted</b>, where you can restore it.
                </p>
              )}
              {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {hasHistory && (
                  <button onClick={deactivateItem} disabled={deleting}
                    style={{ flex: 1, minWidth: 150, padding: '11px', borderRadius: 8, border: '1px solid #002060', background: '#002060', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                    {deleting ? 'Working…' : 'Archive (hide)'}
                  </button>
                )}
                <button onClick={softDeleteItem} disabled={deleting}
                  style={{ flex: 1, minWidth: 150, padding: '11px', borderRadius: 8, border: '1px solid #FF0000', background: hasHistory ? '#fff' : '#FF0000', color: hasHistory ? '#FF0000' : '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  {deleting ? 'Working…' : 'Delete'}
                </button>
                <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                  style={{ flex: '0 0 auto', padding: '11px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
              <div className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={itemForm.is_inventory !== false}
                    onChange={(e) => setItemForm({ ...itemForm, is_inventory: e.target.checked })} />
                  <span>Track in inventory (on-hand &amp; stock)</span>
                </label>
                <div style={{ fontSize: 12, color: 'var(--mist,#777)', marginTop: 2 }}>
                  Uncheck for equipment or job-specific items you don’t stock (heat pumps, air handlers). They keep cost/price history but never carry an on-hand count.
                </div>
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

      {/* Receive stock */}
      {showReceive && (
        <div className="modal-backdrop" onClick={() => setShowReceive(false)} style={backdrop}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ ...modalCard, maxWidth: 900 }}>
            <h3 style={{ marginTop: 0 }}>Receive Stock</h3>
            <p style={{ fontSize: 13, color: 'var(--mist,#777)', marginTop: -6 }}>
              Received into the Shop. Raises on-hand, updates weighted-average cost, flags cost jumps, and nudges the Pricebook. Fully reversible.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label>Vendor</label>
                <select value={rcvVendor} onChange={(e) => setRcvVendor(e.target.value)}>
                  <option value="">— optional —</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ width: 170 }}>
                <label>PO / Invoice #</label>
                <input value={rcvRef} onChange={(e) => setRcvRef(e.target.value)} />
              </div>
              <div className="field" style={{ width: 160 }}>
                <label>Received date</label>
                <input type="date" value={rcvDate} onChange={(e) => setRcvDate(e.target.value)} />
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, margin: '8px 0 12px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#002060' }}>
                  <th style={thStyle}>Item</th><th style={thStyle}>Vendor offering</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Packs</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Pack size</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cost/pack</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Adds</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {rcvLines.map((l, idx) => {
                  const it = l.item
                  const offers = l.offerings || []
                  const packs = parseFloat(l.packs) || 0
                  const packBase = parseFloat(l.pack_base_qty) || 0
                  const costPack = l.cost_per_pack === '' ? null : parseFloat(l.cost_per_pack)
                  const addQty = packs * packBase
                  const costBase = costPack != null && packBase > 0 ? costPack / packBase : null
                  return (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border,#e2e4e8)' }}>
                      <td style={tdStyle}>
                        <ItemSearchSelect orgId={selectedOrg} valueLabel={l.item?.generic_name}
                          placeholder="Search item…" onSelect={(sel) => pickReceiveItem(idx, sel)} />
                      </td>
                      <td style={tdStyle}>
                        <select value={l.offering_id} onChange={(e) => chooseOffering(idx, e.target.value)} disabled={!offers.length} style={{ minWidth: 150 }}>
                          <option value="">{offers.length ? '— optional —' : '(none)'}</option>
                          {offers.map((o) => <option key={o.id} value={o.id}>{o.vendors?.name} · {o.pack_label || o.vendor_sku || 'pack'}</option>)}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <input type="number" step="any" min="0" value={l.packs} onChange={(e) => setLine(idx, { packs: e.target.value })} style={{ width: 64, textAlign: 'right' }} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <input type="number" step="any" min="0" value={l.pack_base_qty} onChange={(e) => setLine(idx, { pack_base_qty: e.target.value })} style={{ width: 72, textAlign: 'right' }} />
                        <div style={{ fontSize: 11, color: 'var(--mist,#777)' }}>{it?.base_unit || 'units'}</div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <input type="number" step="any" min="0" value={l.cost_per_pack} onChange={(e) => setLine(idx, { cost_per_pack: e.target.value })} style={{ width: 84, textAlign: 'right' }} placeholder="$" />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {addQty > 0 ? `${qtyFmt(addQty)} ${it?.base_unit || ''}` : '—'}
                        {costBase != null && <div style={{ fontSize: 11, color: 'var(--mist,#777)' }}>{money(costBase)}/{it?.base_unit}</div>}
                      </td>
                      <td style={tdStyle}>
                        {rcvLines.length > 1 && <button type="button" className="logout-button" onClick={() => setRcvLines((ls) => ls.filter((_, i) => i !== idx))}>×</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <button type="button" className="logout-button" onClick={() => setRcvLines((ls) => [...ls, emptyLine()])}>+ Add line</button>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Note (optional)</label>
              <input value={rcvNote} onChange={(e) => setRcvNote(e.target.value)} />
            </div>
            {error && <div className="auth-error" style={{ marginBottom: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="auth-button" onClick={submitReceive} disabled={savingRcv} style={{ width: 'auto', padding: '10px 22px' }}>
                {savingRcv ? 'Receiving…' : 'Receive into Shop'}
              </button>
              <button type="button" className="logout-button" onClick={() => setShowReceive(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Quincy invoice import (manual upload or seeded from the inbox) */}
      {showQuincy && (
        <QuincyInvoiceImport
          orgId={selectedOrg}
          vendors={vendors}
          seedInbound={seedInbound}
          onClose={() => { setShowQuincy(false); setSeedInbound(null) }}
          onApplied={() => { loadAll(); loadInbound() }}
        />
      )}

      {/* Quincy Inbox — emailed invoices awaiting review */}
      {showInbox && (
        <div className="modal-backdrop" onClick={() => setShowInbox(false)} style={backdrop}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ ...modalCard, maxWidth: 780 }}>
            <h3 style={{ marginTop: 0 }}>Quincy Inbox</h3>
            <p style={{ fontSize: 13, color: 'var(--mist,#777)', marginTop: -6 }}>
              Invoices emailed to your intake address land here. Review applies them the same as an upload; dismiss ignores one.
            </p>
            {loadingInbound ? (
              <p style={{ color: 'var(--mist)' }}>Loading…</p>
            ) : inbound.length === 0 ? (
              <p style={{ color: 'var(--mist)' }}>Nothing waiting. Forwarded invoices will appear here.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: '#002060' }}>
                  <th style={thStyle}>Received</th><th style={thStyle}>From</th><th style={thStyle}>Subject</th>
                  <th style={thStyle}>Read</th><th style={thStyle}></th>
                </tr></thead>
                <tbody>
                  {inbound.map((r) => {
                    const nLines = r.extracted?.lines?.length || 0
                    return (
                      <tr key={r.id} style={{ borderTop: '1px solid var(--border,#e2e4e8)' }}>
                        <td style={tdStyle}>{dateFmt(r.received_at)}</td>
                        <td style={tdStyle}>{r.from_email || '—'}</td>
                        <td style={tdStyle}>{r.subject || '—'}</td>
                        <td style={tdStyle}>{r.error ? <span style={{ color: '#FF0000' }} title={r.error}>needs manual</span> : `${nLines} line${nLines === 1 ? '' : 's'}`}</td>
                        <td style={tdStyle}>
                          {r.extracted ? <button className="auth-button" style={{ width: 'auto', padding: '6px 14px' }} onClick={() => reviewInbound(r)}>Review</button> : null}
                          <button className="logout-button" style={{ marginLeft: 6 }} onClick={() => dismissInbound(r.id)}>Dismiss</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 14 }}><button className="logout-button" onClick={() => setShowInbox(false)}>Close</button></div>
          </div>
        </div>
      )}

      {/* Receipts / reverse */}
      {showReceipts && (
        <div className="modal-backdrop" onClick={() => setShowReceipts(false)} style={backdrop}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ ...modalCard, maxWidth: 760 }}>
            <h3 style={{ marginTop: 0 }}>Recent Receipts</h3>
            <p style={{ fontSize: 13, color: 'var(--mist,#777)', marginTop: -6 }}>
              Each received batch. Reverse backs out its stock and recalculates cost. (Later these also appear in the vendor's history by PO.)
            </p>
            {loadingReceipts ? (
              <p style={{ color: 'var(--mist)' }}>Loading…</p>
            ) : receipts.length === 0 ? (
              <p style={{ color: 'var(--mist)' }}>No receipts yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#002060' }}>
                    <th style={thStyle}>Date</th><th style={thStyle}>Vendor</th><th style={thStyle}>PO / Inv</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Lines</th><th style={thStyle}>Status</th><th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border,#e2e4e8)' }}>
                      <td style={tdStyle}>{dateFmt(r.received_at)}</td>
                      <td style={tdStyle}>{r.vendors?.name || '—'}</td>
                      <td style={tdStyle}>{r.reference || '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{r._lines}{r._flags > 0 && <span style={{ color: '#FF0000' }} title="cost-jump flag"> ⚑{r._flags}</span>}</td>
                      <td style={tdStyle}>{r.reversed_at ? <span style={{ color: 'var(--mist,#777)' }}>Reversed</span> : <span style={{ color: '#1a7f37' }}>Active</span>}</td>
                      <td style={tdStyle}>{!r.reversed_at && <button className="logout-button" onClick={() => reverseReceipt(r.id)}>Reverse</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 14 }}>
              <button type="button" className="logout-button" onClick={() => setShowReceipts(false)}>Close</button>
            </div>
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
