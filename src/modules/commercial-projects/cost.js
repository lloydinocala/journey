// Commercial Projects · cost picture: budget vs actual, earned value, forecast,
// and over/under billing. One function so the Budget tab, the pay application
// guard, and the dashboard all use the same numbers.
import { supabase } from '../../utils/supabase'
import { num, r2, approvedCoTotal } from './data'

export const FADE_TOLERANCE = 0.10   // 10 points: billed % ahead of cost % → flag

export async function loadCostPicture(project) {
  const pid = project.id
  const [{ data: budget }, { data: entries }, { data: logs }, { data: sov }, { data: apps }, { data: cos }] = await Promise.all([
    supabase.from('cp_budget_lines').select('*').eq('project_id', pid).order('sort_order'),
    supabase.from('cp_cost_entries').select('*').eq('project_id', pid).order('entry_date', { ascending: false }),
    supabase.from('cp_daily_logs').select('id, log_date, crew_hours, budget_line_id').eq('project_id', pid),
    supabase.from('cp_sov_lines').select('id, item_no, description, scheduled_value').eq('project_id', pid).order('sort_order'),
    supabase.from('cp_pay_apps').select('id, app_number, total_completed').eq('project_id', pid).eq('status', 'submitted').order('app_number'),
    supabase.from('cp_change_orders').select('status, amount').eq('project_id', pid),
  ])
  const latest = (apps || []).at(-1) || null
  const billedBySov = {}
  if (latest) {
    const { data: ll } = await supabase.from('cp_pay_app_lines').select('sov_line_id, previous_work, work_this_period, stored_to_date').eq('pay_app_id', latest.id)
    for (const l of ll || []) billedBySov[l.sov_line_id] = num(l.previous_work) + num(l.work_this_period) + num(l.stored_to_date)
  }
  return computeCostPicture({ project, budget: budget || [], entries: entries || [], logs: logs || [], sov: sov || [], latest, billedBySov, cos: cos || [] })
}

export function computeCostPicture({ project, budget, entries, logs, sov, latest, billedBySov, cos }) {
  const rate = num(project.labor_rate)
  const useLogs = project.count_daily_log_labor !== false && rate > 0
  const sovById = Object.fromEntries(sov.map((s) => [s.id, s]))
  const contract = num(project.original_contract) + approvedCoTotal(cos)
  const billedGross = latest ? num(latest.total_completed) : 0
  const projectBilledPct = contract ? billedGross / contract : 0
  const sovPct = (sid) => { const s = sovById[sid]; return s && num(s.scheduled_value) ? num(billedBySov[sid]) / num(s.scheduled_value) : null }

  const actualFor = (lineId) => {
    const e = entries.filter((x) => (x.budget_line_id || null) === lineId).reduce((a, x) => a + num(x.amount), 0)
    const hrs = logs.filter((x) => (x.budget_line_id || null) === lineId).reduce((a, x) => a + num(x.crew_hours), 0)
    return { entries: e, logHours: hrs, logCost: useLogs ? r2(hrs * rate) : 0 }
  }

  const lines = budget.map((b) => {
    const a = actualFor(b.id)
    const actual = a.entries + a.logCost
    const budgetAmt = num(b.total)
    const linkedPct = b.sov_line_id ? sovPct(b.sov_line_id) : null
    const billedPct = linkedPct != null ? linkedPct : projectBilledPct
    const ev = budgetAmt * billedPct
    const fade = budgetAmt > 0 && actual > ev * 1.1 && actual - ev > 500
    // Forecast: your estimate-to-complete if entered; otherwise assume the budget
    // holds, unless spending is running ahead of progress — then project at the
    // current rate (the honest, pessimistic view).
    const eac = b.etc_override != null ? actual + num(b.etc_override)
      : Math.max(budgetAmt, actual, fade && billedPct > 0.05 ? actual / billedPct : 0)
    const costPct = eac > 0 ? actual / eac : 0
    return {
      line: b, sov: b.sov_line_id ? sovById[b.sov_line_id] : null, budget: budgetAmt, actual, logHours: a.logHours, logCost: a.logCost,
      billedPct, pctSource: linkedPct != null ? 'line' : 'project', ev, cv: ev - actual, eac, vac: budgetAmt - eac, costPct,
      fade,
      overbilled: budgetAmt > 0 && billedPct - costPct > FADE_TOLERANCE,
    }
  })
  const un = actualFor(null)
  const unallocated = { actual: un.entries + un.logCost, logHours: un.logHours, logCost: un.logCost }

  const budgetTotal = lines.reduce((a, l) => a + l.budget, 0)
  const actualTotal = lines.reduce((a, l) => a + l.actual, 0) + unallocated.actual
  const eacTotal = lines.reduce((a, l) => a + l.eac, 0) + unallocated.actual
  const evTotal = lines.reduce((a, l) => a + l.ev, 0)
  const costPctProject = eacTotal > 0 ? actualTotal / eacTotal : 0
  const earnedRevenue = contract * costPctProject
  // Cost % complete per SOV line, for the pay-application guard.
  const costPctBySov = {}
  for (const sid of new Set(lines.filter((l) => l.line.sov_line_id).map((l) => l.line.sov_line_id))) {
    const ls = lines.filter((l) => l.line.sov_line_id === sid)
    const a = ls.reduce((s, l) => s + l.actual, 0), e = ls.reduce((s, l) => s + l.eac, 0)
    costPctBySov[sid] = e > 0 ? a / e : 0
  }
  return {
    lines, unallocated, contract, budgetTotal, actualTotal, eacTotal, evTotal, rate, useLogs,
    budgetMargin: contract - budgetTotal, projectedMargin: contract - eacTotal,
    costPctProject, earnedRevenue, billedGross, overUnder: billedGross - earnedRevenue,
    cpi: actualTotal > 0 ? evTotal / actualTotal : null, costPctBySov, hasBudget: budget.length > 0,
  }
}
