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

// Roll everything up per vehicle for the Fleet Dashboard.
export async function dashboardData(orgId) {
  const [vehicles, fuel, meters] = await Promise.all([
    listVehicles(orgId),
    listFuel(orgId),
    listMeters(orgId),
  ])
  const fuelBy = {}, meterBy = {}
  fuel.forEach((f) => { (fuelBy[f.vehicle_id] = fuelBy[f.vehicle_id] || []).push(f) })
  meters.forEach((m) => { (meterBy[m.vehicle_id] = meterBy[m.vehicle_id] || []).push(m) })

  return vehicles.map((v) => {
    const fm = computeFuelMetrics(v, fuelBy[v.id] || [])
    const mm = computeMeterFlags(meterBy[v.id] || [])
    const last = fm[fm.length - 1] || null
    // latest odometer across fuel + meter readings
    const odoCandidates = [
      ...(fuelBy[v.id] || []).filter((f) => f.odometer != null).map((f) => ({ v: Number(f.odometer), d: f.fill_date })),
      ...(meterBy[v.id] || []).map((m) => ({ v: Number(m.reading), d: m.reading_date })),
    ].sort((a, b) => (a.d < b.d ? 1 : -1))
    const cpgVals = fm.map((x) => x.cpg).filter((x) => x != null)
    const avgCpg = cpgVals.length ? cpgVals.reduce((s, x) => s + x, 0) / cpgVals.length : null
    const flags = [...fm.flatMap((x) => x.flags), ...mm.flatMap((x) => x.flags)]
    return {
      vehicle: v,
      latestOdometer: odoCandidates[0]?.v ?? null,
      lastMpg: last?.mpg ?? null,
      avgCpg,
      lastFillDate: last?.fill_date ?? null,
      redFlags: flags.filter((f) => f.color === 'red').length,
      amberFlags: flags.filter((f) => f.color === 'amber').length,
      flags,
    }
  })
}
