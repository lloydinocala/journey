// Rewards-HVAC · R7 year-end forms data layer
// W-2/W-3/940 derived from rewards_payroll_calcs; 1099-NEC from rewards_1099_payments.
import { supabase } from '../../utils/supabase'

const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100
export function money(n) { return n == null || isNaN(n) ? '—' : '$' + Number(n).toFixed(2) }

export async function loadYear(orgId, year) {
  const from = `${year}-01-01`, to = `${year}-12-31`
  const [calcRes, empRes] = await Promise.all([
    supabase.from('rewards_payroll_calcs').select('*').eq('org_id', orgId).gte('week_start', from).lte('week_start', to),
    supabase.from('employees').select('id, user_id, full_name').eq('org_id', orgId),
  ])
  const emps = empRes.data || []
  const empIds = emps.map((e) => e.id)
  let hrByEmp = {}
  if (empIds.length) {
    const { data: hr } = await supabase.from('rewards_employee_hr')
      .select('employee_id, ssn_last4, home_address, work_state').eq('org_id', orgId).in('employee_id', empIds)
    ;(hr || []).forEach((h) => { hrByEmp[h.employee_id] = h })
  }
  const empByUser = {}; emps.forEach((e) => { if (e.user_id) empByUser[e.user_id] = { ...e, hr: hrByEmp[e.id] || {} } })
  return { calcs: calcRes.data || [], empByUser }
}

// Aggregate one year's calcs into per-employee W-2 boxes.
export function buildW2s(calcs, empByUser) {
  const byUser = {}
  calcs.forEach((c) => {
    const u = c.user_id
    if (!byUser[u]) byUser[u] = { user_id: u, gross: 0, pretax: 0, box2: 0, ssTax: 0, medTax: 0, addl: 0, box17: 0, code_D: 0, otPremium: 0 }
    const w = byUser[u]
    w.gross += Number(c.gross_pay) || 0
    w.pretax += Number(c.pretax_deductions) || 0
    w.box2 += Number(c.fed_income_wh) || 0
    w.ssTax += Number(c.ss_employee) || 0
    w.medTax += Number(c.medicare_employee) || 0
    w.addl += Number(c.addl_medicare) || 0
    w.box17 += Number(c.state_income_wh) || 0
    w.otPremium += Number(c.ot_premium) || 0
    ;(Array.isArray(c.deductions) ? c.deductions : []).forEach((d) => {
      if (d.pre_tax && d.category === 'retirement') w.code_D += Number(d.amount) || 0
    })
  })
  return Object.values(byUser).map((w) => {
    const emp = empByUser[w.user_id] || {}
    const box1 = round2(w.gross - w.pretax)
    const box3 = round2(w.ssTax / 0.062)     // SS wages (already wage-base capped per check)
    const box5 = round2(w.medTax / 0.0145)   // Medicare wages
    return {
      user_id: w.user_id,
      name: emp.full_name || 'Employee',
      ssn_last4: emp.hr?.ssn_last4 || '',
      state: emp.hr?.work_state || '',
      box1,
      box2: round2(w.box2),
      box3,
      box4: round2(w.ssTax),
      box5,
      box6: round2(w.medTax + w.addl),
      box12D: round2(w.code_D),
      box14_ot: round2(w.otPremium),
      box16: box1,                            // state wages ≈ federal taxable (approx)
      box17: round2(w.box17),
    }
  }).sort((a, b) => (a.name < b.name ? -1 : 1))
}

export function buildW3(w2s) {
  const t = { count: w2s.length, box1: 0, box2: 0, box3: 0, box4: 0, box5: 0, box6: 0, box12D: 0, box16: 0, box17: 0 }
  w2s.forEach((w) => { t.box1 += w.box1; t.box2 += w.box2; t.box3 += w.box3; t.box4 += w.box4; t.box5 += w.box5; t.box6 += w.box6; t.box12D += w.box12D; t.box16 += w.box16; t.box17 += w.box17 })
  Object.keys(t).forEach((k) => { if (k !== 'count') t[k] = round2(t[k]) })
  return t
}

// Form 940 (annual FUTA): taxable wages = first $7,000 per employee.
export function build940(calcs) {
  const grossByUser = {}, futaByUser = {}
  calcs.forEach((c) => {
    grossByUser[c.user_id] = (grossByUser[c.user_id] || 0) + (Number(c.gross_pay) || 0)
    futaByUser[c.user_id] = (futaByUser[c.user_id] || 0) + (Number(c.futa) || 0)
  })
  const totalPayments = round2(Object.values(grossByUser).reduce((s, v) => s + v, 0))
  const taxableFutaWages = round2(Object.values(grossByUser).reduce((s, v) => s + Math.min(v, 7000), 0))
  const overWages = round2(totalPayments - taxableFutaWages)
  const futaTax = round2(Object.values(futaByUser).reduce((s, v) => s + v, 0))
  return { line3: totalPayments, line5: overWages, line7: taxableFutaWages, line8: futaTax }
}

// ---- 1099-NEC payments -----------------------------------------------------
export async function list1099(orgId, year) {
  const { data } = await supabase.from('rewards_1099_payments').select('*').eq('org_id', orgId).eq('tax_year', year).order('payee_name')
  return data || []
}
export async function add1099(orgId, row) { return supabase.from('rewards_1099_payments').insert({ org_id: orgId, ...row }).select().single() }
export async function delete1099(id) { return supabase.from('rewards_1099_payments').delete().eq('id', id) }
