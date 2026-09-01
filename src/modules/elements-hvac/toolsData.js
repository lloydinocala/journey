// Tools Management · data layer
// Durable tools tracked like inventory: received by the shop, assigned to a
// truck/tech, inspected on-demand, and sent back to the shop for verified
// maintenance before being redeployed. Purchase date + cost are logged as plain
// data (bookkeeping handles depreciation elsewhere — no value math here).
import { supabase } from '../../utils/supabase'

// ---- Settings / entitlement ----------------------------------------------
export async function getToolsSettings(orgId) {
  const { data } = await supabase.from('tools_settings').select('*').eq('org_id', orgId).maybeSingle()
  return data || null
}
export async function upsertToolsSettings(orgId, patch) {
  const { data, error } = await supabase
    .from('tools_settings')
    .upsert({ org_id: orgId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
    .select().single()
  return { data, error }
}

// ---- Tools ----------------------------------------------------------------
export async function listTools(orgId, { includeRetired = false } = {}) {
  let q = supabase.from('tools').select('*').eq('org_id', orgId).is('deleted_at', null)
  if (!includeRetired) q = q.neq('status', 'retired')
  const { data } = await q.order('name').order('instance_no')
  return data || []
}

// Display label: identical names get "Reclaimer 1", "Reclaimer 2"; a unique name
// shows on its own. Pass the full list so we know which names are duplicated.
export function toolLabel(tool, allTools) {
  if (!tool) return ''
  const sameName = (allTools || []).filter(
    (t) => t.deleted_at == null && (t.name || '').trim().toLowerCase() === (tool.name || '').trim().toLowerCase(),
  )
  return sameName.length > 1 ? `${tool.name} ${tool.instance_no}` : tool.name
}

export async function addTool(orgId, row) {
  // instance_no = how many non-deleted tools already share this (case-insensitive) name, + 1
  const name = (row.name || '').trim()
  const { data: existing } = await supabase
    .from('tools').select('id, name').eq('org_id', orgId).is('deleted_at', null)
  const dupes = (existing || []).filter((t) => (t.name || '').trim().toLowerCase() === name.toLowerCase())
  const instance_no = dupes.length + 1
  const payload = { org_id: orgId, ...row, name, instance_no, status: 'in_shop', holder_type: 'shop', holder_id: null }
  const { data, error } = await supabase.from('tools').insert(payload).select().single()
  // Open the first (shop) assignment so the responsibility timeline starts here.
  if (!error && data) {
    await supabase.from('tool_assignments').insert({ org_id: orgId, tool_id: data.id, holder_type: 'shop', holder_id: null, note: 'Received by shop' })
  }
  return { data, error }
}

export async function updateTool(id, patch) {
  return supabase.from('tools').update(patch).eq('id', id)
}

export async function retireTool(id, reason) {
  return supabase.from('tools').update({
    status: 'retired', deleted_at: new Date().toISOString(),
    deleted_reason: reason || 'retired',
  }).eq('id', id)
}

// ---- Assignment (dated history, mirrors reassignVehicle) -------------------
export async function listToolAssignments(orgId, toolId = null) {
  let q = supabase.from('tool_assignments').select('*').eq('org_id', orgId)
  if (toolId) q = q.eq('tool_id', toolId)
  const { data } = await q.order('started_at', { ascending: false })
  return data || []
}

// Move a tool to shop / a truck / a tech. Closes the open assignment row and
// opens a new one, and syncs the tool's status + holder.
export async function assignTool(orgId, toolId, holderType, holderId, note) {
  const now = new Date().toISOString()
  const { data: open } = await supabase
    .from('tool_assignments').select('id, holder_type, holder_id')
    .eq('org_id', orgId).eq('tool_id', toolId).is('ended_at', null)
    .maybeSingle()
  const sameSpot = open && open.holder_type === holderType && (open.holder_id || null) === (holderId || null)
  if (!sameSpot) {
    if (open) await supabase.from('tool_assignments').update({ ended_at: now }).eq('id', open.id)
    await supabase.from('tool_assignments').insert({
      org_id: orgId, tool_id: toolId, holder_type: holderType, holder_id: holderId || null, note: note || null,
    })
  }
  const status = holderType === 'shop' ? 'in_shop' : 'assigned'
  return supabase.from('tools').update({ status, holder_type: holderType, holder_id: holderId || null }).eq('id', toolId)
}

// ---- Inspections (on-demand) ----------------------------------------------
export async function listToolInspections(orgId, toolId = null) {
  let q = supabase.from('tool_inspections').select('*').eq('org_id', orgId)
  if (toolId) q = q.eq('tool_id', toolId)
  const { data } = await q.order('inspected_at', { ascending: false })
  return data || []
}
export async function addInspection(orgId, row) {
  const { data, error } = await supabase.from('tool_inspections').insert({ org_id: orgId, ...row }).select().single()
  // A failing inspection flags the tool so it can't quietly redeploy.
  if (!error && row.needs_maintenance) {
    await supabase.from('tools').update({ needs_maintenance: true }).eq('id', row.tool_id)
  }
  return { data, error }
}

// ---- Maintenance (verified before redeploy) -------------------------------
export async function listToolMaintenance(orgId, { openOnly = false, toolId = null } = {}) {
  let q = supabase.from('tool_maintenance').select('*').eq('org_id', orgId)
  if (toolId) q = q.eq('tool_id', toolId)
  if (openOnly) q = q.is('resolved_at', null)
  const { data } = await q.order('opened_at', { ascending: false })
  return data || []
}
// Send a tool to the shop for maintenance: opens a record and moves it in_maintenance.
// expectedReturn (YYYY-MM-DD) is the anticipated return-to-service date, optional.
export async function sendToMaintenance(orgId, toolId, description, expectedReturn = null) {
  await supabase.from('tool_maintenance').insert({ org_id: orgId, tool_id: toolId, description: description || null, expected_return_date: expectedReturn || null })
  const now = new Date().toISOString()
  const { data: open } = await supabase.from('tool_assignments').select('id, holder_type').eq('org_id', orgId).eq('tool_id', toolId).is('ended_at', null).maybeSingle()
  if (open && open.holder_type !== 'shop') await supabase.from('tool_assignments').update({ ended_at: now }).eq('id', open.id)
  if (!open || open.holder_type !== 'shop') {
    await supabase.from('tool_assignments').insert({ org_id: orgId, tool_id: toolId, holder_type: 'shop', holder_id: null, note: 'Returned to shop for maintenance' })
  }
  return supabase.from('tools').update({ status: 'in_maintenance', holder_type: 'shop', holder_id: null, needs_maintenance: true }).eq('id', toolId)
}
// Set or clear the anticipated return-to-service date on an open maintenance record.
export async function setExpectedReturn(maintId, dateStr) {
  return supabase.from('tool_maintenance').update({ expected_return_date: dateStr || null }).eq('id', maintId)
}

// Verify the fix: closes the record, clears the flag, tool returns to in_shop (redeployable).
export async function resolveMaintenance(orgId, maintId, toolId, { verified_by = null, cost = null, notes = null } = {}) {
  const now = new Date().toISOString()
  await supabase.from('tool_maintenance').update({ resolved_at: now, verified_by, verified_at: now, cost, notes }).eq('id', maintId)
  return supabase.from('tools').update({ status: 'in_shop', needs_maintenance: false }).eq('id', toolId)
}

// ---- Dashboard rollup -----------------------------------------------------
export async function toolsDashboardData(orgId) {
  const [tools, openMaint, acqRes, txnRes] = await Promise.all([
    listTools(orgId, { includeRetired: false }),
    listToolMaintenance(orgId, { openOnly: true }),
    supabase.from('tool_acquisitions').select('id, acquisition_type, vendor, po_status, rental_return_due, rental_returned_at').eq('org_id', orgId).is('deleted_at', null),
    supabase.from('card_transactions').select('id, matched_acquisition_id, amount').eq('org_id', orgId).is('matched_acquisition_id', null),
  ])
  const acqs = acqRes.data || [], unmatchedTxns = txnRes.data || []
  const inShop = tools.filter((t) => t.status === 'in_shop').length
  const assigned = tools.filter((t) => t.status === 'assigned').length
  const inMaintenance = tools.filter((t) => t.status === 'in_maintenance').length
  const flagged = tools.filter((t) => t.needs_maintenance)
  const totalCost = tools.reduce((s, t) => s + (Number(t.cost) || 0), 0)
  // Follow-up needed: an open maintenance record whose anticipated return date has
  // passed and the tool still isn't marked returned (resolved).
  const today = new Date().toISOString().slice(0, 10)
  const byTool = Object.fromEntries(tools.map((t) => [t.id, t]))
  const followUp = openMaint
    .filter((m) => m.expected_return_date && m.expected_return_date < today)
    .map((m) => ({
      id: m.id, toolId: m.tool_id,
      label: byTool[m.tool_id] ? toolLabel(byTool[m.tool_id], tools) : 'Tool',
      expected: m.expected_return_date,
      daysLate: Math.max(0, Math.round((new Date(today) - new Date(m.expected_return_date)) / 86400000)),
    }))
  // Rentals overdue: past their return-by date and not yet returned.
  const rentalsOverdue = acqs
    .filter((a) => a.acquisition_type === 'rental' && !a.rental_returned_at && a.rental_return_due && a.rental_return_due < today)
    .map((a) => ({
      id: a.id, vendor: a.vendor || 'rental', due: a.rental_return_due,
      daysLate: Math.max(0, Math.round((new Date(today) - new Date(a.rental_return_due)) / 86400000)),
    }))
  return {
    total: tools.length, inShop, assigned, inMaintenance,
    flaggedCount: flagged.length,
    flagged: flagged.map((t) => ({ id: t.id, label: toolLabel(t, tools), status: t.status })),
    openMaintenanceCount: openMaint.length,
    followUpCount: followUp.length,
    followUp,
    rentalsOverdueCount: rentalsOverdue.length,
    rentalsOverdue,
    onOrderCount: acqs.filter((a) => a.acquisition_type === 'po' && (a.po_status === 'ordered' || a.po_status === 'partial')).length,
    unreconciledChargeCount: unmatchedTxns.length,
    totalCost: Math.round(totalCost),
    tools,
  }
}

// ---- Acquisitions (how a tool entered) ------------------------------------
export async function listAcquisitions(orgId, { type = null } = {}) {
  let q = supabase.from('tool_acquisitions').select('*').eq('org_id', orgId).is('deleted_at', null)
  if (type) q = q.eq('acquisition_type', type)
  const { data } = await q.order('acquired_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
  return data || []
}

// Quincy reads a tool/equipment purchase receipt (PDF or photo).
export async function extractToolReceipt(fileBase64, mediaType) {
  const { data, error } = await supabase.functions.invoke('tool-receipt-extract', { body: { fileBase64, mediaType } })
  if (error || data?.error) return { error: data?.error || error?.message || 'Could not read the receipt.' }
  return { ...data, items: Array.isArray(data?.items) ? data.items : [] }
}

// Create an acquisition and (optionally) the tools it brought in. Each new tool
// gets the next instance number for its name and an opening shop assignment.
export async function createAcquisitionWithTools(orgId, acq, toolRows, createdBy) {
  const { data: a, error: aerr } = await supabase.from('tool_acquisitions')
    .insert({ org_id: orgId, ...acq, created_by: createdBy || null }).select().single()
  if (aerr) return { error: aerr }
  const isRental = acq.acquisition_type === 'rental'
  const { data: existing } = await supabase.from('tools').select('name, instance_no').eq('org_id', orgId).is('deleted_at', null)
  const maxByName = new Map()
  ;(existing || []).forEach((t) => { const k = (t.name || '').trim().toLowerCase(); if ((t.instance_no || 0) > (maxByName.get(k) || 0)) maxByName.set(k, t.instance_no || 0) })
  let createdCount = 0
  for (const r of (toolRows || [])) {
    const name = (r.name || '').trim(); if (!name) continue
    const k = name.toLowerCase(); const next = (maxByName.get(k) || 0) + 1; maxByName.set(k, next)
    const { data: t, error } = await supabase.from('tools').insert({
      org_id: orgId, name, brand: r.brand || null, is_hand_tool: !!r.is_hand_tool,
      model_no: r.is_hand_tool ? null : (r.model_no || null), serial_no: r.is_hand_tool ? null : (r.serial_no || null),
      instance_no: next, cost: r.cost ?? null, purchase_date: acq.acquired_date || null,
      maintenance_requirements: r.maintenance_requirements || null,
      acquisition_id: a.id, is_rental: isRental, status: 'in_shop', holder_type: 'shop', holder_id: null,
    }).select('id').single()
    if (!error && t) { createdCount++; await supabase.from('tool_assignments').insert({ org_id: orgId, tool_id: t.id, holder_type: 'shop', holder_id: null, note: isRental ? 'Rental received' : 'Received by shop (purchase)' }) }
  }
  return { acquisition: a, createdCount }
}

// Return a rented tool set: stamp the return and retire the rented tools.
export async function returnRental(orgId, acquisitionId) {
  const now = new Date().toISOString()
  await supabase.from('tool_acquisitions').update({ rental_returned_at: now }).eq('id', acquisitionId)
  return supabase.from('tools').update({ status: 'retired', deleted_at: now, deleted_reason: 'rental_returned' }).eq('acquisition_id', acquisitionId).is('deleted_at', null)
}

// ---- Card / bank statement reconciliation ---------------------------------
export async function extractCardStatement(fileBase64, mediaType) {
  const { data, error } = await supabase.functions.invoke('card-statement-extract', { body: { fileBase64, mediaType } })
  if (error || data?.error) return { error: data?.error || error?.message || 'Could not read the statement.' }
  return { card_last4: data?.card_last4 || '', transactions: Array.isArray(data?.transactions) ? data.transactions : [] }
}
export async function importCardTransactions(orgId, rows) {
  const payload = rows.map((r) => ({ org_id: orgId, source: 'csv', ...r }))
  const { data, error } = await supabase.from('card_transactions').insert(payload).select('id')
  return { inserted: data?.length || 0, error }
}
export async function listCardTransactions(orgId, { unmatchedOnly = false } = {}) {
  let q = supabase.from('card_transactions').select('*').eq('org_id', orgId)
  if (unmatchedOnly) q = q.is('matched_acquisition_id', null)
  const { data } = await q.order('txn_date', { ascending: false, nullsFirst: false })
  return data || []
}
// Card-purchase acquisitions (the receipts) available to match a statement charge.
export async function listCardAcquisitions(orgId, { unmatchedOnly = false } = {}) {
  let q = supabase.from('tool_acquisitions').select('*').eq('org_id', orgId).eq('acquisition_type', 'card').is('deleted_at', null)
  if (unmatchedOnly) q = q.is('reconciled_txn_id', null)
  const { data } = await q.order('acquired_date', { ascending: false, nullsFirst: false })
  return data || []
}
export async function reconcileMatch(txnId, acquisitionId) {
  await supabase.from('card_transactions').update({ matched_acquisition_id: acquisitionId }).eq('id', txnId)
  return supabase.from('tool_acquisitions').update({ reconciled_txn_id: txnId }).eq('id', acquisitionId)
}
export async function unmatchTxn(txnId, acquisitionId) {
  await supabase.from('card_transactions').update({ matched_acquisition_id: null }).eq('id', txnId)
  if (acquisitionId) await supabase.from('tool_acquisitions').update({ reconciled_txn_id: null }).eq('id', acquisitionId)
}

// ---- Tool purchase orders (order → receive, custom lines) ------------------
// Create a tool PO with a number from the SAME sequential counter as parts POs
// (elements_alloc_po_number is atomic), with custom line items. No tools are
// created yet — they come into stock when the PO is received.
export async function createToolOrder(orgId, { vendor, expected_date, notes, lines }, createdBy) {
  let poNum = null
  try { const { data: alloc } = await supabase.rpc('elements_alloc_po_number', { p_org: orgId }); if (alloc) poNum = alloc } catch (_e) { /* fall through */ }
  if (!poNum) poNum = `PO-${Date.now().toString().slice(-6)}`
  const clean = (lines || []).map((l) => ({
    name: (l.name || '').trim(), brand: l.brand || null, model_no: l.model_no || null, serial_no: l.serial_no || null,
    is_hand_tool: !!l.is_hand_tool, quantity: Math.max(1, parseInt(l.quantity, 10) || 1),
    unit_cost: (l.unit_cost === '' || l.unit_cost == null) ? null : Number(l.unit_cost),
  })).filter((l) => l.name)
  const amount = clean.reduce((s, l) => s + (Number(l.unit_cost) || 0) * l.quantity, 0)
  const { data: a, error } = await supabase.from('tool_acquisitions').insert({
    org_id: orgId, acquisition_type: 'po', po_number: poNum, po_status: 'ordered', vendor: vendor || null,
    acquired_date: new Date().toISOString().slice(0, 10), expected_date: expected_date || null,
    amount: amount || null, notes: notes || null, created_by: createdBy || null,
  }).select().single()
  if (error) return { error }
  if (clean.length) {
    const { error: le } = await supabase.from('tool_order_lines').insert(clean.map((l) => ({ org_id: orgId, acquisition_id: a.id, ...l })))
    if (le) return { error: le, acquisition: a }
  }
  return { acquisition: a, po_number: poNum, lineCount: clean.length }
}

export async function listToolOrderLines(orgId, acquisitionId) {
  const { data } = await supabase.from('tool_order_lines').select('*').eq('org_id', orgId).eq('acquisition_id', acquisitionId).order('created_at')
  return data || []
}

// Receive some/all of a tool PO: creates the ordered tools (instance-numbered,
// received into the shop) and advances the PO to partial/received.
export async function receiveToolOrder(orgId, acquisitionId, receipts) {
  const lines = await listToolOrderLines(orgId, acquisitionId)
  const { data: acq } = await supabase.from('tool_acquisitions').select('acquired_date').eq('id', acquisitionId).maybeSingle()
  const { data: existing } = await supabase.from('tools').select('name, instance_no').eq('org_id', orgId).is('deleted_at', null)
  const maxByName = new Map()
  ;(existing || []).forEach((t) => { const k = (t.name || '').trim().toLowerCase(); if ((t.instance_no || 0) > (maxByName.get(k) || 0)) maxByName.set(k, t.instance_no || 0) })
  let createdCount = 0
  for (const l of lines) {
    const remaining = (l.quantity || 0) - (l.received_count || 0)
    const want = receipts && receipts[l.id] != null ? parseInt(receipts[l.id], 10) || 0 : 0
    const n = Math.min(Math.max(0, want), remaining)
    for (let i = 0; i < n; i++) {
      const k = (l.name || '').trim().toLowerCase(); const next = (maxByName.get(k) || 0) + 1; maxByName.set(k, next)
      const { data: t, error } = await supabase.from('tools').insert({
        org_id: orgId, name: l.name, brand: l.brand || null, is_hand_tool: !!l.is_hand_tool,
        model_no: l.is_hand_tool ? null : (l.model_no || null), serial_no: l.is_hand_tool ? null : (l.serial_no || null),
        instance_no: next, cost: l.unit_cost ?? null, purchase_date: acq?.acquired_date || null,
        acquisition_id: acquisitionId, is_rental: false, status: 'in_shop', holder_type: 'shop', holder_id: null,
      }).select('id').single()
      if (!error && t) { createdCount++; await supabase.from('tool_assignments').insert({ org_id: orgId, tool_id: t.id, holder_type: 'shop', holder_id: null, note: 'Received on PO' }) }
    }
    if (n > 0) await supabase.from('tool_order_lines').update({ received_count: (l.received_count || 0) + n }).eq('id', l.id)
  }
  const after = await listToolOrderLines(orgId, acquisitionId)
  const allDone = after.length > 0 && after.every((l) => (l.received_count || 0) >= (l.quantity || 0))
  const anyDone = after.some((l) => (l.received_count || 0) > 0)
  await supabase.from('tool_acquisitions').update({
    po_status: allDone ? 'received' : (anyDone ? 'partial' : 'ordered'),
    received_date: allDone ? new Date().toISOString().slice(0, 10) : null,
  }).eq('id', acquisitionId)
  return { createdCount, fullyReceived: allDone }
}
