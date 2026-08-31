// Rewards-HVAC · Employee Scorecard data layer.
// A configurable, quarterly, metrics-based performance record kept in each
// employee's permanent file. Metrics are org-editable; entries are snapshots
// per period so the full history is retained (Current vs Last Update columns).
import { supabase } from '../../utils/supabase'

// Starter template — matches the standard HVAC technician scorecard. Orgs can
// edit, add, or remove any of these after loading them.
export const DEFAULT_SCORECARD_METRICS = [
  { category: 'Customer experience', name: 'Personal Google review score', description: 'Rolling average of reviews attributable to the technician', unit: 'stars', minimum: 4.4, direction: 'higher' },
  { category: 'Customer experience', name: 'Customer satisfaction', description: 'Post-visit survey average or percentage rating the visit highly', unit: 'stars', minimum: 4.8, direction: 'higher' },
  { category: 'Customer experience', name: 'Substantiated complaint rate', description: 'Valid complaints ÷ completed jobs', unit: 'percent', minimum: 0, direction: 'lower' },
  { category: 'Productivity', name: 'Sales per paid field hour', description: 'Eligible service revenue ÷ paid field hours', unit: 'currency', minimum: null, direction: 'actual' },
  { category: 'Productivity', name: 'Productive-hour utilization', description: 'Time on completed calls ÷ available field time', unit: 'percent', minimum: 75, direction: 'higher' },
  { category: 'Productivity', name: 'Schedule performance', description: 'Calls completed within scheduled expectations', unit: 'percent', minimum: 75, direction: 'higher' },
  { category: 'Productivity', name: 'Maintenance-agreement conversion', description: 'Agreements sold ÷ eligible nonmember households', unit: 'percent', minimum: null, direction: 'actual' },
  { category: 'Professionalism', name: 'Attendance and reliability', description: 'Attendance, punctuality and avoidable schedule disruptions', unit: 'percent', minimum: 100, direction: 'higher' },
  { category: 'Professionalism', name: 'Training and improvement', description: 'Required training, certifications and demonstrated skill progress', unit: 'percent', minimum: null, direction: 'actual' },
  { category: 'Workmanship', name: 'Technician-attributable callback rate', description: 'Attributable callbacks ÷ completed jobs', unit: 'percent', minimum: 0, direction: 'lower' },
  { category: 'Workmanship', name: 'Diagnostic/documentation completeness', description: 'Tickets meeting all documentation requirements ÷ tickets audited', unit: 'percent', minimum: 100, direction: 'higher' },
]

export const CATEGORY_ORDER = ['Customer experience', 'Productivity', 'Professionalism', 'Workmanship']
export const UNITS = [['stars', 'Stars'], ['percent', 'Percent'], ['currency', 'Dollars'], ['number', 'Number']]
export const DIRECTIONS = [['higher', 'Higher is better'], ['lower', 'Lower is better'], ['actual', 'Actual — no minimum']]

// ---- Formatting & pass/fail ----
export function fmtValue(unit, v) {
  if (v == null || v === '' || isNaN(v)) return '—'
  const n = Number(v)
  if (unit === 'stars') return `${n} Stars`
  if (unit === 'percent') return `${n}%`
  if (unit === 'currency') return `$${n.toFixed(2)}`
  return `${n}`
}
export function fmtMinimum(m) {
  if (m.direction === 'actual' || m.minimum == null) return 'Actual — no minimum'
  return fmtValue(m.unit, m.minimum)
}
// True when the value MISSES the minimum (should be flagged).
export function isFail(m, v) {
  if (v == null || v === '' || isNaN(v) || m.minimum == null || m.direction === 'actual') return false
  const n = Number(v)
  if (m.direction === 'higher') return n < Number(m.minimum)
  if (m.direction === 'lower') return n > Number(m.minimum)
  return false
}

// ---- Period helpers ----
export function currentQuarter(d = new Date()) {
  const q = Math.floor(d.getMonth() / 3) + 1
  const y = d.getFullYear()
  return { label: `${y}-Q${q}`, date: `${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01` }
}

// ---- Metrics ----
export async function listMetrics(orgId, { includeInactive = false } = {}) {
  let q = supabase.from('rewards_scorecard_metrics').select('*').eq('org_id', orgId).order('sort').order('name')
  if (!includeInactive) q = q.eq('active', true)
  const { data } = await q
  return data || []
}
export async function addMetric(orgId, row) {
  return supabase.from('rewards_scorecard_metrics').insert({ org_id: orgId, ...row }).select().single()
}
export async function updateMetric(id, patch) {
  return supabase.from('rewards_scorecard_metrics').update(patch).eq('id', id)
}
export async function seedDefaultMetrics(orgId) {
  const existing = await listMetrics(orgId, { includeInactive: true })
  if (existing.length) return existing
  const rows = DEFAULT_SCORECARD_METRICS.map((m, i) => ({ org_id: orgId, ...m, sort: i }))
  const { data } = await supabase.from('rewards_scorecard_metrics').insert(rows).select()
  return data || []
}

// ---- Entries ----
export async function listEntries(orgId, employeeId) {
  const { data } = await supabase.from('rewards_scorecard_entries').select('*').eq('org_id', orgId).eq('employee_id', employeeId)
  return data || []
}
export async function upsertEntry(orgId, { employee_id, metric_id, period_label, period_date, value, note }) {
  return supabase.from('rewards_scorecard_entries').upsert(
    { org_id: orgId, employee_id, metric_id, period_label, period_date, value: value === '' ? null : value, note: note || null, updated_at: new Date().toISOString() },
    { onConflict: 'employee_id,metric_id,period_label' }
  )
}
