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
  const [tools, openMaint] = await Promise.all([
    listTools(orgId, { includeRetired: false }),
    listToolMaintenance(orgId, { openOnly: true }),
  ])
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
  return {
    total: tools.length, inShop, assigned, inMaintenance,
    flaggedCount: flagged.length,
    flagged: flagged.map((t) => ({ id: t.id, label: toolLabel(t, tools), status: t.status })),
    openMaintenanceCount: openMaint.length,
    followUpCount: followUp.length,
    followUp,
    totalCost: Math.round(totalCost),
    tools,
  }
}
