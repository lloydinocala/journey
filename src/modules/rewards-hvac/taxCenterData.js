// Rewards-HVAC · Tax Center logic (R3)
// Derives the quarantine set-aside, deposit calendar, and Form 941 figures from
// rewards_payroll_calcs. Path B: we compute what's owed and when — the contractor
// pays the IRS directly from their own account. We never hold funds.
import { supabase } from '../../utils/supabase'

const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100
export function money(n) { return n == null || isNaN(n) ? '—' : '$' + Number(n).toFixed(2) }

function parseDate(s) { return new Date(s + 'T00:00:00') }
function fmt(d) {
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}
function payDateOf(c) { return c.week_end || c.week_start }

// The 941 (trust-fund + matching) deposit amount for one paycheck.
export function deposit941Of(c) {
  return round2((Number(c.fed_income_wh) || 0)
    + (Number(c.ss_employee) || 0) + (Number(c.ss_employer) || 0)
    + (Number(c.medicare_employee) || 0) + (Number(c.medicare_employer) || 0)
    + (Number(c.addl_medicare) || 0))
}

// ---- Data load -------------------------------------------------------------
export async function loadCalcs(orgId, { from, to } = {}) {
  let q = supabase.from('rewards_payroll_calcs').select('*').eq('org_id', orgId)
  if (from) q = q.gte('week_start', from)
  if (to) q = q.lte('week_start', to)
  const { data } = await q.order('week_start', { ascending: true })
  return data || []
}

// ---- Summaries -------------------------------------------------------------
export function summarize(calcs) {
  const s = { count: calcs.length, gross: 0, net: 0, fedWH: 0, ssEmp: 0, ssEr: 0, medEmp: 0, medEr: 0, addl: 0, futa: 0, suta: 0, empTax: 0, erTax: 0, dep941: 0 }
  calcs.forEach((c) => {
    s.gross += Number(c.gross_pay) || 0
    s.net += Number(c.net_pay) || 0
    s.fedWH += Number(c.fed_income_wh) || 0
    s.ssEmp += Number(c.ss_employee) || 0; s.ssEr += Number(c.ss_employer) || 0
    s.medEmp += Number(c.medicare_employee) || 0; s.medEr += Number(c.medicare_employer) || 0
    s.addl += Number(c.addl_medicare) || 0
    s.futa += Number(c.futa) || 0; s.suta += Number(c.suta) || 0
    s.empTax += Number(c.employee_taxes) || 0; s.erTax += Number(c.employer_taxes) || 0
    s.dep941 += deposit941Of(c)
  })
  Object.keys(s).forEach((k) => { if (k !== 'count') s[k] = round2(s[k]) })
  // Total to quarantine = everything owed to the government for these runs.
  s.setAside = round2(s.empTax + s.ssEr + s.medEr + s.futa + s.suta)
  return s
}

// ---- Deposit calendar ------------------------------------------------------
// Monthly depositor: all 941 taxes for a month are due the 15th of the next month.
// Semiweekly: Wed–Fri paydays due the following Wed; Sat–Tue due the following Fri.
function nextDow(from, targetDow) {
  const d = new Date(from); let add = (targetDow - d.getDay() + 7) % 7
  if (add === 0) add = 7
  d.setDate(d.getDate() + add); return d
}
export function buildDepositCalendar(calcs, scheduleType = 'monthly') {
  const groups = {}
  calcs.forEach((c) => {
    const pd = parseDate(payDateOf(c))
    let label, due, ps, pe
    if (scheduleType === 'semiweekly') {
      const dow = pd.getDay()
      const dueDow = (dow >= 3 && dow <= 5) ? 3 : 5   // Wed group -> Wed(3); else Fri(5)
      due = nextDow(pd, dueDow)
      label = fmt(pd)         // one obligation per payday
      ps = pe = fmt(pd)
    } else {
      const y = pd.getFullYear(), m = pd.getMonth()
      label = `${y}-${String(m + 1).padStart(2, '0')}`
      due = new Date(y, m + 1, 15)
      ps = fmt(new Date(y, m, 1)); pe = fmt(new Date(y, m + 1, 0))
    }
    const key = label
    if (!groups[key]) groups[key] = { kind: '941', period_label: label, period_start: ps, period_end: pe, due_date: fmt(due), amount: 0 }
    groups[key].amount = round2(groups[key].amount + deposit941Of(c))
  })
  return Object.values(groups).sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
}

// FUTA is deposited quarterly when accrued > $500 (else carried/paid with the 940).
export function buildFutaDeposits(calcs) {
  const q = {}
  calcs.forEach((c) => {
    const pd = parseDate(payDateOf(c))
    const quarter = Math.floor(pd.getMonth() / 3) + 1
    const y = pd.getFullYear()
    const key = `${y}-Q${quarter}`
    const dueMonth = quarter * 3         // Mar/Jun/Sep/Dec index+1; due last day of NEXT month
    const due = new Date(y, dueMonth, 0) // last day of the quarter-end month... adjust below
    // Due the last day of the month AFTER the quarter ends (Apr 30, Jul 31, Oct 31, Jan 31)
    const dueDate = new Date(y, dueMonth + 1, 0)
    if (!q[key]) q[key] = { kind: 'futa', period_label: key, due_date: fmt(dueDate), amount: 0 }
    q[key].amount = round2(q[key].amount + (Number(c.futa) || 0))
  })
  return Object.values(q).sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
}

// ---- Form 941 (quarterly) --------------------------------------------------
export function build941(calcs, year, quarter) {
  const inQ = calcs.filter((c) => {
    const pd = parseDate(payDateOf(c))
    return pd.getFullYear() === year && Math.floor(pd.getMonth() / 3) + 1 === quarter
  })
  const s = summarize(inQ)
  const ssTax = round2(s.ssEmp + s.ssEr)
  const medTax = round2(s.medEmp + s.medEr)
  const ssWages = round2(ssTax / 0.124)
  const medWages = round2(medTax / 0.029)
  const line6 = round2(s.fedWH + ssTax + medTax + s.addl)
  const employees = new Set(inQ.map((c) => c.user_id)).size
  return {
    year, quarter, count: inQ.length, employees,
    line1: employees,               // # employees
    line2: s.gross,                 // wages, tips, other comp
    line3: s.fedWH,                 // federal income tax withheld
    line5a_wages: ssWages, line5a_tax: ssTax,
    line5c_wages: medWages, line5c_tax: medTax,
    line5d_tax: s.addl,
    line5e: round2(ssTax + medTax + s.addl),
    line6, // total taxes before adjustments
    depositsMade: 0, // filled from rewards_deposits later
    summary: s,
  }
}

// ---- Accountant export (CSV) ----------------------------------------------
export function exportCsv(calcs, nameByUser = {}) {
  const cols = ['week_start', 'week_end', 'employee', 'chosen_method', 'gross_pay', 'fed_income_wh', 'ss_employee', 'medicare_employee', 'addl_medicare', 'employee_taxes', 'ss_employer', 'medicare_employer', 'futa', 'suta', 'net_pay', 'delivery_mode']
  const head = cols.join(',')
  const rows = calcs.map((c) => cols.map((k) => {
    if (k === 'employee') return '"' + (nameByUser[c.user_id] || c.user_id) + '"'
    const v = c[k]
    return v == null ? '' : (typeof v === 'string' ? '"' + v.replace(/"/g, '""') + '"' : v)
  }).join(','))
  return [head, ...rows].join('\n')
}

// ---- Persistence: set-aside + deposit confirmations ------------------------
export async function listSetAsides(orgId) {
  const { data } = await supabase.from('rewards_tax_setasides').select('*').eq('org_id', orgId)
  const map = {}; (data || []).forEach((r) => { map[r.period_start] = r }); return map
}
export async function confirmSetAside(orgId, row) {
  return supabase.from('rewards_tax_setasides').upsert(
    { org_id: orgId, ...row, confirmed_at: new Date().toISOString() }, { onConflict: 'org_id,period_start' }
  ).select().single()
}
export async function listDeposits(orgId) {
  const { data } = await supabase.from('rewards_deposits').select('*').eq('org_id', orgId)
  const map = {}; (data || []).forEach((r) => { map[r.kind + ':' + r.period_label] = r }); return map
}
export async function markDepositPaid(orgId, dep, confirmation) {
  return supabase.from('rewards_deposits').upsert({
    org_id: orgId, kind: dep.kind, period_label: dep.period_label,
    period_start: dep.period_start || null, period_end: dep.period_end || null,
    due_date: dep.due_date, amount: dep.amount, status: 'paid',
    paid_at: new Date().toISOString(), confirmation: confirmation || null, method: 'guided',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id,kind,period_label' }).select().single()
}

// ---- Worker classification (1099 vs W-2) ----------------------------------
// Each question: answering "yes" points toward employee (W-2) control.
export const CLASSIFICATION_QUESTIONS = [
  { key: 'instructions', text: 'Do you control when, where, and how they do the work?', cat: 'Behavioral' },
  { key: 'training', text: 'Do you train them in your methods/procedures?', cat: 'Behavioral' },
  { key: 'tools', text: 'Do you provide the tools, materials, and equipment?', cat: 'Financial' },
  { key: 'expenses', text: 'Do you reimburse their business expenses?', cat: 'Financial' },
  { key: 'noloss', text: 'Are they shielded from profit/loss (paid regardless)?', cat: 'Financial' },
  { key: 'hourly', text: 'Do you pay by the hour/week rather than by the job/invoice?', cat: 'Financial' },
  { key: 'ongoing', text: 'Is the relationship ongoing/indefinite (not a single project)?', cat: 'Relationship' },
  { key: 'core', text: 'Is their work a core part of your regular business (installs/service)?', cat: 'Relationship' },
  { key: 'exclusive', text: 'Do they work only for you (not offering services to others)?', cat: 'Relationship' },
  { key: 'benefits', text: 'Do you provide benefits (PTO, insurance) or a set schedule?', cat: 'Relationship' },
]
export function scoreClassification(answers) {
  const yes = CLASSIFICATION_QUESTIONS.filter((q) => answers[q.key] === true).length
  let risk, determination
  if (yes >= 6) { risk = 'high'; determination = 'likely_w2' }
  else if (yes >= 3) { risk = 'medium'; determination = 'review' }
  else { risk = 'low'; determination = 'likely_1099' }
  return { employee_score: yes, risk, determination }
}
export async function saveClassification(orgId, row) {
  return supabase.from('rewards_classification_checks').insert({ org_id: orgId, ...row }).select().single()
}
export async function listClassifications(orgId) {
  const { data } = await supabase.from('rewards_classification_checks').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
  return data || []
}
