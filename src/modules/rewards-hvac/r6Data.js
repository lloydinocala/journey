// Rewards-HVAC · R6 data layer (certified payroll / prevailing wage)
import { supabase } from '../../utils/supabase'
import { computeFederalWithholding } from './taxTables'

const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100
export function money(n) { return n == null || isNaN(n) ? '—' : '$' + Number(n).toFixed(2) }
const sum = (arr) => (arr || []).reduce((s, x) => s + (Number(x) || 0), 0)

// ---- Projects --------------------------------------------------------------
export async function listProjects(orgId, { includeInactive = false } = {}) {
  let q = supabase.from('rewards_projects').select('*').eq('org_id', orgId).order('name')
  if (!includeInactive) q = q.eq('active', true)
  const { data } = await q
  return data || []
}
export async function addProject(orgId, row) { return supabase.from('rewards_projects').insert({ org_id: orgId, ...row }).select().single() }
export async function updateProject(id, patch) { return supabase.from('rewards_projects').update(patch).eq('id', id) }

// ---- Wage determinations ---------------------------------------------------
export async function listDeterminations(orgId) {
  const { data } = await supabase.from('rewards_wage_determinations').select('*').eq('org_id', orgId).eq('active', true).order('classification')
  return data || []
}
export async function addDetermination(orgId, row) { return supabase.from('rewards_wage_determinations').insert({ org_id: orgId, ...row }).select().single() }
export async function updateDetermination(id, patch) { return supabase.from('rewards_wage_determinations').update(patch).eq('id', id) }
export async function deleteDetermination(id) { return supabase.from('rewards_wage_determinations').delete().eq('id', id) }

// Find the best-matching determination for a classification (+ optional county).
export function findDetermination(dets, classification, county) {
  const matches = dets.filter((d) => d.classification === classification)
  return matches.find((d) => d.county === county) || matches[0] || null
}

// ---- Certified payroll lines ----------------------------------------------
export async function listCertPayroll(orgId, projectId, weekEnding) {
  let q = supabase.from('rewards_cert_payroll').select('*').eq('org_id', orgId).eq('project_id', projectId)
  if (weekEnding) q = q.eq('week_ending', weekEnding)
  const { data } = await q.order('worker_name')
  return data || []
}
export async function upsertCertLine(orgId, row) {
  const payload = { org_id: orgId, ...row, updated_at: new Date().toISOString() }
  if (row.id) return supabase.from('rewards_cert_payroll').update(payload).eq('id', row.id).select().single()
  return supabase.from('rewards_cert_payroll').insert(payload).select().single()
}
export async function deleteCertLine(id) { return supabase.from('rewards_cert_payroll').delete().eq('id', id) }

// Pure calc: daily hours + rates -> totals, gross, taxes, net.
// Fringe paid "cash" is added to cash wages; fringe to a "plan" is paid separately.
export function computeCertLine(line) {
  const st = round2(sum(line.daily_st))
  const ot = round2(sum(line.daily_ot))
  const base = Number(line.base_rate) || 0
  const fringe = Number(line.fringe_rate) || 0
  const cashFringe = line.fringe_mode === 'cash' ? round2((st + ot) * fringe) : 0
  const gross = round2(st * base + ot * base * 1.5 + cashFringe)
  const fica = round2(gross * 0.0765)
  const fedWh = line.fed_wh != null && line.fed_wh !== '' ? round2(line.fed_wh)
    : computeFederalWithholding({ gross, frequency: 'weekly', filingStatus: 'single' }).amount
  const other = round2(line.other_deductions)
  const stateWh = round2(line.state_wh)
  const net = round2(gross - fica - fedWh - stateWh - other)
  return { total_st: st, total_ot: ot, gross, fica, fed_wh: fedWh, net, cashFringe }
}
