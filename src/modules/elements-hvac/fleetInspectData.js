// Elements-HVAC · Fleet · Inspection configuration + due-flagging.
// Org-editable checklist template (elements_inspection_template) and a cadence
// for the periodic full-vehicle inspection (elements_inspection_settings),
// flagged "time or miles, whichever comes first". Kept separate from the large
// fleetData.js so that file stays stable.
import { supabase } from '../../utils/supabase'

export const SETTINGS_DEFAULTS = {
  interval_days: 90, interval_miles: 5000, due_soon_days: 14, due_soon_miles: 500,
}

// ---- Checklist template ------------------------------------------------------
export async function listTemplate(orgId) {
  const { data } = await supabase.from('elements_inspection_template')
    .select('*').eq('org_id', orgId).eq('is_active', true)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true })
  return data || []
}

export async function addTemplateItem(orgId, label, sortOrder) {
  const { error } = await supabase.from('elements_inspection_template')
    .insert({ org_id: orgId, label: label.trim(), sort_order: sortOrder ?? 0 })
  return { error }
}

export async function removeTemplateItem(id) {
  const { error } = await supabase.from('elements_inspection_template').delete().eq('id', id)
  return { error }
}

// ---- Cadence settings --------------------------------------------------------
export async function getSettings(orgId) {
  const { data } = await supabase.from('elements_inspection_settings')
    .select('*').eq('org_id', orgId).maybeSingle()
  return data || { org_id: orgId, ...SETTINGS_DEFAULTS, _default: true }
}

export async function saveSettings(orgId, fields) {
  const row = {
    org_id: orgId,
    interval_days: fields.interval_days === '' || fields.interval_days == null ? null : Number(fields.interval_days),
    interval_miles: fields.interval_miles === '' || fields.interval_miles == null ? null : Number(fields.interval_miles),
    due_soon_days: Number(fields.due_soon_days) || 14,
    due_soon_miles: Number(fields.due_soon_miles) || 500,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('elements_inspection_settings').upsert(row, { onConflict: 'org_id' })
  return { error }
}

// ---- Last inspection per vehicle --------------------------------------------
// Returns { [vehicle_id]: { inspection_date, odometer } } for the latest each.
export async function lastInspectionsByVehicle(orgId) {
  const { data } = await supabase.from('elements_inspections')
    .select('vehicle_id, inspection_date, odometer')
    .eq('org_id', orgId).order('inspection_date', { ascending: false })
  const map = {}
  ;(data || []).forEach((r) => { if (!map[r.vehicle_id]) map[r.vehicle_id] = { inspection_date: r.inspection_date, odometer: r.odometer } })
  return map
}

// ---- Due status (time OR miles, whichever comes first) -----------------------
export function inspectionDue(last, settings, currentOdo) {
  const s = settings || SETTINGS_DEFAULTS
  if (!last) return { state: 'due_soon', label: 'No inspection yet', detail: 'Schedule the first one', days: null, miles: null }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((today - new Date(last.inspection_date + 'T00:00:00')) / 86400000)
  const miles = (currentOdo != null && last.odometer != null) ? Math.max(0, Number(currentOdo) - Number(last.odometer)) : null

  const dInt = s.interval_days != null ? Number(s.interval_days) : null
  const mInt = s.interval_miles != null ? Number(s.interval_miles) : null
  const dWarn = Number(s.due_soon_days ?? 14)
  const mWarn = Number(s.due_soon_miles ?? 500)

  const overTime = dInt != null && days >= dInt
  const overMiles = mInt != null && miles != null && miles >= mInt
  const soonTime = dInt != null && days >= dInt - dWarn
  const soonMiles = mInt != null && miles != null && miles >= mInt - mWarn

  const detail = `${days}d ago${miles != null ? ` · ${miles} mi` : ''}`
  if (overTime || overMiles) return { state: 'overdue', label: overTime && overMiles ? 'Overdue' : overTime ? 'Overdue (time)' : 'Overdue (miles)', detail, days, miles }
  if (soonTime || soonMiles) return { state: 'due_soon', label: 'Due soon', detail, days, miles }
  return { state: 'ok', label: 'OK', detail, days, miles }
}
