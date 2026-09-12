import { supabase } from './utils/supabase'

// ============================================================================
//  KPI METRICS — the "units" an admin combines into a custom KPI.
//  Each metric is a single number computed from live data. computeMetrics(org)
//  fetches the base datasets once and derives every metric, returning { key: n }.
//  format: 'currency' | 'number' | 'percent' — how the value reads on a card.
// ============================================================================
export const METRIC_GROUPS = [
  { group: 'Sales (invoiced)', metrics: [
    { key: 'sales_ytd', label: 'Sales Y-T-D', format: 'currency' },
    { key: 'sales_ly_ytd', label: 'Sales Last Year Y-T-D', format: 'currency' },
    { key: 'sales_month', label: 'Sales This Month', format: 'currency' },
    { key: 'sales_smly', label: 'Sales Same Month Last Year', format: 'currency' },
    { key: 'sales_last_month', label: 'Sales Last Month', format: 'currency' },
    { key: 'sales_ly_full', label: 'Sales Last Year (full)', format: 'currency' },
  ] },
  { group: 'Retrofit / System', metrics: [
    { key: 'retrofit_ytd', label: 'Retrofit Sales Y-T-D', format: 'currency' },
    { key: 'retrofit_ly_ytd', label: 'Retrofit Last Year Y-T-D', format: 'currency' },
    { key: 'retrofit_month', label: 'Retrofit This Month', format: 'currency' },
    { key: 'retrofit_smly', label: 'Retrofit Same Month Last Year', format: 'currency' },
  ] },
  { group: 'Maintenance / PM', metrics: [
    { key: 'mrr', label: 'Recurring Revenue (per month)', format: 'currency' },
    { key: 'agreements_active', label: 'Active Agreements', format: 'number' },
    { key: 'pm_month', label: 'PM Sales This Month', format: 'currency' },
    { key: 'pm_smly', label: 'PM Sales Same Month Last Year', format: 'currency' },
  ] },
  { group: 'Cash collected', metrics: [
    { key: 'collected_ytd', label: 'Collected Y-T-D', format: 'currency' },
    { key: 'collected_ly_ytd', label: 'Collected Last Year Y-T-D', format: 'currency' },
    { key: 'collected_month', label: 'Collected This Month', format: 'currency' },
    { key: 'collected_smly', label: 'Collected Same Month Last Year', format: 'currency' },
    { key: 'collected_30d', label: 'Collected (last 30 days)', format: 'currency' },
  ] },
  { group: 'Receivables', metrics: [
    { key: 'ar_outstanding', label: 'A/R Outstanding', format: 'currency' },
    { key: 'ar_count', label: 'Unpaid Invoices', format: 'number' },
    { key: 'ar_over60', label: 'A/R 60+ Days', format: 'currency' },
  ] },
  { group: 'Estimates', metrics: [
    { key: 'est_out', label: 'Estimates Out (pending)', format: 'currency' },
    { key: 'est_unbooked', label: 'Approved, Not Booked', format: 'currency' },
    { key: 'est_sent_month', label: 'Estimates Sent This Month', format: 'currency' },
  ] },
  { group: 'Jobs', metrics: [
    { key: 'jobs_done_month', label: 'Jobs Completed This Month', format: 'number' },
    { key: 'jobs_done_smly', label: 'Jobs Completed Same Month Last Year', format: 'number' },
    { key: 'jobs_done_ytd', label: 'Jobs Completed Y-T-D', format: 'number' },
  ] },
  { group: 'Profit', metrics: [
    { key: 'profit_month', label: 'Profit This Month', format: 'currency' },
    { key: 'profit_ytd', label: 'Profit Y-T-D', format: 'currency' },
  ] },
  { group: 'People', metrics: [
    { key: 'team_active', label: 'Active Team Members', format: 'number' },
  ] },
]

export const METRICS = METRIC_GROUPS.flatMap((g) => g.metrics)
export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m]))

export async function computeMetrics(org) {
  const out = {}
  METRICS.forEach((m) => { out[m.key] = 0 })
  if (!org) return out

  const now = new Date()
  const yStart = new Date(now.getFullYear(), 0, 1)
  const lyStart = new Date(now.getFullYear() - 1, 0, 1)
  const lyDec31 = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59)
  const lyToDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59)
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  const smlyStart = new Date(now.getFullYear() - 1, now.getMonth(), 1)
  const smlyToDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59)
  const d30 = new Date(now.getTime() - 30 * 86400000)

  const [invRes, payRes, jobRes, agrRes, teamRes] = await Promise.all([
    supabase.from('invoices').select('kind, invoice_date, approved_at, sent_at, paid_at, job_total, amount_due, total_paid, balance, profit, approval_status, is_filter_order, estimate_type, spawned_job_id, converted_to_job_id')
      .eq('org_id', org).is('deleted_at', null).eq('is_archived', false).or(`invoice_date.gte.${lyStart.toISOString()},sent_at.gte.${lyStart.toISOString()},approved_at.gte.${lyStart.toISOString()}`),
    supabase.from('invoice_payments').select('amount, recorded_at').eq('org_id', org).gte('recorded_at', lyStart.toISOString()),
    supabase.from('jobs').select('status, completed_at').eq('org_id', org).is('deleted_at', null).gte('completed_at', lyStart.toISOString()),
    supabase.from('maintenance_agreements').select('price, billing_cycle, status').eq('org_id', org).eq('is_archived', false),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('org_id', org).or('is_active.is.null,is_active.eq.true').is('deleted_at', null),
  ])
  const inv = invRes.data || [], pays = payRes.data || [], jobs = jobRes.data || [], agr = agrRes.data || []
  const sale = (i) => Number(i.job_total || i.amount_due || 0)
  const bal = (i) => { const b = Number(i.balance); return Number.isFinite(b) && b !== 0 ? b : (Number(i.amount_due || 0) - Number(i.total_paid || 0)) }
  const inR = (dt, a, b) => { if (!dt) return false; const x = new Date(dt); return x >= a && x <= b }
  const days = (dt) => Math.floor((now - new Date(dt)) / 86400000)

  const realInv = inv.filter((i) => i.kind === 'invoice' && !i.is_filter_order)
  const sumInv = (pred) => realInv.filter(pred).reduce((s, i) => s + sale(i), 0)
  // Sales
  out.sales_ytd = sumInv((i) => inR(i.invoice_date, yStart, now))
  out.sales_ly_ytd = sumInv((i) => inR(i.invoice_date, lyStart, lyToDate))
  out.sales_month = sumInv((i) => inR(i.invoice_date, mStart, now))
  out.sales_smly = sumInv((i) => inR(i.invoice_date, smlyStart, smlyToDate))
  out.sales_last_month = sumInv((i) => inR(i.invoice_date, lmStart, lmEnd))
  out.sales_ly_full = sumInv((i) => inR(i.invoice_date, lyStart, lyDec31))

  // Retrofit / system — approved system estimates, by approved_at
  const sysEst = inv.filter((i) => i.kind === 'estimate' && i.estimate_type === 'system')
  const sumSys = (pred) => sysEst.filter(pred).reduce((s, i) => s + sale(i), 0)
  out.retrofit_ytd = sumSys((i) => inR(i.approved_at, yStart, now))
  out.retrofit_ly_ytd = sumSys((i) => inR(i.approved_at, lyStart, lyToDate))
  out.retrofit_month = sumSys((i) => inR(i.approved_at, mStart, now))
  out.retrofit_smly = sumSys((i) => inR(i.approved_at, smlyStart, smlyToDate))

  // Maintenance / PM
  const active = agr.filter((a) => !['canceled', 'cancelled', 'expired'].includes(String(a.status || '').toLowerCase()))
  out.mrr = active.reduce((s, a) => s + (String(a.billing_cycle || '').toLowerCase() === 'annual' ? Number(a.price || 0) / 12 : Number(a.price || 0)), 0)
  out.agreements_active = active.length
  out.pm_month = out.mrr            // best-effort: monthly recurring stands in for PM sales this month
  out.pm_smly = 0                   // no historical PM-sale flag yet

  // Cash collected
  const sumPay = (a, b) => pays.filter((p) => inR(p.recorded_at, a, b)).reduce((s, p) => s + Number(p.amount || 0), 0)
  out.collected_ytd = sumPay(yStart, now)
  out.collected_ly_ytd = sumPay(lyStart, lyToDate)
  out.collected_month = sumPay(mStart, now)
  out.collected_smly = sumPay(smlyStart, smlyToDate)
  out.collected_30d = sumPay(d30, now)

  // Receivables
  const unpaid = realInv.filter((i) => i.sent_at && !i.paid_at && bal(i) > 0.5)
  out.ar_outstanding = unpaid.reduce((s, i) => s + bal(i), 0)
  out.ar_count = unpaid.length
  out.ar_over60 = unpaid.filter((i) => days(i.sent_at) > 60).reduce((s, i) => s + bal(i), 0)

  // Estimates
  const est = inv.filter((i) => i.kind === 'estimate')
  out.est_out = est.filter((i) => i.sent_at && (String(i.approval_status || '').toLowerCase() === 'pending' || !i.approval_status)).reduce((s, i) => s + sale(i), 0)
  out.est_unbooked = est.filter((i) => String(i.approval_status || '').toLowerCase() === 'approved' && !i.spawned_job_id && !i.converted_to_job_id).reduce((s, i) => s + sale(i), 0)
  out.est_sent_month = est.filter((i) => inR(i.sent_at, mStart, now)).reduce((s, i) => s + sale(i), 0)

  // Jobs
  const done = jobs.filter((j) => j.status === 'completed' && j.completed_at)
  out.jobs_done_month = done.filter((j) => inR(j.completed_at, mStart, now)).length
  out.jobs_done_smly = done.filter((j) => inR(j.completed_at, smlyStart, smlyToDate)).length
  out.jobs_done_ytd = done.filter((j) => inR(j.completed_at, yStart, now)).length

  // Profit
  out.profit_month = realInv.filter((i) => inR(i.invoice_date, mStart, now)).reduce((s, i) => s + Number(i.profit || 0), 0)
  out.profit_ytd = realInv.filter((i) => inR(i.invoice_date, yStart, now)).reduce((s, i) => s + Number(i.profit || 0), 0)

  // People
  out.team_active = teamRes.count || 0

  return out
}

// Format a raw metric value for display.
export function fmtMetric(n, format) {
  n = Number(n) || 0
  if (format === 'currency') return '$' + Math.round(n).toLocaleString()
  if (format === 'percent') return n.toFixed(1) + '%'
  return (Math.round(n * 10) / 10).toLocaleString()
}
