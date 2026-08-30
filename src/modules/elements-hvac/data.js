// Elements-HVAC · Module 1 (Inventory) · data layer
// All access is org-scoped and gated by RLS. Core tables (services, users) are
// read-only from the module's perspective; the module owns every elements_* table.
import { supabase } from '../../utils/supabase'

// Generate a stable internal key (kept under the hood; users work in part names).
// `taken` is a Set of lowercased keys already in use, to avoid collisions.
export function deriveSku(name, taken) {
  let base = (name || 'ITEM').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'ITEM'
  let key = base
  let n = 2
  while (taken && taken.has(key.toLowerCase())) { key = `${base}-${n}`; n += 1 }
  if (taken) taken.add(key.toLowerCase())
  return key
}

// ---- Settings -------------------------------------------------------------
export async function getSettings(orgId) {
  const { data } = await supabase
    .from('elements_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()
  return data || null
}

export async function upsertSettings(orgId, patch) {
  const { data, error } = await supabase
    .from('elements_settings')
    .upsert({ org_id: orgId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
    .select()
    .single()
  return { data, error }
}

// ---- Locations (warehouses / trucks) --------------------------------------
export async function listLocations(orgId, { includeInactive = false } = {}) {
  let q = supabase.from('elements_locations').select('*').eq('org_id', orgId).order('type').order('name')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data } = await q
  return data || []
}

export async function addLocation(orgId, row) {
  return supabase.from('elements_locations').insert({ org_id: orgId, ...row }).select().single()
}

export async function updateLocation(id, patch) {
  return supabase.from('elements_locations').update(patch).eq('id', id)
}

export async function deleteLocation(id) {
  return supabase.from('elements_locations').delete().eq('id', id)
}

// ---- Items (SKU catalog) --------------------------------------------------
export async function listItems(orgId, { includeInactive = false } = {}) {
  let q = supabase.from('elements_items').select('*').eq('org_id', orgId).order('category').order('sku')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data } = await q
  return data || []
}

export async function addItem(orgId, row) {
  return supabase.from('elements_items').insert({ org_id: orgId, ...row }).select().single()
}

export async function updateItem(id, patch) {
  return supabase.from('elements_items').update(patch).eq('id', id)
}

export async function deleteItem(id) {
  return supabase.from('elements_items').delete().eq('id', id)
}

// ---- Core reads: services (pricebook) & technicians -----------------------
export async function listServices(orgId) {
  const { data } = await supabase
    .from('services')
    .select('id, name, category, is_active')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('category')
    .order('name')
  return data || []
}

export async function listTechnicians(orgId) {
  // Anyone who can be assigned a truck. Keep it broad; the office assigns trucks.
  const { data } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('full_name')
  return data || []
}

// ---- Service -> SKU map ----------------------------------------------------
export async function listMaps(orgId) {
  const { data } = await supabase
    .from('elements_service_items')
    .select('id, service_id, item_id, qty_per, item:elements_items(id, sku, description, item_class)')
    .eq('org_id', orgId)
  return data || []
}

export async function createItemAndMap(orgId, itemRow, serviceId, qtyPer = 1) {
  const { data: item, error: itemErr } = await addItem(orgId, itemRow)
  if (itemErr) return { error: itemErr }
  const { data: map, error: mapErr } = await supabase
    .from('elements_service_items')
    .insert({ org_id: orgId, service_id: serviceId, item_id: item.id, qty_per: qtyPer })
    .select()
    .single()
  if (mapErr) return { error: mapErr, item }
  return { item, map }
}

export async function mapExistingItem(orgId, serviceId, itemId, qtyPer = 1) {
  return supabase
    .from('elements_service_items')
    .insert({ org_id: orgId, service_id: serviceId, item_id: itemId, qty_per: qtyPer })
    .select()
    .single()
}

export async function unmap(mapId) {
  return supabase.from('elements_service_items').delete().eq('id', mapId)
}

export async function updateMap(mapId, patch) {
  return supabase.from('elements_service_items').update(patch).eq('id', mapId)
}

// ---- Usage report (from the consumption ledger) ---------------------------
export async function usageReport(orgId, fromIso, toIso) {
  let q = supabase
    .from('elements_stock_txns')
    .select('qty_delta, unit_cost, created_at, created_by, item:elements_items(sku, description), location:elements_locations(name, type, assigned_user_id)')
    .eq('org_id', orgId)
    .eq('txn_type', 'consumption')
  if (fromIso) q = q.gte('created_at', fromIso)
  if (toIso) q = q.lte('created_at', toIso)
  const { data } = await q.order('created_at', { ascending: false })
  return data || []
}

// ---- Stock: ledger-backed on-hand, receiving & transfers ------------------
// elements_stock_txns is the source of truth (one immutable row per movement);
// elements_stock_levels caches on_hand per item+location and holds par levels.

// All active stocking locations (shop/warehouse + trucks).
export async function listAllLocations(orgId) {
  const { data } = await supabase
    .from('elements_locations')
    .select('id, name, type')
    .eq('org_id', orgId).eq('is_active', true)
    .order('type').order('name')
  return data || []
}

// Cached levels for a location (on_hand + par levels), keyed by item_id.
export async function listStockLevels(orgId, locationId) {
  let q = supabase.from('elements_stock_levels')
    .select('item_id, location_id, on_hand, reorder_point, max_level, par_level, bin')
    .eq('org_id', orgId)
  if (locationId) q = q.eq('location_id', locationId)
  const { data } = await q
  return data || []
}

// Recompute the cached on_hand for one item+location from the ledger.
async function recomputeLevel(orgId, itemId, locationId) {
  const { data: txns } = await supabase
    .from('elements_stock_txns').select('qty_delta')
    .eq('org_id', orgId).eq('item_id', itemId).eq('location_id', locationId)
  const onHand = (txns || []).reduce((s, t) => s + Number(t.qty_delta || 0), 0)
  const { data: existing } = await supabase
    .from('elements_stock_levels').select('id')
    .eq('org_id', orgId).eq('item_id', itemId).eq('location_id', locationId).maybeSingle()
  if (existing) return supabase.from('elements_stock_levels').update({ on_hand: onHand }).eq('id', existing.id)
  return supabase.from('elements_stock_levels').insert({ org_id: orgId, item_id: itemId, location_id: locationId, on_hand: onHand })
}

// Receive stock into a location at a unit cost (records a receipt in the ledger).
export async function receiveStock(orgId, { location_id, item_id, qty, unit_cost, note }) {
  const q = Number(qty)
  if (!location_id || !item_id || !(q > 0)) return { error: { message: 'Pick a location and item, and a quantity above zero.' } }
  const cost = unit_cost === '' || unit_cost == null ? null : Number(unit_cost)
  const { error } = await supabase.from('elements_stock_txns').insert({
    org_id: orgId, item_id, location_id, txn_type: 'receipt', qty_delta: q, unit_cost: cost,
    ref_type: 'manual', reason_code: 'receive', note: note || null,
  })
  if (error) return { error }
  if (cost != null) await supabase.from('elements_items').update({ last_cost: cost }).eq('id', item_id)
  await recomputeLevel(orgId, item_id, location_id)
  return {}
}

// Move stock between two locations (records paired out/in ledger rows).
export async function transferStock(orgId, { from_location_id, to_location_id, item_id, qty, unit_cost, note }) {
  const q = Number(qty)
  if (!from_location_id || !to_location_id || from_location_id === to_location_id || !item_id || !(q > 0))
    return { error: { message: 'Pick different From/To locations, an item, and a quantity above zero.' } }
  const cost = unit_cost === '' || unit_cost == null ? null : Number(unit_cost)
  const { error } = await supabase.from('elements_stock_txns').insert([
    { org_id: orgId, item_id, location_id: from_location_id, txn_type: 'transfer_out', qty_delta: -q, unit_cost: cost, ref_type: 'manual', reason_code: 'transfer', note: note || null },
    { org_id: orgId, item_id, location_id: to_location_id, txn_type: 'transfer_in', qty_delta: q, unit_cost: cost, ref_type: 'manual', reason_code: 'transfer', note: note || null },
  ])
  if (error) return { error }
  await recomputeLevel(orgId, item_id, from_location_id)
  await recomputeLevel(orgId, item_id, to_location_id)
  return {}
}

// ---- Parts Used: invoice-driven consumption -------------------------------
// When a job's invoice is finalized, the parts actually used deplete the tech's
// truck. Consumption rows are tagged ref_type='invoice', ref_id=<invoice id> so
// re-recording is idempotent (we clear this invoice's rows, then rewrite).

// Basic invoice header (number + job) for the panel.
export async function getInvoiceHeader(orgId, invoiceId) {
  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, job_id, kind, estimating_technician_id')
    .eq('org_id', orgId).eq('id', invoiceId).maybeSingle()
  return data || null
}

// The truck (stocking location) for an invoice: primary job technician's truck,
// falling back to the estimating technician. Returns a location row or null.
export async function resolveInvoiceTruck(orgId, invoiceId) {
  const { data: inv } = await supabase
    .from('invoices').select('id, job_id, estimating_technician_id')
    .eq('org_id', orgId).eq('id', invoiceId).maybeSingle()
  if (!inv) return null
  let userId = null
  if (inv.job_id) {
    const { data: jt } = await supabase
      .from('job_technicians').select('user_id, sort_order')
      .eq('org_id', orgId).eq('job_id', inv.job_id).order('sort_order').limit(1)
    if (jt && jt[0]) userId = jt[0].user_id
  }
  if (!userId) userId = inv.estimating_technician_id || null
  if (!userId) return null
  const { data: locs } = await supabase
    .from('elements_locations').select('id, name, type, assigned_user_id')
    .eq('org_id', orgId).eq('type', 'truck').eq('assigned_user_id', userId).eq('is_active', true).limit(1)
  return (locs && locs[0]) || null
}

// Billed service lines on an invoice (used to seed the parts list).
export async function listInvoiceServiceLines(orgId, invoiceId) {
  const { data } = await supabase
    .from('invoice_line_items')
    .select('id, description, quantity, service_id, service_price_id, is_custom, sort_order')
    .eq('org_id', orgId).eq('invoice_id', invoiceId).order('sort_order')
  return data || []
}

// Suggested parts for an invoice = union of the kits of every billed service,
// each part's qty = kit qty_per × the billed line quantity. Resolves service_id
// from service_price_id when the line didn't carry it (estimate-mirror path).
export async function seedPartsUsed(orgId, invoiceId) {
  const lines = await listInvoiceServiceLines(orgId, invoiceId)
  const needPrice = lines.filter((l) => !l.service_id && l.service_price_id).map((l) => l.service_price_id)
  const priceToService = {}
  if (needPrice.length) {
    const { data: sp } = await supabase.from('service_prices').select('id, service_id').in('id', needPrice)
    ;(sp || []).forEach((r) => { priceToService[r.id] = r.service_id })
  }
  const svcQty = {}
  lines.forEach((l) => {
    const sid = l.service_id || priceToService[l.service_price_id]
    if (!sid) return
    svcQty[sid] = (svcQty[sid] || 0) + Number(l.quantity || 1)
  })
  const sids = Object.keys(svcQty)
  if (!sids.length) return []
  const { data: maps } = await supabase
    .from('elements_service_items')
    .select('service_id, item_id, qty_per, item:elements_items(id, description, category, last_cost, standard_cost)')
    .eq('org_id', orgId).in('service_id', sids)
  const byItem = {}
  ;(maps || []).forEach((m) => {
    const add = Number(m.qty_per || 0) * (svcQty[m.service_id] || 0)
    if (!byItem[m.item_id]) byItem[m.item_id] = { item_id: m.item_id, item: m.item || null, qty: 0 }
    byItem[m.item_id].qty += add
  })
  return Object.values(byItem)
}

// Parts already recorded against an invoice (the consumption ledger rows).
export async function listPartsUsed(orgId, invoiceId) {
  const { data } = await supabase
    .from('elements_stock_txns')
    .select('id, item_id, location_id, qty_delta, unit_cost, created_at, item:elements_items(id, description, category, last_cost, standard_cost)')
    .eq('org_id', orgId).eq('ref_type', 'invoice').eq('ref_id', invoiceId).eq('txn_type', 'consumption')
    .order('created_at')
  return data || []
}

// Which of these invoices already have parts recorded (for list badges).
export async function partsUsedStatus(orgId, invoiceIds) {
  if (!invoiceIds || !invoiceIds.length) return new Set()
  const { data } = await supabase
    .from('elements_stock_txns').select('ref_id')
    .eq('org_id', orgId).eq('ref_type', 'invoice').eq('txn_type', 'consumption')
    .in('ref_id', invoiceIds)
  return new Set((data || []).map((r) => r.ref_id))
}

// Record (or re-record) the parts used on an invoice. Idempotent: clears this
// invoice's prior consumption, writes fresh rows against one location, and
// recomputes on-hand for every item+location touched (old and new).
export async function recordPartsUsed(orgId, invoiceId, { location_id, lines }) {
  if (!location_id) return { error: { message: 'No stocking location set. Pick the truck (or warehouse) to deplete from.' } }
  const clean = (lines || [])
    .map((l) => ({ item_id: l.item_id, qty: Number(l.qty), unit_cost: (l.unit_cost === '' || l.unit_cost == null) ? null : Number(l.unit_cost) }))
    .filter((l) => l.item_id && l.qty > 0)
  const prior = await listPartsUsed(orgId, invoiceId)
  const affected = new Set()
  prior.forEach((r) => affected.add(`${r.item_id}|${r.location_id}`))
  await supabase.from('elements_stock_txns').delete()
    .eq('org_id', orgId).eq('ref_type', 'invoice').eq('ref_id', invoiceId).eq('txn_type', 'consumption')
  if (clean.length) {
    const rows = clean.map((l) => ({
      org_id: orgId, item_id: l.item_id, location_id, txn_type: 'consumption',
      qty_delta: -Math.abs(l.qty), unit_cost: l.unit_cost,
      ref_type: 'invoice', ref_id: invoiceId, reason_code: 'parts_used',
    }))
    const { error } = await supabase.from('elements_stock_txns').insert(rows)
    if (error) return { error }
    clean.forEach((l) => affected.add(`${l.item_id}|${location_id}`))
  }
  for (const key of affected) {
    const [item_id, loc] = key.split('|')
    await recomputeLevel(orgId, item_id, loc)
  }
  return { count: clean.length }
}

// Recent invoices for the Parts Used screen (newest first).
export async function listRecentInvoices(orgId, limit = 120) {
  const { data: invs } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, job_id, bills_to_customer_id, created_at')
    .eq('org_id', orgId).eq('kind', 'invoice').is('deleted_at', null)
    .order('invoice_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  const list = invs || []
  const custIds = [...new Set(list.map((i) => i.bills_to_customer_id).filter(Boolean))]
  const jobIds = [...new Set(list.map((i) => i.job_id).filter(Boolean))]
  const custById = {}
  if (custIds.length) {
    const { data: cs } = await supabase.from('customers')
      .select('id, display_name, company, first_name, last_name').in('id', custIds)
    ;(cs || []).forEach((c) => {
      custById[c.id] = c.display_name || c.company || [c.first_name, c.last_name].filter(Boolean).join(' ') || '—'
    })
  }
  const jobById = {}
  if (jobIds.length) {
    const { data: js } = await supabase.from('jobs').select('id, job_number').in('id', jobIds)
    ;(js || []).forEach((j) => { jobById[j.id] = j.job_number })
  }
  return list.map((i) => ({
    ...i,
    customer_name: i.bills_to_customer_id ? (custById[i.bills_to_customer_id] || '—') : '—',
    job_number: i.job_id ? (jobById[i.job_id] || null) : null,
  }))
}

// ---- Par levels & replenishment -------------------------------------------
// reorder_point (min) and max_level (order-up-to / par) live per item+location
// on elements_stock_levels. Setting them upserts the level row so pars can be
// set even before any stock has moved.
export async function setLevelPar(orgId, itemId, locationId, patch) {
  const { data: existing } = await supabase
    .from('elements_stock_levels').select('id')
    .eq('org_id', orgId).eq('item_id', itemId).eq('location_id', locationId).maybeSingle()
  if (existing) return supabase.from('elements_stock_levels').update(patch).eq('id', existing.id)
  return supabase.from('elements_stock_levels').insert({ org_id: orgId, item_id: itemId, location_id: locationId, ...patch })
}

// Every location's items at/below their reorder point, with a suggested top-up
// to max_level (or back to reorder if no max is set). Newest sort by location
// then item. Purely par-driven: rows without a positive reorder_point are skipped.
export async function listReplenishment(orgId) {
  const { data } = await supabase
    .from('elements_stock_levels')
    .select('item_id, location_id, on_hand, reorder_point, max_level, item:elements_items(id, description, category, last_cost, standard_cost, stock_type), location:elements_locations(id, name, type, is_active)')
    .eq('org_id', orgId)
  return (data || [])
    .filter((r) => r.location && r.location.is_active !== false)
    // Special-order parts are bought per-job, not stocked — keep them out of reorder suggestions.
    .filter((r) => (r.item?.stock_type || 'stock') !== 'special_order')
    .filter((r) => r.reorder_point != null && Number(r.reorder_point) > 0 && Number(r.on_hand || 0) <= Number(r.reorder_point))
    .map((r) => {
      const target = r.max_level != null ? Number(r.max_level) : Number(r.reorder_point)
      return {
        item_id: r.item_id, location_id: r.location_id, item: r.item || null, location: r.location || null,
        on_hand: Number(r.on_hand || 0), reorder: Number(r.reorder_point),
        max: r.max_level != null ? Number(r.max_level) : null,
        suggest: Math.max(0, target - Number(r.on_hand || 0)),
      }
    })
    .sort((a, b) => (a.location?.name || '').localeCompare(b.location?.name || '') || (a.item?.description || '').localeCompare(b.item?.description || ''))
}

// ---- Purchasing: vendors, purchase orders & receiving ---------------------
// Reuses the shared `vendors` master. A PO is drafted, marked ordered, then
// received against — receiving writes normal receipt rows into the ledger
// (ref_type='po'), so on-hand and costs flow through the same path as manual
// receiving. Cost updates keep both last_cost and a weighted avg_cost.

export async function listVendors(orgId) {
  const { data } = await supabase.from('vendors')
    .select('id, name').eq('org_id', orgId).eq('is_active', true).order('name')
  return data || []
}

// PO list with vendor/location names and received progress.
export async function listPurchaseOrders(orgId) {
  const { data } = await supabase.from('elements_purchase_orders')
    .select('id, po_number, job_name, status, notes, ordered_at, expected_at, created_at, received_at, vendor:vendors(name), location:elements_locations(name), lines:elements_po_lines(qty_ordered, qty_received, unit_cost, item:elements_items(description))')
    .eq('org_id', orgId).order('created_at', { ascending: false })
  return (data || []).map((po) => {
    const lines = po.lines || []
    return {
      ...po,
      lineCount: lines.length,
      ordered: lines.reduce((s, l) => s + Number(l.qty_ordered || 0), 0),
      received: lines.reduce((s, l) => s + Number(l.qty_received || 0), 0),
      value: lines.reduce((s, l) => s + Number(l.qty_ordered || 0) * Number(l.unit_cost || 0), 0),
      partsText: lines.map((l) => l.item?.description || '').join(' '),
    }
  })
}

export async function getPurchaseOrder(orgId, poId) {
  const { data: po } = await supabase.from('elements_purchase_orders')
    .select('*, vendor:vendors(id, name), location:elements_locations(id, name, type)')
    .eq('org_id', orgId).eq('id', poId).maybeSingle()
  if (!po) return null
  const { data: lines } = await supabase.from('elements_po_lines')
    .select('*, item:elements_items(id, description, category, last_cost, standard_cost)')
    .eq('org_id', orgId).eq('po_id', poId).order('created_at')
  return { ...po, lines: lines || [] }
}

export async function createPurchaseOrder(orgId, { vendor_id, location_id, notes, expected_at, job_name, lines }) {
  // Every PO gets the next sequential number from the per-org counter
  // (elements_alloc_po_number is atomic, so numbers never collide).
  let num = null
  const { data: alloc } = await supabase.rpc('elements_alloc_po_number', { p_org: orgId })
  if (alloc) num = alloc
  if (!num) num = `PO-${Date.now().toString().slice(-6)}` // fallback if the counter is somehow unavailable
  const { data: po, error } = await supabase.from('elements_purchase_orders')
    .insert({ org_id: orgId, vendor_id: vendor_id || null, location_id: location_id || null, notes: notes || null, expected_at: expected_at || null, po_number: num, job_name: (job_name && job_name.trim()) || null, status: 'draft' })
    .select().single()
  if (error) return { error }
  const clean = (lines || [])
    .map((l) => ({ item_id: l.item_id, description: l.description || null, qty_ordered: Number(l.qty_ordered) || 0, unit_cost: (l.unit_cost === '' || l.unit_cost == null) ? null : Number(l.unit_cost) }))
    .filter((l) => l.item_id && l.qty_ordered > 0)
  if (clean.length) {
    const { error: le } = await supabase.from('elements_po_lines').insert(clean.map((l) => ({ org_id: orgId, po_id: po.id, ...l })))
    if (le) return { error: le, po }
  }
  return { po }
}

export async function updatePurchaseOrder(orgId, poId, patch) {
  return supabase.from('elements_purchase_orders').update(patch).eq('org_id', orgId).eq('id', poId)
}

// PO numbering settings — the next number the counter will assign. New
// subscribers importing history from another system can set this forward so
// their sequence continues where the old system left off.
export async function getPoSettings(orgId) {
  const { data } = await supabase.from('elements_po_counters')
    .select('next_number, prefix').eq('org_id', orgId).maybeSingle()
  return data || { next_number: 1001, prefix: 'PO-' }
}

export async function setPoNextNumber(orgId, nextNumber) {
  const n = Math.max(1, parseInt(nextNumber, 10) || 1)
  return supabase.from('elements_po_counters')
    .upsert({ org_id: orgId, next_number: n, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
}

export async function addPOLine(orgId, poId, line) {
  return supabase.from('elements_po_lines').insert({
    org_id: orgId, po_id: poId, item_id: line.item_id, description: line.description || null,
    qty_ordered: Number(line.qty_ordered) || 0, unit_cost: (line.unit_cost === '' || line.unit_cost == null) ? null : Number(line.unit_cost),
  }).select().single()
}

export async function deletePOLine(lineId) {
  return supabase.from('elements_po_lines').delete().eq('id', lineId)
}

// Permanently delete a purchase order and its lines. Only safe for a PO that
// has never received stock (drafts) — receiving writes ledger rows that would
// be orphaned otherwise, so the UI restricts this to draft POs.
export async function deletePurchaseOrder(orgId, poId) {
  await supabase.from('elements_po_lines').delete().eq('org_id', orgId).eq('po_id', poId)
  return supabase.from('elements_purchase_orders').delete().eq('org_id', orgId).eq('id', poId)
}

// ============================================================================
// P4 · Vendor invoices (Accounts Payable) — capture a vendor bill, 3-way match
// it against its PO + receipts, stage it for payment, and (optionally) receive
// the matched goods into stock. The AI extraction reuses the invoice-extract
// edge function; the original file is kept in the private 'vendor-invoices'
// Storage bucket for the record.
// ============================================================================
const numOrNull = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v))

// Run a vendor document (PDF/photo, base64) through the AI extractor.
export async function extractInvoiceFile(fileBase64, mediaType) {
  const { data, error } = await supabase.functions.invoke('invoice-extract', { body: { fileBase64, mediaType } })
  if (error) return { error }
  if (data?.error) return { error: { message: data.error } }
  return { data }
}

export async function createVendor(orgId, name) {
  return supabase.from('vendors').insert({ org_id: orgId, name: (name || '').trim(), is_active: true }).select('id, name').single()
}

// Store the original invoice file under {org_id}/{invoice_id}/... and return its path.
export async function uploadInvoiceFile(orgId, invoiceId, file) {
  const safe = (file.name || 'invoice').replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${orgId}/${invoiceId}/${Date.now()}_${safe}`
  const { error } = await supabase.storage.from('vendor-invoices')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true })
  if (error) return { error }
  return { path }
}
export async function getInvoiceFileUrl(path) {
  if (!path) return null
  const { data } = await supabase.storage.from('vendor-invoices').createSignedUrl(path, 3600)
  return data?.signedUrl || null
}

export async function listVendorInvoices(orgId) {
  const { data } = await supabase.from('elements_vendor_invoices')
    .select('id, vendor_id, po_id, doc_type, invoice_number, invoice_date, due_date, total, status, match_status, created_at, vendor:vendors(name), po:elements_purchase_orders(po_number, job_name)')
    .eq('org_id', orgId).order('created_at', { ascending: false })
  return data || []
}

export async function getVendorInvoice(orgId, id) {
  const { data: inv } = await supabase.from('elements_vendor_invoices')
    .select('*, vendor:vendors(id, name), po:elements_purchase_orders(id, po_number, job_name, status, location_id)')
    .eq('org_id', orgId).eq('id', id).maybeSingle()
  if (!inv) return null
  const { data: lines } = await supabase.from('elements_vendor_invoice_lines')
    .select('*, item:elements_items(id, description, sku)').eq('org_id', orgId).eq('invoice_id', id).order('created_at')
  let poLines = []
  if (inv.po_id) {
    const { data: pl } = await supabase.from('elements_po_lines')
      .select('id, item_id, description, qty_ordered, qty_received, unit_cost, item:elements_items(description, sku)')
      .eq('po_id', inv.po_id)
    poLines = pl || []
  }
  return { ...inv, lines: lines || [], poLines }
}

// Candidate POs to match a bill to: this vendor's, most recent first.
export async function findPurchaseOrdersForVendor(orgId, vendorId) {
  let q = supabase.from('elements_purchase_orders')
    .select('id, po_number, job_name, status, vendor_id, created_at')
    .eq('org_id', orgId).in('status', ['ordered', 'partial', 'received', 'draft'])
  if (vendorId) q = q.eq('vendor_id', vendorId)
  const { data } = await q.order('created_at', { ascending: false })
  return data || []
}

export async function createVendorInvoice(orgId, header, lines) {
  const { data: inv, error } = await supabase.from('elements_vendor_invoices')
    .insert({ org_id: orgId, ...header }).select().single()
  if (error) return { error }
  const clean = (lines || []).map((l) => ({
    org_id: orgId, invoice_id: inv.id, po_line_id: l.po_line_id || null, item_id: l.item_id || null,
    sku: l.sku || null, description: l.description || null, quantity: numOrNull(l.quantity),
    unit_of_measure: l.unit_of_measure || null, unit_cost: numOrNull(l.unit_cost),
    extended_cost: numOrNull(l.extended_cost), match_state: l.match_state || 'unmatched',
  }))
  if (clean.length) {
    const { error: le } = await supabase.from('elements_vendor_invoice_lines').insert(clean)
    if (le) return { error: le, invoice: inv }
  }
  return { invoice: inv }
}

export async function updateVendorInvoice(orgId, id, patch) {
  return supabase.from('elements_vendor_invoices').update(patch).eq('org_id', orgId).eq('id', id)
}
export async function updateVendorInvoiceLine(orgId, lineId, patch) {
  return supabase.from('elements_vendor_invoice_lines').update(patch).eq('org_id', orgId).eq('id', lineId)
}
export async function setVendorInvoiceStatus(orgId, id, status) {
  const patch = { status }
  if (status === 'staged') patch.staged_at = new Date().toISOString()
  return supabase.from('elements_vendor_invoices').update(patch).eq('org_id', orgId).eq('id', id)
}
export async function deleteVendorInvoice(orgId, id) {
  await supabase.from('elements_vendor_invoice_lines').delete().eq('org_id', orgId).eq('invoice_id', id)
  return supabase.from('elements_vendor_invoices').delete().eq('org_id', orgId).eq('id', id)
}

// ---- Vendor cross-reference (alias crosswalk) -----------------------------
// Each vendor's own SKU / description / brand for a part maps to ONE generic
// catalog item. Matching checks these aliases first (exact vendor SKU is a
// certain hit), and every confirmed capture writes them back — so the second
// invoice from a vendor auto-matches without guessing.
const skuNorm = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '')

export async function listItemVendors(orgId, vendorId) {
  if (!vendorId) return []
  const { data } = await supabase.from('elements_item_vendors')
    .select('item_id, vendor_sku, sku_norm, vendor_description, last_cost')
    .eq('org_id', orgId).eq('vendor_id', vendorId)
  return data || []
}

// Remember confirmed line→item mappings for this vendor. lines: [{ item_id,
// vendor_sku, vendor_description, last_cost }]. Exact-SKU aliases upsert on
// (org, vendor, sku_norm); description-only aliases dedupe by vendor+item+desc.
export async function learnAliases(orgId, vendorId, lines) {
  if (!vendorId || vendorId === '__new__') return
  for (const l of lines || []) {
    if (!l.item_id) continue
    const sn = skuNorm(l.vendor_sku)
    const payload = {
      org_id: orgId, vendor_id: vendorId, item_id: l.item_id,
      vendor_sku: l.vendor_sku || null, sku_norm: sn || null,
      vendor_description: l.vendor_description || null,
      last_cost: numOrNull(l.last_cost), last_seen_at: new Date().toISOString(),
    }
    if (sn) {
      await supabase.from('elements_item_vendors').upsert(payload, { onConflict: 'org_id,vendor_id,sku_norm' })
    } else if (l.vendor_description) {
      const { data: ex } = await supabase.from('elements_item_vendors').select('id')
        .eq('org_id', orgId).eq('vendor_id', vendorId).eq('item_id', l.item_id).is('sku_norm', null)
        .ilike('vendor_description', l.vendor_description).limit(1)
      if (ex && ex[0]) await supabase.from('elements_item_vendors').update(payload).eq('id', ex[0].id)
      else await supabase.from('elements_item_vendors').insert(payload)
    }
  }
}

// Weighted moving average across all locations, refreshed on each receipt.
async function updateItemCostOnReceipt(orgId, itemId, qty, unitCost) {
  const { data: it } = await supabase.from('elements_items').select('avg_cost').eq('id', itemId).maybeSingle()
  const { data: levels } = await supabase.from('elements_stock_levels').select('on_hand').eq('org_id', orgId).eq('item_id', itemId)
  const prevQty = Math.max(0, (levels || []).reduce((s, l) => s + Number(l.on_hand || 0), 0))
  const prevAvg = it && it.avg_cost != null ? Number(it.avg_cost) : unitCost
  const newAvg = (prevQty + qty) > 0 ? ((prevQty * prevAvg) + qty * unitCost) / (prevQty + qty) : unitCost
  await supabase.from('elements_items').update({ last_cost: unitCost, avg_cost: Number(newAvg.toFixed(4)) }).eq('id', itemId)
}

// Receive quantities against a PO. receipts: [{ line_id, item_id, qty, unit_cost }].
// Writes receipt rows into the PO's deliver-to location, bumps each line's
// qty_received, updates item costs, recomputes on-hand, and advances PO status.
export async function receivePO(orgId, poId, receipts) {
  const { data: po } = await supabase.from('elements_purchase_orders')
    .select('id, location_id').eq('org_id', orgId).eq('id', poId).maybeSingle()
  if (!po) return { error: { message: 'Purchase order not found.' } }
  if (!po.location_id) return { error: { message: 'Set a deliver-to location on this PO before receiving.' } }
  const clean = (receipts || [])
    .map((r) => ({ line_id: r.line_id, item_id: r.item_id, qty: Number(r.qty), unit_cost: (r.unit_cost === '' || r.unit_cost == null) ? null : Number(r.unit_cost) }))
    .filter((r) => r.item_id && r.qty > 0)
  if (!clean.length) return { error: { message: 'Enter a quantity to receive.' } }
  for (const r of clean) {
    const { error } = await supabase.from('elements_stock_txns').insert({
      org_id: orgId, item_id: r.item_id, location_id: po.location_id, txn_type: 'receipt', qty_delta: r.qty,
      unit_cost: r.unit_cost, ref_type: 'po', ref_id: poId, reason_code: 'po_receipt',
    })
    if (error) return { error }
    if (r.unit_cost != null) await updateItemCostOnReceipt(orgId, r.item_id, r.qty, r.unit_cost)
    await recomputeLevel(orgId, r.item_id, po.location_id)
    if (r.line_id) {
      const { data: ln } = await supabase.from('elements_po_lines').select('qty_received').eq('id', r.line_id).maybeSingle()
      await supabase.from('elements_po_lines').update({ qty_received: (ln ? Number(ln.qty_received || 0) : 0) + r.qty }).eq('id', r.line_id)
    }
  }
  const { data: lines } = await supabase.from('elements_po_lines').select('qty_ordered, qty_received').eq('po_id', poId)
  const rows = lines || []
  const allDone = rows.length > 0 && rows.every((l) => Number(l.qty_received || 0) >= Number(l.qty_ordered || 0))
  const anyRecv = rows.some((l) => Number(l.qty_received || 0) > 0)
  const status = allDone ? 'received' : (anyRecv ? 'partial' : null)
  if (status) {
    const patch = { status }
    if (status === 'received') patch.received_at = new Date().toISOString()
    await supabase.from('elements_purchase_orders').update(patch).eq('id', poId)
  }
  return { count: clean.length, status }
}

// Correct the received quantity on PO lines after the fact. For each changed
// line, writes an adjustment to the ledger for the difference (positive or
// negative), sets the line's qty_received to the corrected total, recomputes
// on-hand, and re-evaluates PO status. Costs are left as-is — this is a quantity
// correction, not a new purchase.
export async function adjustReceived(orgId, poId, adjustments) {
  const { data: po } = await supabase.from('elements_purchase_orders')
    .select('id, location_id, status').eq('org_id', orgId).eq('id', poId).maybeSingle()
  if (!po) return { error: { message: 'Purchase order not found.' } }
  if (!po.location_id) return { error: { message: 'This PO has no deliver-to location.' } }
  const clean = (adjustments || [])
    .map((a) => ({ line_id: a.line_id, item_id: a.item_id, new_received: Number(a.new_received) }))
    .filter((a) => a.line_id && a.item_id && !isNaN(a.new_received) && a.new_received >= 0)
  let changed = 0
  for (const a of clean) {
    const { data: ln } = await supabase.from('elements_po_lines').select('qty_received, unit_cost').eq('id', a.line_id).maybeSingle()
    const cur = ln ? Number(ln.qty_received || 0) : 0
    const delta = a.new_received - cur
    if (delta === 0) continue
    const { error } = await supabase.from('elements_stock_txns').insert({
      org_id: orgId, item_id: a.item_id, location_id: po.location_id, txn_type: 'adjustment',
      qty_delta: delta, unit_cost: ln?.unit_cost ?? null, ref_type: 'po', ref_id: poId, reason_code: 'po_adjust',
    })
    if (error) return { error }
    await recomputeLevel(orgId, a.item_id, po.location_id)
    await supabase.from('elements_po_lines').update({ qty_received: a.new_received }).eq('id', a.line_id)
    changed += 1
  }
  const { data: lines } = await supabase.from('elements_po_lines').select('qty_ordered, qty_received').eq('po_id', poId)
  const rows = lines || []
  const allDone = rows.length > 0 && rows.every((l) => Number(l.qty_received || 0) >= Number(l.qty_ordered || 0))
  const anyRecv = rows.some((l) => Number(l.qty_received || 0) > 0)
  const status = allDone ? 'received' : (anyRecv ? 'partial' : 'ordered')
  if (po.status !== 'draft' && po.status !== 'cancelled') {
    await supabase.from('elements_purchase_orders').update({ status }).eq('id', poId)
  }
  return { count: changed, status }
}

// ---- Alias suggestion tool (seed the crosswalk from purchase history) ------
// Vendors we have historical offerings for, with how many aliases are already
// learned. Drives the vendor picker on the Vendor Cross-Reference screen.
export async function listAliasVendorStats() {
  const { data, error } = await supabase.rpc('elements_alias_vendor_stats')
  if (error) return []
  return data || []
}

// Ask Quincy to propose vendor part -> catalog item matches from purchase
// history. Returns { items: [{ item_*, candidates[], ai_pick, confidence,
// reason }], stats }. The user confirms picks before anything is saved.
export async function suggestAliases(vendorId) {
  const { data, error } = await supabase.functions.invoke('suggest-aliases', { body: { vendorId } })
  if (error) return { error }
  if (data?.error) return { error: { message: data.error } }
  return { data }
}

// Existing learned aliases for a vendor, with the catalog item they map to.
export async function listVendorAliasesDetailed(orgId, vendorId) {
  const { data } = await supabase.from('elements_item_vendors')
    .select('id, item_id, vendor_sku, vendor_description, last_cost, item:elements_items(description, sku, category)')
    .eq('org_id', orgId).eq('vendor_id', vendorId).order('created_at', { ascending: false })
  return data || []
}

export async function deleteItemVendor(id) {
  return supabase.from('elements_item_vendors').delete().eq('id', id)
}

// ---- Cycle counts (P5a) ---------------------------------------------------
// A count session snapshots expected on-hand for a location, captures the
// physical count, and on posting writes 'count' ledger rows to bring on-hand
// to the counted value. Blind counts hide the book qty until the review step.
export async function listCycleCounts(orgId) {
  const { data } = await supabase.from('elements_cycle_counts')
    .select('id, status, scope, category, blind, note, created_at, posted_at, adjustments_count, net_qty_delta, location:elements_locations(name, type), lines:elements_cycle_count_lines(id, counted_qty)')
    .eq('org_id', orgId).order('created_at', { ascending: false })
  return (data || []).map((s) => {
    const lines = s.lines || []
    return { ...s, lineCount: lines.length, countedCount: lines.filter((l) => l.counted_qty != null).length }
  })
}

// Start a count for a location. Seeds one line per item that has a stock level
// at that location (expected = current on-hand). scope 'category' narrows to a
// single catalog category; 'manual' seeds nothing (add items by hand).
export async function createCycleCount(orgId, { location_id, blind = true, scope = 'all', category = null, note = null, createdBy = null }) {
  if (!location_id) return { error: { message: 'Pick a location to count.' } }
  const { data: session, error } = await supabase.from('elements_cycle_counts')
    .insert({ org_id: orgId, location_id, blind: !!blind, scope, category: scope === 'category' ? category : null, note: note || null, created_by: createdBy || null, status: 'open' })
    .select().single()
  if (error) return { error }
  if (scope !== 'manual') {
    const { data: levels } = await supabase.from('elements_stock_levels')
      .select('item_id, on_hand, item:elements_items(category, is_active)')
      .eq('org_id', orgId).eq('location_id', location_id)
    let rows = (levels || []).filter((l) => l.item && l.item.is_active !== false)
    if (scope === 'category' && category) rows = rows.filter((l) => (l.item?.category || '') === category)
    const lines = rows.map((l) => ({ org_id: orgId, count_id: session.id, item_id: l.item_id, expected_qty: Number(l.on_hand || 0) }))
    if (lines.length) await supabase.from('elements_cycle_count_lines').insert(lines)
  }
  return { session }
}

// Session header + lines (with item info) + current on-hand per line, so the UI
// can show live variance and post against the true current quantity.
export async function getCycleCount(orgId, id) {
  const { data: s } = await supabase.from('elements_cycle_counts')
    .select('*, location:elements_locations(id, name, type)')
    .eq('org_id', orgId).eq('id', id).maybeSingle()
  if (!s) return null
  const { data: lines } = await supabase.from('elements_cycle_count_lines')
    .select('*, item:elements_items(id, sku, description, category)')
    .eq('org_id', orgId).eq('count_id', id)
  const { data: levels } = await supabase.from('elements_stock_levels')
    .select('item_id, on_hand, bin').eq('org_id', orgId).eq('location_id', s.location_id)
  const cur = {}; (levels || []).forEach((l) => { cur[l.item_id] = { on_hand: Number(l.on_hand || 0), bin: l.bin || null } })
  const withCur = (lines || []).map((l) => ({ ...l, current_on_hand: cur[l.item_id]?.on_hand ?? 0, bin: cur[l.item_id]?.bin || null }))
    .sort((a, b) => (a.item?.category || '').localeCompare(b.item?.category || '') || (a.item?.description || '').localeCompare(b.item?.description || ''))
  return { ...s, lines: withCur }
}

export async function setCycleCountLine(orgId, lineId, countedQty) {
  const v = (countedQty === '' || countedQty == null) ? null : Number(countedQty)
  return supabase.from('elements_cycle_count_lines').update({ counted_qty: v }).eq('org_id', orgId).eq('id', lineId)
}

// Add an item not seeded into the session (found on the shelf/truck).
export async function addCycleCountItem(orgId, countId, locationId, itemId) {
  const { data: lvl } = await supabase.from('elements_stock_levels')
    .select('on_hand').eq('org_id', orgId).eq('location_id', locationId).eq('item_id', itemId).maybeSingle()
  return supabase.from('elements_cycle_count_lines')
    .insert({ org_id: orgId, count_id: countId, item_id: itemId, expected_qty: Number(lvl?.on_hand || 0) })
    .select('*, item:elements_items(id, sku, description, category)').single()
}

export async function deleteCycleCountLine(orgId, lineId) {
  return supabase.from('elements_cycle_count_lines').delete().eq('org_id', orgId).eq('id', lineId)
}

// Post the count: for each counted line, adjust on-hand to the counted value by
// writing a 'count' ledger row for the delta vs the CURRENT on-hand (so any
// movement during the count is respected), then recompute the cached level.
export async function postCycleCount(orgId, countId, postedBy = null) {
  const { data: s } = await supabase.from('elements_cycle_counts')
    .select('id, location_id, status').eq('org_id', orgId).eq('id', countId).maybeSingle()
  if (!s) return { error: { message: 'Count not found.' } }
  if (s.status !== 'open') return { error: { message: 'This count has already been ' + s.status + '.' } }
  const { data: lines } = await supabase.from('elements_cycle_count_lines')
    .select('id, item_id, counted_qty').eq('org_id', orgId).eq('count_id', countId)
  const counted = (lines || []).filter((l) => l.counted_qty != null)
  if (!counted.length) return { error: { message: 'Enter at least one counted quantity before posting.' } }
  let adjustments = 0, net = 0
  for (const l of counted) {
    const { data: lvl } = await supabase.from('elements_stock_levels')
      .select('on_hand').eq('org_id', orgId).eq('location_id', s.location_id).eq('item_id', l.item_id).maybeSingle()
    const current = Number(lvl?.on_hand || 0)
    const delta = Number(l.counted_qty) - current
    if (delta !== 0) {
      const { error } = await supabase.from('elements_stock_txns').insert({
        org_id: orgId, item_id: l.item_id, location_id: s.location_id, txn_type: 'count',
        qty_delta: delta, ref_type: 'cycle_count', ref_id: countId, reason_code: 'cycle_count', created_by: postedBy || null,
      })
      if (error) return { error }
      await recomputeLevel(orgId, l.item_id, s.location_id)
      adjustments += 1; net += delta
    }
    await supabase.from('elements_cycle_count_lines').update({ posted_delta: delta }).eq('id', l.id)
  }
  await supabase.from('elements_cycle_counts')
    .update({ status: 'posted', posted_at: new Date().toISOString(), posted_by: postedBy || null, adjustments_count: adjustments, net_qty_delta: net })
    .eq('org_id', orgId).eq('id', countId)
  return { adjustments, net, counted: counted.length }
}

export async function cancelCycleCount(orgId, countId) {
  return supabase.from('elements_cycle_counts').update({ status: 'cancelled' }).eq('org_id', orgId).eq('id', countId).eq('status', 'open')
}

export async function deleteCycleCount(orgId, countId) {
  await supabase.from('elements_cycle_count_lines').delete().eq('org_id', orgId).eq('count_id', countId)
  return supabase.from('elements_cycle_counts').delete().eq('org_id', orgId).eq('id', countId)
}

// ---- Special orders (P5b) -------------------------------------------------
// A tracking board for per-job parts that aren't stocked. Fully decoupled from
// the stock ledger — these go straight to the customer's job, never into on-hand.
// Lifecycle: requested -> ordered -> received -> ready -> closed (+ cancelled).
export async function listSpecialOrders(orgId) {
  const { data } = await supabase.from('elements_special_orders')
    .select('*, customer:customers(id, display_name, company, first_name, last_name), item:elements_items(id, description), vendor:vendors(id, name)')
    .eq('org_id', orgId).order('created_at', { ascending: false })
  return (data || []).map((o) => ({
    ...o,
    customer_label: o.customer_name || (o.customer ? (o.customer.display_name || o.customer.company || [o.customer.first_name, o.customer.last_name].filter(Boolean).join(' ')) : '') || '',
    vendor_label: o.vendor_name || o.vendor?.name || '',
  }))
}

// Typeahead over the customer book (1000s of rows) for linking a special order.
export async function searchCustomers(orgId, term) {
  const t = (term || '').trim()
  if (t.length < 2) return []
  const like = `%${t}%`
  const { data } = await supabase.from('customers')
    .select('id, display_name, company, first_name, last_name')
    .eq('org_id', orgId)
    .or(`display_name.ilike.${like},company.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`)
    .limit(20)
  return (data || []).map((c) => ({ id: c.id, name: c.display_name || c.company || [c.first_name, c.last_name].filter(Boolean).join(' ') || '(unnamed)' }))
}

export async function createSpecialOrder(orgId, payload) {
  const row = {
    org_id: orgId,
    status: 'requested',
    customer_id: payload.customer_id || null,
    customer_name: (payload.customer_name || '').trim() || null,
    job_ref: (payload.job_ref || '').trim() || null,
    item_id: payload.item_id || null,
    description: (payload.description || '').trim(),
    quantity: payload.quantity === '' || payload.quantity == null ? 1 : Number(payload.quantity),
    unit_cost: payload.unit_cost === '' || payload.unit_cost == null ? null : Number(payload.unit_cost),
    vendor_id: payload.vendor_id || null,
    vendor_name: (payload.vendor_name || '').trim() || null,
    po_ref: (payload.po_ref || '').trim() || null,
    needed_by: payload.needed_by || null,
    notes: (payload.notes || '').trim() || null,
    created_by: payload.created_by || null,
  }
  if (!row.description) return { error: { message: 'Describe the part being ordered.' } }
  return supabase.from('elements_special_orders').insert(row).select().single()
}

export async function updateSpecialOrder(orgId, id, patch) {
  const clean = { ...patch }
  if ('quantity' in clean) clean.quantity = clean.quantity === '' || clean.quantity == null ? 1 : Number(clean.quantity)
  if ('unit_cost' in clean) clean.unit_cost = clean.unit_cost === '' || clean.unit_cost == null ? null : Number(clean.unit_cost)
  return supabase.from('elements_special_orders').update(clean).eq('org_id', orgId).eq('id', id)
}

// Advance the lifecycle and stamp the matching timestamp.
export async function setSpecialOrderStatus(orgId, id, status) {
  const patch = { status }
  const now = new Date().toISOString()
  if (status === 'ordered') patch.ordered_at = now
  else if (status === 'received') patch.received_at = now
  else if (status === 'ready') patch.ready_at = now
  else if (status === 'closed') patch.closed_at = now
  return supabase.from('elements_special_orders').update(patch).eq('org_id', orgId).eq('id', id)
}

export async function deleteSpecialOrder(orgId, id) {
  return supabase.from('elements_special_orders').delete().eq('org_id', orgId).eq('id', id)
}

// ---- Anomaly detection (P5c) ----------------------------------------------
// Live diagnostic over the ledger, levels, costs and cycle counts. Returns
// structured flags; the UI composes the sentence. Flags clear when fixed.
export async function listAnomalies() {
  const { data, error } = await supabase.rpc('elements_anomalies')
  if (error) return []
  return data || []
}

// ---- Job costing (P5d) ----------------------------------------------------
// Per-invoice actual material cost (from recorded parts-used consumption) vs the
// billed amount. Labor is not included — this is material spend and margin.
export async function jobCosting(days = 180) {
  const { data, error } = await supabase.rpc('elements_job_costing', { p_days: days })
  if (error) return []
  return data || []
}

// ---- Demand forecast (P5e) ------------------------------------------------
// Trailing consumption per item; the UI derives usage rate, days of cover, a
// projected run-out, and a suggested order qty. used_30 flags rising demand.
export async function forecast(days = 90) {
  const { data, error } = await supabase.rpc('elements_forecast', { p_days: days })
  if (error) return []
  return data || []
}

// ---- Inventory valuation (report) -----------------------------------------
// Current value of stock on hand, one row per item+location, valued at the
// item's cost (average, else last, else standard). Rows with no cost come back
// with a null value so the UI can flag them as "not valued".
export async function valuation() {
  const { data, error } = await supabase.rpc('elements_valuation')
  if (error) return []
  return data || []
}

// ---- Inventory variance (report) ------------------------------------------
// Count variance (posted cycle-count adjustments vs. expected) plus purchase
// variance (invoice lines that billed a different price/qty than their PO),
// unified with a `kind` discriminator and each valued in dollars.
export async function variance() {
  const { data, error } = await supabase.rpc('elements_variance')
  if (error) return []
  return data || []
}
