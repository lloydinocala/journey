// Payroll helpers that pull numbers the office would otherwise type by hand.
// Both are SUGGESTIONS: Payroll Capture shows them with a "Use" button — nothing is written
// into a pay record until someone clicks it.
import { supabase } from './utils/supabase'

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const dayList = (from, to) => {
  const out = []; const d = new Date(from + 'T12:00:00'); const end = new Date(to + 'T12:00:00')
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
  return out
}
const isWeekday = (iso) => { const g = new Date(iso + 'T12:00:00').getDay(); return g >= 1 && g <= 5 }

// Approved paid time off that falls inside the pay period, per user.
// A request's hours are spread evenly over its weekdays (or over every day, if it's
// weekend-only), so a request that crosses two pay periods is split between them.
export async function loadPtoHours(orgId, periodStart, periodEnd) {
  const { data } = await supabase.from('rewards_pto_requests')
    .select('start_date, end_date, hours, employees!inner(user_id)')
    .eq('org_id', orgId).eq('status', 'approved').lte('start_date', periodEnd).gte('end_date', periodStart)
  const byUser = {}
  for (const r of data || []) {
    const uid = r.employees?.user_id; if (!uid) continue
    const all = dayList(r.start_date, r.end_date)
    const work = all.filter(isWeekday).length ? all.filter(isWeekday) : all
    const per = (Number(r.hours) || 0) / (work.length || 1)
    const inside = work.filter((d) => d >= periodStart && d <= periodEnd).length
    const hrs = round2(per * inside)
    if (!hrs) continue
    const u = byUser[uid] || (byUser[uid] = { hours: 0, items: [] })
    u.hours = round2(u.hours + hrs)
    u.items.push({ start: r.start_date, end: r.end_date, hours: hrs })
  }
  return byUser
}

// Task hours earned from COMPLETED jobs in the pay period: each invoice line's pricebook
// task hours × quantity. When several techs worked a job, its hours are split evenly
// between them. Custom lines (not from the pricebook) carry no task hours and are counted
// so the office can review them.
export async function loadTaskHoursFromJobs(orgId, periodStart, periodEnd) {
  const { data: jobs } = await supabase.from('jobs')
    .select('id, job_number, segment, job_date, job_technicians(user_id)')
    .eq('org_id', orgId).eq('status', 'completed').is('deleted_at', null)
    .gte('job_date', periodStart).lte('job_date', periodEnd)
  const list = (jobs || []).filter((j) => (j.job_technicians || []).length)
  if (!list.length) return {}
  const { data: invs } = await supabase.from('invoices').select('id, job_id')
    .eq('org_id', orgId).eq('kind', 'invoice').is('deleted_at', null).in('job_id', list.map((j) => j.id))
  const invByJob = {}; (invs || []).forEach((i) => { (invByJob[i.job_id] = invByJob[i.job_id] || []).push(i.id) })
  const invIds = (invs || []).map((i) => i.id)
  const { data: lines } = invIds.length
    ? await supabase.from('invoice_line_items').select('invoice_id, quantity, service_price_id, is_custom').in('invoice_id', invIds)
    : { data: [] }
  const priceIds = [...new Set((lines || []).map((l) => l.service_price_id).filter(Boolean))]
  const { data: prices } = priceIds.length
    ? await supabase.from('service_prices').select('id, task_hours').in('id', priceIds)
    : { data: [] }
  const th = {}; (prices || []).forEach((p) => { th[p.id] = Number(p.task_hours) || 0 })

  const byUser = {}
  for (const j of list) {
    const ids = new Set(invByJob[j.id] || [])
    let hours = 0, custom = 0
    for (const l of lines || []) {
      if (!ids.has(l.invoice_id)) continue
      if (l.service_price_id) hours += (th[l.service_price_id] || 0) * (Number(l.quantity) || 1)
      else custom++
    }
    const techs = [...new Set(j.job_technicians.map((t) => t.user_id))]
    const share = round2(hours / techs.length)
    for (const uid of techs) {
      const u = byUser[uid] || (byUser[uid] = { hours: 0, jobs: [] })
      u.hours = round2(u.hours + share)
      u.jobs.push({ job: j.job_number + (j.segment > 1 ? '-' + j.segment : ''), date: j.job_date, hours: share, split: techs.length, custom, noInvoice: !ids.size })
    }
  }
  return byUser
}
