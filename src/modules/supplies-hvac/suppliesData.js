// Supplies / expendables · data layer
// Things bought regularly but NOT inventoried — copy paper, tech tape, zip ties,
// gallon chemicals, fuses, etc. A lean catalog (no stock counts), a checkable
// reorder/shopping list, and a simple purchase log so spend can be tracked.
import { supabase } from '../../utils/supabase'

export const SUPPLY_CATEGORIES = [
  'Office', 'Shop', 'Chemicals', 'Consumables', 'Safety', 'Fasteners', 'Cleaning', 'Other',
]
export const SUPPLY_UNITS = ['each', 'box', 'case', 'pack', 'roll', 'gallon', 'quart', 'bottle', 'bag', 'tube', 'pair']

const num = (x) => { if (x == null || x === '') return null; const n = Number(x); return isNaN(n) ? null : n }
const today = () => new Date().toISOString().slice(0, 10)

// ---- Catalog ---------------------------------------------------------------
export async function listSupplies(orgId, { includeRetired = false } = {}) {
  let q = supabase.from('supplies_catalog').select('*').eq('org_id', orgId)
  if (!includeRetired) q = q.is('deleted_at', null)
  const { data } = await q.order('name')
  return data || []
}
export async function addSupply(orgId, row) {
  return supabase.from('supplies_catalog').insert({
    org_id: orgId, name: (row.name || '').trim(), category: row.category || null,
    unit: row.unit || null, typical_vendor: row.typical_vendor || null,
    last_price: num(row.last_price), notes: row.notes || null,
  }).select().single()
}
export async function updateSupply(id, patch) {
  const p = { ...patch }
  if ('last_price' in p) p.last_price = num(p.last_price)
  return supabase.from('supplies_catalog').update(p).eq('id', id)
}
export async function retireSupply(id) {
  return supabase.from('supplies_catalog').update({ deleted_at: new Date().toISOString(), needs_reorder: false }).eq('id', id)
}

// ---- Reorder / shopping list ----------------------------------------------
export async function listReorder(orgId) {
  const { data } = await supabase.from('supplies_catalog').select('*')
    .eq('org_id', orgId).is('deleted_at', null).eq('needs_reorder', true)
    .order('flagged_at', { ascending: true })
  return data || []
}
export async function setReorder(orgId, id, on, { qty = null, note = null } = {}) {
  return supabase.from('supplies_catalog').update({
    needs_reorder: !!on,
    flagged_at: on ? new Date().toISOString() : null,
    reorder_qty: on ? num(qty) : null,
    reorder_note: on ? (note || null) : null,
  }).eq('id', id).eq('org_id', orgId)
}

// Mark a reorder-list item as bought: log the purchase, refresh last price, and
// clear it from the list. Logging the cost is optional — a check-off still works.
export async function markPurchased(orgId, supply, { qty, unitCost, vendor, date, notes } = {}) {
  const q = num(qty), uc = num(unitCost)
  const total = q != null && uc != null ? q * uc : null
  const { error: perr } = await supabase.from('supplies_purchases').insert({
    org_id: orgId, supply_id: supply.id, item_name: supply.name, category: supply.category || null,
    purchase_date: date || today(), qty: q, unit_cost: uc, total_cost: total,
    vendor: vendor || supply.typical_vendor || null, notes: notes || null,
  })
  if (perr) return { error: perr }
  const patch = { needs_reorder: false, flagged_at: null, reorder_qty: null, reorder_note: null }
  if (uc != null) patch.last_price = uc
  if (vendor) patch.typical_vendor = vendor
  return supabase.from('supplies_catalog').update(patch).eq('id', supply.id).eq('org_id', orgId)
}

// A standalone purchase (not tied to the reorder list) — e.g. logging a receipt.
export async function addPurchase(orgId, row) {
  const q = num(row.qty), uc = num(row.unit_cost)
  const total = num(row.total_cost) ?? (q != null && uc != null ? q * uc : null)
  return supabase.from('supplies_purchases').insert({
    org_id: orgId, supply_id: row.supply_id || null, item_name: row.item_name || null,
    category: row.category || null, purchase_date: row.purchase_date || today(),
    qty: q, unit_cost: uc, total_cost: total, vendor: row.vendor || null, notes: row.notes || null,
  }).select().single()
}

// ---- Purchases (spend) -----------------------------------------------------
export async function listPurchases(orgId, { sinceDays = null } = {}) {
  let q = supabase.from('supplies_purchases').select('*').eq('org_id', orgId)
  if (sinceDays) { const d = new Date(); d.setDate(d.getDate() - sinceDays); q = q.gte('purchase_date', d.toISOString().slice(0, 10)) }
  const { data } = await q.order('purchase_date', { ascending: false })
  return data || []
}

// ---- Purchase orders (order → receive) ------------------------------------
// Supplies POs draw from the SAME sequential counter as parts and tool POs
// (elements_alloc_po_number is atomic). No spend is logged until the PO is
// received; receiving writes a supplies_purchases row per received line and
// refreshes the catalog's last price.
export async function createSupplyOrder(orgId, { vendor, expected_date, notes, lines }, createdBy) {
  let poNum = null
  try { const { data: alloc } = await supabase.rpc('elements_alloc_po_number', { p_org: orgId }); if (alloc) poNum = alloc } catch (_e) { /* fall through */ }
  if (!poNum) poNum = `PO-${Date.now().toString().slice(-6)}`
  const clean = (lines || [])
    .map((l) => ({
      supply_id: l.supply_id || null,
      item_name: (l.item_name || '').trim() || null,
      category: l.category || null,
      unit: l.unit || null,
      quantity: num(l.quantity) || 1,
      unit_cost: num(l.unit_cost),
    }))
    .filter((l) => l.item_name || l.supply_id)
  const amount = clean.reduce((s, l) => s + (Number(l.unit_cost) || 0) * l.quantity, 0)
  const { data: order, error } = await supabase.from('supplies_orders').insert({
    org_id: orgId, po_number: poNum, vendor: vendor || null, status: 'ordered',
    order_date: today(), expected_date: expected_date || null,
    amount: amount || null, notes: notes || null, created_by: createdBy || null,
  }).select().single()
  if (error) return { error }
  if (clean.length) {
    const rows = clean.map((l) => ({ org_id: orgId, order_id: order.id, ...l }))
    const { error: le } = await supabase.from('supplies_order_lines').insert(rows)
    if (le) return { error: le, order }
    // Items now on order drop off the reorder list.
    const ids = clean.map((l) => l.supply_id).filter(Boolean)
    if (ids.length) await supabase.from('supplies_catalog').update({ needs_reorder: false, flagged_at: null, reorder_qty: null, reorder_note: null }).in('id', ids).eq('org_id', orgId)
  }
  return { order, po_number: poNum, lineCount: clean.length }
}

export async function listSupplyOrders(orgId, { includeClosed = false } = {}) {
  let q = supabase.from('supplies_orders').select('*').eq('org_id', orgId).is('deleted_at', null)
  if (!includeClosed) q = q.in('status', ['ordered', 'partial'])
  const { data } = await q.order('order_date', { ascending: false })
  return data || []
}
export async function listSupplyOrderLines(orgId, orderId) {
  const { data } = await supabase.from('supplies_order_lines').select('*').eq('org_id', orgId).eq('order_id', orderId).order('created_at')
  return data || []
}

// Receive some/all of a PO. `receipts` maps line id -> qty received now. Each
// received quantity is logged as spend and refreshes the catalog last price.
export async function receiveSupplyOrder(orgId, orderId, receipts) {
  const [lines, { data: order }] = await Promise.all([
    listSupplyOrderLines(orgId, orderId),
    supabase.from('supplies_orders').select('po_number, vendor').eq('id', orderId).maybeSingle().then((r) => r),
  ])
  const poNumber = order?.po_number || null
  const vendor = order?.vendor || null
  for (const l of lines) {
    const want = num(receipts?.[l.id]) || 0
    const remaining = (Number(l.quantity) || 0) - (Number(l.received_count) || 0)
    const n = Math.max(0, Math.min(want, remaining))
    if (n <= 0) continue
    const uc = num(l.unit_cost)
    await supabase.from('supplies_purchases').insert({
      org_id: orgId, supply_id: l.supply_id || null, item_name: l.item_name, category: l.category || null,
      purchase_date: today(), qty: n, unit_cost: uc, total_cost: uc != null ? uc * n : null,
      vendor, notes: poNumber ? `PO ${poNumber}` : null,
    })
    await supabase.from('supplies_order_lines').update({ received_count: (Number(l.received_count) || 0) + n }).eq('id', l.id)
    if (l.supply_id && uc != null) await supabase.from('supplies_catalog').update({ last_price: uc }).eq('id', l.supply_id).eq('org_id', orgId)
  }
  const after = await listSupplyOrderLines(orgId, orderId)
  const allDone = after.length > 0 && after.every((l) => (Number(l.received_count) || 0) >= (Number(l.quantity) || 0))
  const anyDone = after.some((l) => (Number(l.received_count) || 0) > 0)
  return supabase.from('supplies_orders').update({
    status: allDone ? 'received' : (anyDone ? 'partial' : 'ordered'),
    received_date: allDone ? today() : null,
  }).eq('id', orderId).eq('org_id', orgId)
}

export async function cancelSupplyOrder(orgId, orderId) {
  return supabase.from('supplies_orders').update({ status: 'canceled' }).eq('id', orderId).eq('org_id', orgId)
}

// Seed PO lines from whatever is currently on the reorder list.
export async function reorderSeedLines(orgId) {
  const rows = await listReorder(orgId)
  return rows.map((r) => ({
    supply_id: r.id, item_name: r.name, category: r.category || null, unit: r.unit || null,
    quantity: r.reorder_qty || 1, unit_cost: r.last_price ?? '',
  }))
}

// ---- Dashboard rollup ------------------------------------------------------
export async function suppliesDashboard(orgId) {
  const [items, reorder, purch, openOrders] = await Promise.all([
    listSupplies(orgId),
    listReorder(orgId),
    listPurchases(orgId, { sinceDays: 90 }),
    listSupplyOrders(orgId, { includeClosed: false }),
  ])
  const d30 = new Date(); d30.setDate(d30.getDate() - 30); const since30 = d30.toISOString().slice(0, 10)
  let spend30 = 0, spend90 = 0
  purch.forEach((p) => { const t = Number(p.total_cost) || 0; spend90 += t; if (p.purchase_date >= since30) spend30 += t })
  const r1 = (n) => Math.round(n * 100) / 100
  return {
    itemCount: items.length,
    reorderCount: reorder.length,
    reorderItems: reorder.map((r) => ({ id: r.id, name: r.name, qty: r.reorder_qty, vendor: r.typical_vendor, note: r.reorder_note })),
    spend30: r1(spend30), spend90: r1(spend90),
    openOrderCount: openOrders.length,
    openOrders: openOrders.map((o) => ({ po: o.po_number, vendor: o.vendor, status: o.status, expected: o.expected_date })),
    recentPurchases: purch.slice(0, 5).map((p) => ({ item: p.item_name, total: Number(p.total_cost) || 0, date: p.purchase_date, vendor: p.vendor })),
  }
}
