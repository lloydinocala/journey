// Refrigerant Management · data layer
// Logs refrigerant added/recovered per system across locations, tracks cylinders
// cradle-to-grave, and computes a leak-rate estimate. Two rule layers:
//   • Section 608 — applies to all work (certified techs, recover, records).
//   • AIM Act ER&R — leak-repair recordkeeping for "covered" systems only:
//     subsector <> residential_light_commercial AND full charge >= 15 lb.
import { supabase } from '../../utils/supabase'

// AIM-Act leak-rate thresholds (% of full charge) that force a repair.
export const LEAK_THRESHOLD = { comfort_cooling: 10, commercial_refrigeration: 20, industrial: 30 }
export const SUBSECTORS = [
  { v: 'residential_light_commercial', label: 'Residential / light-commercial AC & heat pump (exempt)' },
  { v: 'comfort_cooling', label: 'Comfort cooling (10% threshold)' },
  { v: 'commercial_refrigeration', label: 'Commercial refrigeration (20%)' },
  { v: 'industrial', label: 'Industrial process refrigeration (30%)' },
]
export const CERT_TYPES = ['Type I', 'Type II', 'Type III', 'Universal']
const num = (x) => { if (x == null || x === '') return null; const n = Number(x); return isNaN(n) ? null : n }

export async function listRefrigerantTypes() {
  const { data } = await supabase.from('refrigerant_types').select('*').order('sort_order')
  return data || []
}

// ---- Systems (property_equipment with a refrigerant profile) ---------------
export async function listRefrigerantSystems(orgId, { configuredOnly = false } = {}) {
  let q = supabase.from('property_equipment')
    .select('id, org_id, property_id, system_label, outdoor_brand, outdoor_model, refrigerant_type, refrigerant_charge_lbs, refrigerant_subsector, status, retired_at, property:properties(id, street_address, unit, city, customer:customers(display_name))')
    .eq('org_id', orgId).is('retired_at', null)
  if (configuredOnly) q = q.not('refrigerant_type', 'is', null)
  const { data } = await q.order('system_label')
  return data || []
}
export async function updateSystemRefrigerant(equipmentId, patch) {
  return supabase.from('property_equipment').update(patch).eq('id', equipmentId)
}
export function systemLocation(s) {
  const p = s.property || {}
  const cust = p.customer?.display_name
  const addr = [p.street_address, p.city].filter(Boolean).join(', ')
  return [cust, addr].filter(Boolean).join(' · ') || '(no location)'
}
export function systemLeakStatus(system, addedLbs12mo) {
  const charge = Number(system.refrigerant_charge_lbs) || 0
  const threshold = LEAK_THRESHOLD[system.refrigerant_subsector] ?? null
  const covered = threshold != null && charge >= 15
  const leakRate = charge > 0 ? (addedLbs12mo / charge) * 100 : null
  const over = covered && leakRate != null && leakRate > threshold
  return { charge, threshold, covered, leakRate, over }
}

// ---- Cylinders (cradle-to-grave) ------------------------------------------
export async function listCylinders(orgId, { includeSent = false } = {}) {
  let q = supabase.from('refrigerant_cylinders').select('*').eq('org_id', orgId).is('deleted_at', null)
  if (!includeSent) q = q.eq('status', 'in_service')
  const { data } = await q.order('created_at', { ascending: false })
  return data || []
}
export async function addCylinder(orgId, row) {
  return supabase.from('refrigerant_cylinders').insert({
    org_id: orgId, refrigerant_type: row.refrigerant_type || null, kind: row.kind || 'virgin',
    nominal_size_lbs: num(row.nominal_size_lbs), on_hand_lbs: num(row.on_hand_lbs) || 0,
    vendor: row.vendor || null, acquired_date: row.acquired_date || null, notes: row.notes || null,
  }).select().single()
}
export async function sendCylinder(orgId, id, { status, sent_to, doc_ref }) {
  return supabase.from('refrigerant_cylinders').update({
    status, sent_at: new Date().toISOString().slice(0, 10), sent_to: sent_to || null, doc_ref: doc_ref || null,
  }).eq('id', id).eq('org_id', orgId)
}

// ---- Transactions (the usage log) -----------------------------------------
export async function listTransactions(orgId, { equipmentId = null, propertyId = null, refrigerantType = null, sinceDays = null } = {}) {
  let q = supabase.from('refrigerant_transactions').select('*').eq('org_id', orgId)
  if (equipmentId) q = q.eq('equipment_id', equipmentId)
  if (propertyId) q = q.eq('property_id', propertyId)
  if (refrigerantType) q = q.eq('refrigerant_type', refrigerantType)
  if (sinceDays) { const d = new Date(); d.setDate(d.getDate() - sinceDays); q = q.gte('txn_date', d.toISOString().slice(0, 10)) }
  const { data } = await q.order('txn_date', { ascending: false })
  return data || []
}
export async function addTransaction(orgId, row) {
  const added = num(row.pounds_added) || 0, recovered = num(row.pounds_recovered) || 0
  const { data, error } = await supabase.from('refrigerant_transactions').insert({
    org_id: orgId, txn_date: row.txn_date || new Date().toISOString().slice(0, 10),
    job_id: row.job_id || null, property_id: row.property_id || null, equipment_id: row.equipment_id || null,
    technician_user_id: row.technician_user_id || null, tech_cert_type: row.tech_cert_type || null,
    refrigerant_type: row.refrigerant_type || null, pounds_added: added || null, pounds_recovered: recovered || null,
    cylinder_id: row.cylinder_id || null, reason: row.reason || 'topoff', notes: row.notes || null,
  }).select().single()
  if (error) return { error }
  // Move refrigerant in/out of the chosen cylinder.
  if (row.cylinder_id && (added || recovered)) {
    const { data: cyl } = await supabase.from('refrigerant_cylinders').select('on_hand_lbs').eq('id', row.cylinder_id).maybeSingle()
    if (cyl) {
      const next = Math.max(0, (Number(cyl.on_hand_lbs) || 0) - added + recovered)
      await supabase.from('refrigerant_cylinders').update({ on_hand_lbs: next }).eq('id', row.cylinder_id)
    }
  }
  return { data }
}

// ---- Technician EPA cert lookup (from HR user_certifications) --------------
export async function listTechCerts(orgId) {
  const { data } = await supabase.from('user_certifications').select('user_id, name, number, expiry_date').eq('org_id', orgId)
  const by = {}
  ;(data || []).forEach((c) => {
    if (/608|epa|refrig/i.test(c.name || '')) {
      const prev = by[c.user_id]
      if (!prev || (c.expiry_date || '') > (prev.expiry_date || '')) by[c.user_id] = c
    }
  })
  return by // user_id -> { name, number, expiry_date }
}

// ---- Dashboard rollup -----------------------------------------------------
export async function dashboardData(orgId) {
  const today = new Date().toISOString().slice(0, 10)
  const [systems, txns] = await Promise.all([
    listRefrigerantSystems(orgId, { configuredOnly: true }),
    listTransactions(orgId, { sinceDays: 365 }),
  ])
  const addedByEquip = {}
  let added90 = 0, recovered90 = 0
  const d90 = new Date(); d90.setDate(d90.getDate() - 90); const since90 = d90.toISOString().slice(0, 10)
  txns.forEach((t) => {
    if (t.equipment_id) addedByEquip[t.equipment_id] = (addedByEquip[t.equipment_id] || 0) + (Number(t.pounds_added) || 0)
    if (t.txn_date >= since90) { added90 += Number(t.pounds_added) || 0; recovered90 += Number(t.pounds_recovered) || 0 }
  })
  const overThreshold = []
  systems.forEach((s) => {
    const st = systemLeakStatus(s, addedByEquip[s.id] || 0)
    if (st.over) overThreshold.push({ id: s.id, label: s.system_label || 'System', location: systemLocation(s), leakRate: Math.round(st.leakRate), threshold: st.threshold, type: s.refrigerant_type })
  })
  const cyls = await listCylinders(orgId, { includeSent: false })
  const onHandLbs = cyls.reduce((s, c) => s + (Number(c.on_hand_lbs) || 0), 0)
  const awaitingReclaim = cyls.filter((c) => c.kind === 'recovered' && (Number(c.on_hand_lbs) || 0) > 0.01)
  return {
    systemsTracked: systems.length,
    added90: Math.round(added90 * 10) / 10, recovered90: Math.round(recovered90 * 10) / 10,
    overThresholdCount: overThreshold.length, overThreshold,
    cylinderCount: cyls.length, onHandLbs: Math.round(onHandLbs * 10) / 10,
    awaitingReclaimCount: awaitingReclaim.length,
    today,
  }
}
