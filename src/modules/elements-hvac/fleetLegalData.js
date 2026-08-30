// Elements-HVAC · Fleet · Insurance & legal-document data layer.
// Kept separate from fleetData.js so the large fleet data module stays stable.
// Tables: elements_insurance_policies, elements_policy_vehicles,
//         elements_vehicle_documents. Files live in the private 'fleet-docs'
//         storage bucket, pathed <org_id>/<area>/<uuid>-<name> so bucket RLS
//         (first folder = org id) scopes them per organization.
import { supabase } from '../../utils/supabase'

const BUCKET = 'fleet-docs'

export const DOC_TYPES = [
  { value: 'registration', label: 'Registration' },
  { value: 'title', label: 'Title' },
  { value: 'dot', label: 'DOT / MC number' },
  { value: 'emissions', label: 'Emissions / smog' },
  { value: 'permit', label: 'Permit' },
  { value: 'other', label: 'Other' },
]
export const docTypeLabel = (t) => DOC_TYPES.find((d) => d.value === t)?.label || 'Other'

function uid() {
  try { return crypto.randomUUID() } catch { return 'x' + Date.now() + Math.random().toString(16).slice(2) }
}
function safeName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
}
export function todayStr() { return new Date().toISOString().slice(0, 10) }

// ---- Files -------------------------------------------------------------------
// Upload into <org>/<area>/<uuid>-<name>. Returns { path, name } or { error }.
export async function uploadFleetFile(orgId, area, file) {
  if (!file) return { error: { message: 'No file selected.' } }
  const path = `${orgId}/${area}/${uid()}-${safeName(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || undefined,
  })
  if (error) return { error }
  return { path, name: file.name }
}

// Short-lived signed URL for viewing/printing a stored file (desktop only).
export async function fileUrl(path) {
  if (!path) return null
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300)
  return data?.signedUrl || null
}

export async function removeFleetFile(path) {
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path])
}

// ---- Status ------------------------------------------------------------------
// Expiration status shared by policies and documents.
export function expiryStatus(dateStr, dueSoonDays = 30) {
  if (!dateStr) return { state: 'none', label: 'No date', days: null }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  const days = Math.round((due - today) / 86400000)
  if (days < 0) return { state: 'overdue', label: `Expired ${-days}d ago`, days }
  if (days <= (Number(dueSoonDays) || 30)) return { state: 'due_soon', label: `Due in ${days}d`, days }
  return { state: 'ok', label: `${days}d left`, days }
}

// ---- Insurance policies ------------------------------------------------------
export async function listPolicies(orgId) {
  const { data: pols } = await supabase.from('elements_insurance_policies')
    .select('*').eq('org_id', orgId).eq('is_active', true).order('created_at', { ascending: false })
  const { data: links } = await supabase.from('elements_policy_vehicles')
    .select('policy_id, vehicle_id').eq('org_id', orgId)
  const byPolicy = {}
  ;(links || []).forEach((l) => { (byPolicy[l.policy_id] ||= []).push(l.vehicle_id) })
  return (pols || []).map((p) => ({ ...p, vehicle_ids: byPolicy[p.id] || [] }))
}

export async function addPolicy(orgId, fields, vehicleIds, createdBy) {
  const { data, error } = await supabase.from('elements_insurance_policies')
    .insert({ ...fields, org_id: orgId, created_by: createdBy || null })
    .select('id').single()
  if (error) return { error }
  if (fields.scope === 'listed' && vehicleIds?.length) {
    const rows = vehicleIds.map((vid) => ({ org_id: orgId, policy_id: data.id, vehicle_id: vid }))
    const { error: linkErr } = await supabase.from('elements_policy_vehicles').insert(rows)
    if (linkErr) return { error: linkErr, id: data.id }
  }
  return { id: data.id }
}

export async function updatePolicy(id, fields) {
  const { error } = await supabase.from('elements_insurance_policies').update(fields).eq('id', id)
  return { error }
}

export async function setPolicyVehicles(orgId, policyId, vehicleIds) {
  await supabase.from('elements_policy_vehicles').delete().eq('policy_id', policyId)
  if (vehicleIds?.length) {
    const rows = vehicleIds.map((vid) => ({ org_id: orgId, policy_id: policyId, vehicle_id: vid }))
    const { error } = await supabase.from('elements_policy_vehicles').insert(rows)
    return { error }
  }
  return {}
}

export async function archivePolicy(id) {
  const { error } = await supabase.from('elements_insurance_policies').update({ is_active: false }).eq('id', id)
  return { error }
}

// ---- Legal documents ---------------------------------------------------------
export async function listDocuments(orgId) {
  const { data } = await supabase.from('elements_vehicle_documents')
    .select('*').eq('org_id', orgId).eq('is_active', true).order('created_at', { ascending: false })
  return data || []
}

export async function addDocument(orgId, fields, createdBy) {
  const { error } = await supabase.from('elements_vehicle_documents')
    .insert({ ...fields, org_id: orgId, created_by: createdBy || null })
  return { error }
}

export async function updateDocument(id, fields) {
  const { error } = await supabase.from('elements_vehicle_documents').update(fields).eq('id', id)
  return { error }
}

export async function archiveDocument(id) {
  const { error } = await supabase.from('elements_vehicle_documents').update({ is_active: false }).eq('id', id)
  return { error }
}
