// Rewards-HVAC · Payroll data layer (R2)
// Builds on the existing weekly capture (payroll_weeks + payroll_base_pay/bonuses/
// commissions + time_clock_events). Automates the greater-of (hourly vs pricebook
// task-hours) rule, layers federal taxes (taxTables.js), and computes net pay.
import { supabase } from '../../utils/supabase'
import { computeFederalWithholding, computeFICA, computeFUTA, PERIODS_PER_YEAR } from './taxTables'

const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100
export function money(n) { return n == null || isNaN(n) ? '—' : '$' + Number(n).toFixed(2) }

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n)
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}
export function mondayOf(date) {
  const d = new Date(date); const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day); const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

// ---- Load one week for an org: weeks + components + clocked hours + profiles --
export async function loadWeek(orgId, weekStart) {
  const weekEnd = addDays(weekStart, 6)
  const [weekRes, usersRes] = await Promise.all([
    supabase.from('payroll_weeks').select('*').eq('org_id', orgId).eq('week_start', weekStart),
    supabase.from('users').select('id, full_name, role').eq('org_id', orgId).eq('is_active', true),
  ])
  const weeks = weekRes.data || []
  const users = usersRes.data || []
  const comp = {}
  if (weeks.length) {
    const ids = weeks.map((w) => w.id)
    const [baseRes, bonusRes, commRes] = await Promise.all([
      supabase.from('payroll_base_pay').select('*').in('week_id', ids),
      supabase.from('payroll_bonuses').select('*').in('week_id', ids),
      supabase.from('payroll_commissions').select('*').in('week_id', ids),
    ])
    weeks.forEach((w) => { comp[w.id] = { base: null, bonuses: [], commissions: [] } })
    ;(baseRes.data || []).forEach((b) => { if (comp[b.week_id]) comp[b.week_id].base = b })
    ;(bonusRes.data || []).forEach((x) => { if (comp[x.week_id]) comp[x.week_id].bonuses.push(x) })
    ;(commRes.data || []).forEach((x) => { if (comp[x.week_id]) comp[x.week_id].commissions.push(x) })
  }
  const [clockHours, profiles, existingCalcs] = await Promise.all([
    computeClockHours(orgId, weekStart, weekEnd),
    loadTaxProfiles(orgId),
    listCalcs(orgId, weekStart),
  ])
  return { weeks, users, comp, clockHours, profiles, weekEnd, existingCalcs }
}

// Sum completed clock shifts (minus unpaid breaks) per user for the week —
// the actual compensable hours, same method the Payroll Capture screen uses.
export async function computeClockHours(orgId, weekStart, weekEnd) {
  const { data: clock } = await supabase
    .from('time_clock_events')
    .select('id, user_id, clock_in, clock_out')
    .eq('org_id', orgId)
    .gte('clock_in', weekStart + 'T00:00:00')
    .lte('clock_in', weekEnd + 'T23:59:59')
    .not('clock_out', 'is', null)
  const shiftIds = (clock || []).map((e) => e.id)
  const breakMs = {}
  if (shiftIds.length) {
    const { data: brk } = await supabase
      .from('clock_breaks')
      .select('clock_event_id, break_start, break_end, is_paid')
      .in('clock_event_id', shiftIds).eq('is_paid', false).not('break_end', 'is', null)
    ;(brk || []).forEach((b) => {
      const ms = new Date(b.break_end).getTime() - new Date(b.break_start).getTime()
      if (ms > 0) breakMs[b.clock_event_id] = (breakMs[b.clock_event_id] || 0) + ms
    })
  }
  const hours = {}
  ;(clock || []).forEach((e) => {
    let ms = new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()
    ms -= (breakMs[e.id] || 0)
    if (ms > 0) hours[e.user_id] = (hours[e.user_id] || 0) + ms / 3600000
  })
  Object.keys(hours).forEach((k) => { hours[k] = round2(hours[k]) })
  return hours
}

// Bridge users -> employees -> rewards_employee_hr to get each worker's tax profile.
export async function loadTaxProfiles(orgId) {
  const { data: emps } = await supabase
    .from('employees').select('id, user_id').eq('org_id', orgId)
  const byUser = {}
  const empIds = (emps || []).map((e) => e.id)
  let hrByEmp = {}
  if (empIds.length) {
    const { data: hr } = await supabase
      .from('rewards_employee_hr')
      .select('employee_id, filing_status, w4, worker_type').eq('org_id', orgId).in('employee_id', empIds)
    ;(hr || []).forEach((h) => { hrByEmp[h.employee_id] = h })
  }
  ;(emps || []).forEach((e) => {
    if (!e.user_id) return
    const h = hrByEmp[e.id] || {}
    byUser[e.user_id] = {
      employee_id: e.id,
      filing_status: h.filing_status || null,
      step2_checked: !!(h.w4 && h.w4.step2_checked),
      worker_type: h.worker_type || 'w2',
      hasProfile: !!h.filing_status,
    }
  })
  return byUser
}

// Recurring per-employee deductions, keyed by user_id (bridged via employees).
export async function loadDeductions(orgId) {
  const { data: emps } = await supabase.from('employees').select('id, user_id').eq('org_id', orgId)
  const empToUser = {}; (emps || []).forEach((e) => { if (e.user_id) empToUser[e.id] = e.user_id })
  const empIds = (emps || []).map((e) => e.id)
  const byUser = {}
  if (empIds.length) {
    const { data: ded } = await supabase
      .from('rewards_employee_deductions').select('*').eq('org_id', orgId).eq('active', true).in('employee_id', empIds)
    ;(ded || []).forEach((d) => {
      const u = empToUser[d.employee_id]; if (!u) return
      ;(byUser[u] = byUser[u] || []).push(d)
    })
  }
  return byUser
}

export function resolveDeductionAmount(d, gross) {
  return d.calc_type === 'percent' ? round2((Number(gross) || 0) * (Number(d.amount) || 0) / 100) : round2(Number(d.amount) || 0)
}

// Full deduction pass: returns pre-tax bases + capped garnishments + totals + lines.
export function applyDeductions(deductions, gross, employeeTaxes) {
  let pretaxFIT = 0, pretaxFICA = 0, totalPretax = 0, totalPosttax = 0
  const disposable = Math.max(0, gross - employeeTaxes)
  const lines = (deductions || []).map((d) => {
    let amt = resolveDeductionAmount(d, gross)
    if (d.category === 'garnishment' && d.garnishment_cap_pct) {
      amt = Math.min(amt, round2(disposable * (Number(d.garnishment_cap_pct) || 0) / 100))
    }
    if (d.pre_tax) {
      totalPretax += amt
      if (d.reduces_fit) pretaxFIT += amt
      if (d.reduces_fica) pretaxFICA += amt
    } else {
      totalPosttax += amt
    }
    return { label: d.label, category: d.category, amount: amt, pre_tax: !!d.pre_tax }
  })
  return {
    pretaxFIT: round2(pretaxFIT), pretaxFICA: round2(pretaxFICA),
    totalPretax: round2(totalPretax), totalPosttax: round2(totalPosttax),
    total: round2(totalPretax + totalPosttax), lines,
  }
}

// YTD gross before a given week (same calendar year) — for FICA/FUTA caps.
export async function getYtdGross(orgId, userId, weekStart) {
  const yearStart = weekStart.slice(0, 4) + '-01-01'
  const { data } = await supabase
    .from('rewards_payroll_calcs')
    .select('gross_pay, week_start')
    .eq('org_id', orgId).eq('user_id', userId)
    .gte('week_start', yearStart).lt('week_start', weekStart)
  return (data || []).reduce((s, r) => s + (Number(r.gross_pay) || 0), 0)
}

// ---- The core calculation --------------------------------------------------
// Assembles greater-of gross, then taxes + net. `frequency` from org settings.
export function computeGross(base, clockedHours, bonuses, commissions) {
  const rate = Number(base?.hourly_rate) || 0
  const payType = base?.pay_type || null

  const totalHours = clockedHours != null ? Number(clockedHours)
    : (Number(base?.hours_clocked_in) || 0)
  const otHours = base?.overtime_hours != null ? Number(base.overtime_hours) : Math.max(0, totalHours - 40)
  const regHours = Math.max(0, totalHours - otHours)
  const hourlyBase = round2(regHours * rate + otHours * rate * 1.5)

  const taskHours = Number(base?.task_hours_recorded) || 0
  const taskBonus = Number(base?.task_bonus) || 0
  const performanceBase = round2(taskHours * rate + taskBonus)

  const pieceJobs = Number(base?.piece_rate_jobs) || 0
  const pieceBase = round2(pieceJobs * rate)

  const bonusTotal = round2((bonuses || []).reduce((s, b) => s + (Number(b.bonuses_earned) || 0) * (Number(b.amount) || 0), 0))
  const commissionTotal = round2((commissions || []).reduce((s, c) => s + (Number(c.commissioned_sales) || 0) * ((Number(c.commission_pct) || 0) / 100), 0))

  let chosenMethod, chosenBase, otPremium = 0
  if (payType === 'salary') {
    const annual = Number(base?.annual_salary) || 0
    const days = Number(base?.days_clocked_in) || 0
    chosenMethod = 'salary'
    chosenBase = round2((annual / 260) * days)
  } else {
    // Greater-of: hourly floor vs the configured non-hourly method (perf or piece).
    const nonHourly = Math.max(performanceBase, pieceBase)
    const nonHourlyMethod = pieceBase > performanceBase ? 'piece' : 'performance'
    if (nonHourly > hourlyBase && nonHourly > 0) {
      chosenMethod = nonHourlyMethod
      chosenBase = nonHourly
      // FLSA: performance/piece pay is straight-time for ALL hours; OT hours still
      // owe an extra 0.5x the blended regular rate.
      if (totalHours > 40) {
        const regularRate = chosenBase / totalHours
        otPremium = round2(0.5 * regularRate * (totalHours - 40))
      }
    } else {
      chosenMethod = 'hourly'
      chosenBase = hourlyBase
    }
  }

  const gross = round2(chosenBase + otPremium + bonusTotal + commissionTotal)
  return {
    totalHours: round2(totalHours), regHours: round2(regHours), otHours: round2(otHours), rate,
    taskHours, taskBonus, hourlyBase, performanceBase, pieceBase,
    chosenMethod, chosenBase, otPremium, bonusTotal, commissionTotal, gross,
  }
}

export function computeTaxes({ gross, taxableFIT, taxableFICA, ytdBefore, frequency, filingStatus, step2Checked, sutaRate }) {
  const fitBase = taxableFIT != null ? taxableFIT : gross    // pre-tax 401(k)/125 reduce this
  const ficaBase = taxableFICA != null ? taxableFICA : gross // only Section-125-type reduce this
  const fed = computeFederalWithholding({ gross: fitBase, frequency, filingStatus, step2Checked })
  const fica = computeFICA(ficaBase, ytdBefore)
  const futa = computeFUTA(ficaBase, ytdBefore)
  const suta = round2((Number(sutaRate) || 0) * Math.min(ficaBase, Math.max(0, 7000 - ytdBefore)))
  const employeeTaxes = round2(fed.amount + fica.ssEmployee + fica.medicareEmployee + fica.addlMedicare)
  const employerTaxes = round2(fica.ssEmployer + fica.medicareEmployer + futa + suta)
  return {
    fed_income_wh: fed.amount, step2Unsupported: fed.step2Unsupported,
    ss_employee: fica.ssEmployee, ss_employer: fica.ssEmployer,
    medicare_employee: fica.medicareEmployee, medicare_employer: fica.medicareEmployer,
    addl_medicare: fica.addlMedicare, futa, suta,
    employeeTaxes, employerTaxes,
  }
}

// ---- Persistence -----------------------------------------------------------
export async function listCalcs(orgId, weekStart) {
  const { data } = await supabase
    .from('rewards_payroll_calcs').select('*').eq('org_id', orgId).eq('week_start', weekStart)
  const map = {}
  ;(data || []).forEach((c) => { map[c.week_id] = c })
  return map
}

export async function savePaycheckCalc(orgId, row) {
  return supabase
    .from('rewards_payroll_calcs')
    .upsert({ org_id: orgId, ...row, computed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'week_id,user_id' })
    .select().single()
}

export async function setCalcField(id, patch) {
  return supabase.from('rewards_payroll_calcs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

// Recent finalized runs for the payroll dashboard.
export async function recentCalcs(orgId, limit = 200) {
  const { data } = await supabase
    .from('rewards_payroll_calcs').select('*').eq('org_id', orgId)
    .order('week_start', { ascending: false }).limit(limit)
  return data || []
}
