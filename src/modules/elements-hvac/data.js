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
