// Rewards-HVAC · R4 data layer (deductions, PTO, workers' comp)
import { supabase } from '../../utils/supabase'

// ---- Deductions ------------------------------------------------------------
export async function listEmployeeDeductions(orgId, employeeId) {
  let q = supabase.from('rewards_employee_deductions').select('*').eq('org_id', orgId).order('priority')
  if (employeeId) q = q.eq('employee_id', employeeId)
  const { data } = await q
  return data || []
}
export async function addDeduction(orgId, row) {
  return supabase.from('rewards_employee_deductions').insert({ org_id: orgId, ...row }).select().single()
}
export async function updateDeduction(id, patch) {
  return supabase.from('rewards_employee_deductions').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}
export async function deleteDeduction(id) {
  return supabase.from('rewards_employee_deductions').delete().eq('id', id)
}

// Presets so common benefits get the tax flags right automatically.
export const DEDUCTION_PRESETS = {
  '401k': { category: 'retirement', pre_tax: true, reduces_fit: true, reduces_fica: false },
  'roth401k': { category: 'retirement', pre_tax: false, reduces_fit: false, reduces_fica: false },
  'health125': { category: 'benefit', pre_tax: true, reduces_fit: true, reduces_fica: true },
  'hsa': { category: 'benefit', pre_tax: true, reduces_fit: true, reduces_fica: true },
  'garnishment': { category: 'garnishment', pre_tax: false, reduces_fit: false, reduces_fica: false },
  'other_posttax': { category: 'other', pre_tax: false, reduces_fit: false, reduces_fica: false },
}

// ---- PTO / leave -----------------------------------------------------------
export async function listPtoPolicies(orgId, { includeInactive = false } = {}) {
  let q = supabase.from('rewards_pto_policies').select('*').eq('org_id', orgId).order('name')
  if (!includeInactive) q = q.eq('active', true)
  const { data } = await q
  return data || []
}
export async function addPtoPolicy(orgId, row) {
  return supabase.from('rewards_pto_policies').insert({ org_id: orgId, ...row }).select().single()
}
export async function updatePtoPolicy(id, patch) {
  return supabase.from('rewards_pto_policies').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}
export async function listPtoBalances(orgId) {
  const { data } = await supabase.from('rewards_pto_balances').select('*').eq('org_id', orgId)
  const map = {}; (data || []).forEach((b) => { map[b.employee_id + ':' + b.policy_id] = b }); return map
}
export async function listPtoTransactions(orgId, employeeId) {
  let q = supabase.from('rewards_pto_transactions').select('*').eq('org_id', orgId).order('txn_date', { ascending: false }).limit(200)
  if (employeeId) q = q.eq('employee_id', employeeId)
  const { data } = await q
  return data || []
}
// Add a transaction and roll the balance forward (respecting the policy cap).
export async function addPtoTransaction(orgId, { employee_id, policy_id, kind, hours, note, txn_date, cap }) {
  await supabase.from('rewards_pto_transactions').insert({ org_id: orgId, employee_id, policy_id, kind, hours, note: note || null, txn_date: txn_date || undefined })
  const { data: bal } = await supabase.from('rewards_pto_balances').select('*').eq('employee_id', employee_id).eq('policy_id', policy_id).maybeSingle()
  let next = (Number(bal?.balance_hours) || 0) + Number(hours)
  if (cap != null && next > cap) next = cap
  if (next < 0) next = 0
  return supabase.from('rewards_pto_balances').upsert(
    { org_id: orgId, employee_id, policy_id, balance_hours: Math.round(next * 100) / 100, updated_at: new Date().toISOString() },
    { onConflict: 'employee_id,policy_id' }
  )
}

// ---- Workers' comp ---------------------------------------------------------
export async function listWcClasses(orgId, { includeInactive = false } = {}) {
  let q = supabase.from('rewards_wc_classes').select('*').eq('org_id', orgId).order('code')
  if (!includeInactive) q = q.eq('active', true)
  const { data } = await q
  return data || []
}
export async function addWcClass(orgId, row) {
  return supabase.from('rewards_wc_classes').insert({ org_id: orgId, ...row }).select().single()
}
export async function updateWcClass(id, patch) {
  return supabase.from('rewards_wc_classes').update(patch).eq('id', id)
}
export async function listEmployeeWc(orgId) {
  const { data } = await supabase.from('rewards_employee_wc').select('*').eq('org_id', orgId)
  const map = {}; (data || []).forEach((r) => { map[r.employee_id] = r.wc_class_id }); return map
}
export async function setEmployeeWc(orgId, employeeId, wcClassId) {
  return supabase.from('rewards_employee_wc').upsert(
    { org_id: orgId, employee_id: employeeId, wc_class_id: wcClassId || null, updated_at: new Date().toISOString() },
    { onConflict: 'employee_id' }
  )
}
