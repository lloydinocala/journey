// Elements-HVAC · Module 2 (Fleet) · data layer + flag engine
import { supabase } from '../../utils/supabase'

// ---- Vehicles -------------------------------------------------------------
export async function listVehicles(orgId, { includeInactive = false } = {}) {
  let q = supabase.from('elements_vehicles').select('*').eq('org_id', orgId).order('name')
  if (!includeInactive) q = q.eq('is_active', true)
  const { data } = await q
  return data || []
}

export async function addVehicle(orgId, row) {
  return supabase.from('elements_vehicles').insert({ org_id: orgId, ...row }).select().single()
}

export async function updateVehicle(id, patch) {
  return supabase.from('elements_vehicles').update(patch).eq('id', id)
}

// Trucks from the inventory module, to link a vehicle to its stocking location
export async function listTrucks(orgId) {
  const { data } = await supabase
    .from('elements_locations')
    .select('id, name, assigned_user_id')
    .eq('org_id', orgId).eq('type', 'truck').eq('is_active', true).order('name')
  return data || []
}

// ---- Fuel -----------------------------------------------------------------
export async function listFuel(orgId, vehicleId = null) {
  let q = supabase.from('elements_fuel_logs').select('*').eq('org_id', orgId)
  if (vehicleId) q = q.eq('vehicle_id', vehicleId)
  const { data } = await q.order('fill_date', { ascending: true }).order('created_at', { ascending: true })
  return data || []
}

export async function addFuel(orgId, row) {
  return supabase.from('elements_fuel_logs').insert({ org_id: orgId, ...row }).select().single()
}

export async function importFuel(orgId, rows) {
  // rows: array of fuel_log payloads (already mapped). Returns {inserted, error}.
  const payload = rows.map((r) => ({ org_id: orgId, source: 'import', ...r }))
  const { data, error } = await supabase.from('elements_fuel_logs').insert(payload).select('id')
  return { inserted: data?.length || 0, error }
}

// ---- Meters ---------------------------------------------------------------
export async function listMeters(orgId, vehicleId = null) {
  let q = supabase.from('elements_vehicle_meters').select('*').eq('org_id', orgId)
  if (vehicleId) q = q.eq('vehicle_id', vehicleId)
  const { data } = await q.order('reading_date', { ascending: true })
  return data || []
}

export async function addMeter(orgId, row) {
  return supabase.from('elements_vehicle_meters').insert({ org_id: orgId, ...row }).select().single()
}

// ---- Flag engine ----------------------------------------------------------
export const FLAG_COLORS = { red: '#DC2626', amber: '#B8720A' }

// Given a vehicle and its fuel logs (ascending), return each fill enriched with
// derived cpg/mpg/cpm and any flags. Pure function — no I/O.
export function computeFuelMetrics(vehicle, fuelAsc) {
  const out = []
  let prevOdo = null
  const priorCpg = []
  for (const f of fuelAsc) {
    const gallons = Number(f.gallons) || 0
    const cost = f.total_cost != null ? Number(f.total_cost) : null
    const odo = f.odometer != null ? Number(f.odometer) : null
    const cpg = cost != null && gallons > 0 ? cost / gallons : null
    let miles = null
    if (odo != null && prevOdo != null && odo > prevOdo) miles = odo - prevOdo
    const mpg = miles != null && gallons > 0 ? miles / gallons : null
    const cpm = miles != null && cost != null && miles > 0 ? cost / miles : null

    const flags = []
    if (vehicle?.tank_capacity_gal && gallons > Number(vehicle.tank_capacity_gal)) {
      flags.push({ code: 'exceeds_tank', color: 'red', label: `Fill ${gallons.toFixed(1)} gal exceeds ${Number(vehicle.tank_capacity_gal)} gal tank` })
    }
    if (mpg != null && vehicle?.expected_mpg_low && mpg < Number(vehicle.expected_mpg_low)) {
      flags.push({ code: 'low_mpg', color: 'red', label: `Low MPG (${mpg.toFixed(1)} < ${Number(vehicle.expected_mpg_low)})` })
    }
    if (mpg != null && vehicle?.expected_mpg_high && mpg > Number(vehicle.expected_mpg_high)) {
      flags.push({ code: 'high_mpg', color: 'amber', label: `Unusually high MPG (${mpg.toFixed(1)}) — check odometer` })
    }
    if (odo == null) {
      flags.push({ code: 'no_odometer', color: 'amber', label: 'No odometer — MPG can’t be computed' })
    }
    if (cpg != null && priorCpg.length >= 2) {
      const avg = priorCpg.reduce((s, x) => s + x, 0) / priorCpg.length
      if (avg > 0 && cpg > avg * 1.25) {
        flags.push({ code: 'price_spike', color: 'amber', label: `Price spike ($${cpg.toFixed(2)}/gal vs $${avg.toFixed(2)} avg)` })
      }
    }

    out.push({ ...f, cpg, mpg, cpm, miles, flags })
    if (odo != null) prevOdo = odo
    if (cpg != null) priorCpg.push(cpg)
  }
  return out
}

// Odometer-reading flags from the meter series (ascending)
export function computeMeterFlags(metersAsc, weeklyCeiling = 1500) {
  const out = []
  let prev = null
  for (const m of metersAsc) {
    const reading = Number(m.reading)
    const flags = []
    if (prev != null && reading < prev) flags.push({ code: 'reading_dropped', color: 'red', label: 'Reading lower than previous' })
    if (prev != null && reading - prev > weeklyCeiling) flags.push({ code: 'big_jump', color: 'amber', label: `Large jump (+${Math.round(reading - prev)})` })
    out.push({ ...m, flags })
    prev = reading
  }
  return out
}

// ---- Preventive maintenance -----------------------------------------------
export async function listPmSchedules(orgId, vehicleId = null) {
  let q = supabase.from('elements_pm_schedules').select('*').eq('org_id', orgId)
  if (vehicleId) q = q.eq('vehicle_id', vehicleId)
  const { data } = await q.eq('is_active', true).order('task_name')
  return data || []
}
export async function addPmSchedule(orgId, row) {
  return supabase.from('elements_pm_schedules').insert({ org_id: orgId, ...row }).select().single()
}
export async function updatePmSchedule(id, patch) {
  return supabase.from('elements_pm_schedules').update(patch).eq('id', id)
}
export async function archivePmSchedule(id) {
  return supabase.from('elements_pm_schedules').update({ is_active: false }).eq('id', id)
}
export async function addServiceRecord(orgId, row) {
  return supabase.from('elements_service_records').insert({ org_id: orgId, ...row }).select().single()
}
// Log a completed service: writes history + resets the schedule baseline.
export async function completePm(orgId, sch, { odometer, date, description, cost }) {
  await addServiceRecord(orgId, {
    vehicle_id: sch.vehicle_id, pm_schedule_id: sch.id,
    service_date: date, odometer: odometer ?? null,
    description: description || sch.task_name, total_cost: cost ?? null,
  })
  return updatePmSchedule(sch.id, { last_done_meter: odometer ?? sch.last_done_meter, last_done_date: date })
}

// ---- Renewals -------------------------------------------------------------
export async function listRenewals(orgId, vehicleId = null) {
  let q = supabase.from('elements_renewals').select('*').eq('org_id', orgId)
  if (vehicleId) q = q.eq('vehicle_id', vehicleId)
  const { data } = await q.eq('is_active', true).order('due_date')
  return data || []
}
export async function addRenewal(orgId, row) {
  return supabase.from('elements_renewals').insert({ org_id: orgId, ...row }).select().single()
}
export async function updateRenewal(id, patch) {
  return supabase.from('elements_renewals').update(patch).eq('id', id)
}
export async function archiveRenewal(id) {
  return supabase.from('elements_renewals').update({ is_active: false }).eq('id', id)
}

// ---- Date + status helpers ------------------------------------------------
export function todayStr() { return new Date().toISOString().slice(0, 10) }
function parseDay(s) { return new Date(s + 'T00:00:00') }
function addDays(s, n) { const d = parseDay(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function daysBetween(fromStr, toStr) { return Math.round((parseDay(toStr) - parseDay(fromStr)) / 86400000) }

// Latest odometer per vehicle across fuel fills + meter readings (max value)
export function computeLatestOdometers(fuel, meters) {
  const map = {}
  const bump = (vid, val) => { if (val != null && (map[vid] == null || val > map[vid])) map[vid] = val }
  fuel.forEach((f) => bump(f.vehicle_id, f.odometer != null ? Number(f.odometer) : null))
  meters.forEach((m) => bump(m.vehicle_id, Number(m.reading)))
  return map
}
export async function latestOdometersByVehicle(orgId) {
  const [fuel, meters] = await Promise.all([listFuel(orgId), listMeters(orgId)])
  return computeLatestOdometers(fuel, meters)
}

export function pmStatus(sch, currentMeter, today = todayStr()) {
  const interval = Number(sch.interval_value)
  const thr = sch.due_soon_threshold != null ? Number(sch.due_soon_threshold) : null
  if (sch.interval_type === 'days') {
    if (!sch.last_done_date) return { state: 'unknown', color: 'amber', label: 'Set a last-done date' }
    const due = addDays(sch.last_done_date, interval)
    const remaining = daysBetween(today, due)
    const soon = thr != null ? thr : Math.max(7, Math.round(interval * 0.1))
    if (remaining < 0) return { state: 'overdue', color: 'red', label: `Overdue ${Math.abs(remaining)}d`, due }
    if (remaining <= soon) return { state: 'due_soon', color: 'amber', label: `Due in ${remaining}d`, due }
    return { state: 'ok', color: null, label: `Due ${due}`, due }
  }
  const unit = sch.interval_type === 'hours' ? 'h' : 'mi'
  if (sch.last_done_meter == null || currentMeter == null) return { state: 'unknown', color: 'amber', label: 'Need odometer baseline' }
  const dueAt = Number(sch.last_done_meter) + interval
  const remaining = dueAt - Number(currentMeter)
  const soon = thr != null ? thr : Math.max(500, Math.round(interval * 0.1))
  if (remaining <= 0) return { state: 'overdue', color: 'red', label: `Overdue ${Math.round(-remaining).toLocaleString()} ${unit}`, dueAt }
  if (remaining <= soon) return { state: 'due_soon', color: 'amber', label: `Due in ${Math.round(remaining).toLocaleString()} ${unit}`, dueAt }
  return { state: 'ok', color: null, label: `Due at ${Math.round(dueAt).toLocaleString()} ${unit}`, dueAt }
}

export function renewalStatus(r, today = todayStr()) {
  const remaining = daysBetween(today, r.due_date)
  const soon = Number(r.due_soon_days ?? 30)
  if (remaining < 0) return { state: 'overdue', color: 'red', label: `Overdue ${Math.abs(remaining)}d` }
  if (remaining <= soon) return { state: 'due_soon', color: 'amber', label: `Due in ${remaining}d` }
  return { state: 'ok', color: null, label: `Due ${r.due_date}` }
}

const RENEWAL_LABELS = { registration: 'Registration', insurance: 'Insurance', inspection: 'Inspection', other: 'Other' }
export const renewalName = (r) => (r.renewal_type === 'other' ? (r.label || 'Other') : RENEWAL_LABELS[r.renewal_type] || r.renewal_type)

// ---- Repairs / issues (2c) ------------------------------------------------
export async function listIssues(orgId, vehicleId = null, { openOnly = false } = {}) {
  let q = supabase.from('elements_vehicle_issues').select('*').eq('org_id', orgId)
  if (vehicleId) q = q.eq('vehicle_id', vehicleId)
  if (openOnly) q = q.neq('status', 'resolved')
  const { data } = await q.order('reported_date', { ascending: false })
  return data || []
}
export async function addIssue(orgId, row) {
  return supabase.from('elements_vehicle_issues').insert({ org_id: orgId, ...row }).select().single()
}
export async function updateIssue(id, patch) {
  return supabase.from('elements_vehicle_issues').update(patch).eq('id', id)
}
export async function listServiceRecords(orgId, vehicleId = null) {
  let q = supabase.from('elements_service_records').select('*').eq('org_id', orgId)
  if (vehicleId) q = q.eq('vehicle_id', vehicleId)
  const { data } = await q.order('service_date', { ascending: false })
  return data || []
}
// Log a repair: writes a service record (record_type 'repair') and resolves the
// linked issue if any.
export async function logRepair(orgId, r) {
  const total = (Number(r.labor_cost) || 0) + (Number(r.parts_cost) || 0)
  const { data: rec, error } = await addServiceRecord(orgId, {
    vehicle_id: r.vehicle_id, issue_id: r.issue_id || null, record_type: 'repair',
    service_date: r.service_date, odometer: r.odometer ?? null,
    description: r.description || null, vendor_id: r.vendor_id || null,
    labor_cost: r.labor_cost ?? null, parts_cost: r.parts_cost ?? null,
    total_cost: total || null, downtime_hours: r.downtime_hours ?? null,
  })
  if (error) return { error }
  if (r.issue_id) await updateIssue(r.issue_id, { status: 'resolved', resolved_service_record_id: rec.id })
  return { rec }
}
export function costRollup(serviceRecords) {
  const by = {}
  serviceRecords.forEach((s) => {
    const g = by[s.vehicle_id] = by[s.vehicle_id] || { totalCost: 0, downtime: 0, count: 0 }
    g.totalCost += Number(s.total_cost) || 0
    g.downtime += Number(s.downtime_hours) || 0
    g.count += 1
  })
  return by
}
const SEVERITY_COLOR = { critical: 'red', high: 'red', medium: 'amber', low: 'amber' }

// ---- Route mileage / GPS (2a.2) -------------------------------------------
export async function listRouteDays(orgId, sinceIso = null) {
  let q = supabase.from('elements_route_days').select('*').eq('org_id', orgId)
  if (sinceIso) q = q.gte('day', sinceIso)
  const { data } = await q.order('day', { ascending: false })
  return data || []
}

// Miles-driven (odometer delta from fuel) vs miles-explained (job routes) per
// vehicle over a trailing window — the core honest-use analysis.
export async function routeAnalysis(orgId, days = 30) {
  const since = new Date(); since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString().slice(0, 10)
  const [vehicles, routeDays, fuel, gpsRes] = await Promise.all([
    listVehicles(orgId),
    listRouteDays(orgId, sinceIso),
    listFuel(orgId),
    supabase.from('elements_vehicle_gps').select('user_id, captured_at').eq('org_id', orgId).gte('captured_at', sinceIso + 'T00:00:00'),
  ])
  const explBy = {}
  routeDays.forEach((r) => { explBy[r.vehicle_id] = (explBy[r.vehicle_id] || 0) + (Number(r.explained_miles) || 0) })
  const odoBy = {}
  fuel.forEach((f) => { if (f.fill_date >= sinceIso && f.odometer != null) (odoBy[f.vehicle_id] = odoBy[f.vehicle_id] || []).push(Number(f.odometer)) })
  const drivenBy = {}
  Object.entries(odoBy).forEach(([vid, arr]) => { drivenBy[vid] = Math.max(...arr) - Math.min(...arr) })
  const crumbByUser = {}
  ;(gpsRes.data || []).forEach((g) => { crumbByUser[g.user_id] = (crumbByUser[g.user_id] || 0) + 1 })

  return vehicles.map((v) => {
    const explained = explBy[v.id] != null ? explBy[v.id] : null
    const driven = drivenBy[v.id] != null ? drivenBy[v.id] : null
    const crumbs = v.assigned_user_id ? (crumbByUser[v.assigned_user_id] || 0) : 0
    let flag = null
    if (driven != null && explained != null && explained > 0 && driven > explained * 1.2 + 50) {
      flag = { color: 'red', label: `Drove ~${Math.round(driven)} mi; jobs explain ~${Math.round(explained)} mi` }
    }
    return { vehicle: v, explained, driven, gap: (driven != null && explained != null) ? driven - explained : null, crumbs, flag }
  })
}

// Roll everything up per vehicle for the Fleet Dashboard.
export async function dashboardData(orgId) {
  const [vehicles, fuel, meters, pms, renewals, issues] = await Promise.all([
    listVehicles(orgId), listFuel(orgId), listMeters(orgId), listPmSchedules(orgId), listRenewals(orgId),
    listIssues(orgId, null, { openOnly: true }),
  ])
  const fuelBy = {}, meterBy = {}, pmBy = {}, renBy = {}, issueBy = {}
  fuel.forEach((f) => { (fuelBy[f.vehicle_id] = fuelBy[f.vehicle_id] || []).push(f) })
  meters.forEach((m) => { (meterBy[m.vehicle_id] = meterBy[m.vehicle_id] || []).push(m) })
  pms.forEach((p) => { (pmBy[p.vehicle_id] = pmBy[p.vehicle_id] || []).push(p) })
  renewals.forEach((r) => { (renBy[r.vehicle_id] = renBy[r.vehicle_id] || []).push(r) })
  issues.forEach((i) => { (issueBy[i.vehicle_id] = issueBy[i.vehicle_id] || []).push(i) })
  const latestOdo = computeLatestOdometers(fuel, meters)
  const today = todayStr()

  return vehicles.map((v) => {
    const fm = computeFuelMetrics(v, fuelBy[v.id] || [])
    const mm = computeMeterFlags(meterBy[v.id] || [])
    const last = fm[fm.length - 1] || null
    const cpgVals = fm.map((x) => x.cpg).filter((x) => x != null)
    const avgCpg = cpgVals.length ? cpgVals.reduce((s, x) => s + x, 0) / cpgVals.length : null
    const flags = [...fm.flatMap((x) => x.flags), ...mm.flatMap((x) => x.flags)]

    // maintenance + renewal flags
    ;(pmBy[v.id] || []).forEach((p) => {
      const st = pmStatus(p, latestOdo[v.id] ?? null, today)
      if (st.state === 'overdue') flags.push({ code: 'pm_overdue', color: 'red', label: `${p.task_name}: overdue` })
      else if (st.state === 'due_soon') flags.push({ code: 'pm_due', color: 'amber', label: `${p.task_name}: ${st.label.toLowerCase()}` })
    })
    ;(renBy[v.id] || []).forEach((r) => {
      const st = renewalStatus(r, today)
      if (st.state === 'overdue') flags.push({ code: 'renewal_overdue', color: 'red', label: `${renewalName(r)}: overdue` })
      else if (st.state === 'due_soon') flags.push({ code: 'renewal_due', color: 'amber', label: `${renewalName(r)}: ${st.label.toLowerCase()}` })
    })
    ;(issueBy[v.id] || []).forEach((i) => {
      flags.push({ code: 'open_issue', color: SEVERITY_COLOR[i.severity] || 'amber', label: `Open issue: ${(i.description || '').slice(0, 40)}` })
    })

    return {
      vehicle: v,
      latestOdometer: latestOdo[v.id] ?? null,
      lastMpg: last?.mpg ?? null,
      avgCpg,
      lastFillDate: last?.fill_date ?? null,
      redFlags: flags.filter((f) => f.color === 'red').length,
      amberFlags: flags.filter((f) => f.color === 'amber').length,
      flags,
    }
  })
}
