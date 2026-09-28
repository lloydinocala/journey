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

// Metric catalog — the menu a subscriber ticks from to build their scorecard.
// `sourced: true` means Journey already holds the underlying data (jobs, invoices,
// estimates, agreements, time clock, certifications) so the value can be computed
// for you; `sourced: false` means you supply the number (a survey, a review score).
// Adding a metric here creates it on the scorecard; automatic value-fill for the
// sourced ones is rolled out metric by metric, so until each is wired the value is
// still entered by hand — the UI says which is which.
export const METRIC_CATALOG = [
  { category: 'Customer experience', name: 'Customer satisfaction', unit: 'percent', direction: 'higher', minimum: 90, description: 'Post-visit survey score', source: 'You enter (post-visit survey)', sourced: false },
  { category: 'Customer experience', name: 'Google review score', unit: 'stars', direction: 'higher', minimum: 4.5, description: 'Rolling review average for this tech', source: 'You enter (Google / reviews)', sourced: false },
  { category: 'Customer experience', name: 'Substantiated complaint rate', unit: 'percent', direction: 'lower', minimum: 0, description: 'Valid complaints ÷ completed jobs', source: 'You enter (flagged complaints)', sourced: false },
  { category: 'Productivity', name: 'Revenue per completed job', unit: 'currency', direction: 'actual', minimum: null, description: 'Invoiced revenue ÷ completed jobs', source: 'Journey: invoices + jobs', sourced: true },
  { category: 'Productivity', name: 'Average ticket', unit: 'currency', direction: 'actual', minimum: null, description: 'Average invoice total', source: 'Journey: invoices', sourced: true },
  { category: 'Productivity', name: 'Jobs completed per day', unit: 'number', direction: 'higher', minimum: null, description: 'Completed jobs ÷ field days worked', source: 'Journey: jobs + time clock', sourced: true },
  { category: 'Productivity', name: 'Estimate close rate', unit: 'percent', direction: 'higher', minimum: 30, description: 'Estimates sold ÷ estimates presented', source: 'Journey: estimates', sourced: true },
  { category: 'Productivity', name: 'Maintenance-agreement conversion', unit: 'percent', direction: 'higher', minimum: null, description: 'Agreements sold ÷ eligible jobs', source: 'Journey: maintenance agreements', sourced: true },
  { category: 'Professionalism', name: 'Attendance & clock-in reliability', unit: 'percent', direction: 'higher', minimum: 95, description: 'On-time clock-ins ÷ scheduled shifts', source: 'Journey: time clock', sourced: true },
  { category: 'Professionalism', name: 'Certifications current', unit: 'percent', direction: 'higher', minimum: 100, description: 'Required certifications not expired', source: 'Journey: HR certifications', sourced: true },
  { category: 'Professionalism', name: 'Training & improvement', unit: 'percent', direction: 'actual', minimum: null, description: 'Required training and skill progress', source: 'You enter', sourced: false },
  { category: 'Workmanship', name: 'Technician-attributable callback rate', unit: 'percent', direction: 'lower', minimum: 0, description: 'Attributable callbacks ÷ completed jobs (rolling ~90 days; exclude defective parts, unrelated failures, and declined repairs)', source: 'You enter (flagged callbacks)', sourced: false },
  { category: 'Workmanship', name: 'Quality-audit score', unit: 'percent', direction: 'higher', minimum: 80, description: 'Random audit of ~5 completed calls/month: correct diagnosis, real measurements, root-cause fix, safe operation, photos, clean work area', source: 'You enter (random audit)', sourced: false },
  { category: 'Workmanship', name: 'Documentation completeness', unit: 'percent', direction: 'higher', minimum: 100, description: 'Jobs with checklist and photos complete', source: 'Journey: job checklists', sourced: true },
  { category: 'Responsible revenue generation', name: 'Options-presented compliance', unit: 'percent', direction: 'higher', minimum: 90, description: 'Qualifying calls where the tech properly presented the safe-minimum, full-repair, higher-reliability, replacement, and eligible-maintenance options — measures the responsibility, not what the customer bought', source: 'You enter (call audit)', sourced: false },
  { category: 'Responsible revenue generation', name: 'Substantiated overselling', unit: 'number', direction: 'lower', minimum: 0, description: 'Complaints or audits confirming unnecessary work was sold — an honesty guardrail', source: 'You enter (flagged)', sourced: false },
  { category: 'Customer experience', name: 'Review-request compliance', unit: 'percent', direction: 'higher', minimum: 80, description: 'Eligible visits where the tech asked for a review (separates effort from luck)', source: 'You enter', sourced: false },
  { category: 'Customer experience', name: 'Qualifying reviews (count)', unit: 'number', direction: 'higher', minimum: null, description: 'Number of attributable reviews — guards against one-review outliers (require a minimum before full credit)', source: 'You enter (Google / reviews)', sourced: false },
  { category: 'Professionalism', name: 'Safety & procedure compliance', unit: 'percent', direction: 'higher', minimum: 100, description: 'Non-negotiable safety items followed (electrical, combustion/CO, refrigerant, PPE, safe driving). A serious violation should override an otherwise high score', source: 'You enter (audit)', sourced: false },
]

export const CATEGORY_ORDER = ['Customer experience', 'Productivity', 'Responsible revenue generation', 'Professionalism', 'Workmanship']
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

// ---- Reviews (manager narrative + goals per period) ----
export async function listReviews(orgId, employeeId) {
  const { data } = await supabase.from('rewards_scorecard_reviews').select('*').eq('org_id', orgId).eq('employee_id', employeeId)
  return data || []
}
export async function upsertReview(orgId, { employee_id, period_label, period_date, summary, goals, reviewed_by }) {
  return supabase.from('rewards_scorecard_reviews').upsert(
    { org_id: orgId, employee_id, period_label, period_date, summary: summary || null, goals: goals || null, reviewed_by: reviewed_by || null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { onConflict: 'employee_id,period_label' }
  )
}
