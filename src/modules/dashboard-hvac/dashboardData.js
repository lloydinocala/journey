// Dashboard-HVAC · data layer. Thin wrappers over the aggregation RPCs, which
// return tidy [{ bucket, value }] rows and enforce org access server-side.
import { supabase } from '../../utils/supabase'
import { dashboardData as fleetBoard } from '../elements-hvac/fleetData'

export async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) { console.warn('[dashboard] rpc', name, error.message); return [] }
  return data || []
}

// Fuel/mileage flags reuse the Fleet Dashboard's per-vehicle flag computation
// (MPG out of range, price spike, tank overfill, odometer anomalies).
const FUEL_CODES = new Set(['exceeds_tank', 'low_mpg', 'high_mpg', 'no_odometer', 'price_spike', 'reading_dropped', 'big_jump'])
export async function fetchFuelFlags(org) {
  if (!org) return []
  let rows = []
  try { rows = await fleetBoard(org) } catch (e) { return [] }
  const out = []
  rows.forEach((r) => (r.flags || []).forEach((f) => {
    if (FUEL_CODES.has(f.code)) out.push({ bucket: `${r.vehicle?.name || 'Vehicle'}: ${f.label}`, value: f.color === 'red' ? 2 : 1 })
  }))
  return out.sort((a, b) => b.value - a.value)
}

// Date helpers -------------------------------------------------------------
const iso = (d) => {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return t.toISOString().slice(0, 10)
}
export function periodRange(key, base = new Date()) {
  const y = base.getFullYear(), m = base.getMonth()
  if (key === 'last30') { const s = new Date(base); s.setDate(s.getDate() - 29); return { start: iso(s), end: iso(base) } }
  if (key === 'quarter') { const qs = Math.floor(m / 3) * 3; return { start: iso(new Date(y, qs, 1)), end: iso(base) } }
  if (key === 'ytd') return { start: iso(new Date(y, 0, 1)), end: iso(base) }
  // default: month to date
  return { start: iso(new Date(y, m, 1)), end: iso(base) }
}
export const PERIODS = [['mtd', 'This month'], ['last30', 'Last 30 days'], ['quarter', 'This quarter'], ['ytd', 'Year to date']]

// Composable query for the builder: any base measure × breakdown.
export const queryKpi = (org, measure, dim, range) =>
  rpc('dash_query', { p_org: org, p_measure: measure, p_dimension: dim, p_start: range.start, p_end: range.end })

// Saved layout (P2). A per-org working copy of the board's widget list. No row
// means the org is on the code default (DEFAULT_TEMPLATE); resetting deletes the
// row so the org falls back to the default again. RLS keeps writes to designers.
export async function getLayout(org) {
  if (!org) return null
  const { data, error } = await supabase
    .from('dashboard_layouts')
    .select('widgets')
    .eq('org_id', org)
    .maybeSingle()
  if (error) { console.warn('[dashboard] getLayout', error.message); return null }
  return data?.widgets || null
}
export async function saveLayout(org, widgets) {
  if (!org) return
  const { error } = await supabase
    .from('dashboard_layouts')
    .upsert({ org_id: org, widgets, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
  if (error) console.warn('[dashboard] saveLayout', error.message)
}
export async function resetLayout(org) {
  if (!org) return
  const { error } = await supabase.from('dashboard_layouts').delete().eq('org_id', org)
  if (error) console.warn('[dashboard] resetLayout', error.message)
}

// Fetch one measure's rows for an org + range, per its catalog entry.
export async function fetchMeasure(def, org, range) {
  if (!org) return []
  if (def.custom === 'fuel_flags') return fetchFuelFlags(org)
  const args = def.dated ? { p_org: org, p_start: range.start, p_end: range.end } : { p_org: org }
  return rpc(def.rpc, args)
}

// Value formatting ---------------------------------------------------------
export function fmt(unit, v) {
  const n = Number(v)
  if (v == null || isNaN(n)) return '—'
  if (unit === 'currency') return '$' + Math.round(n).toLocaleString('en-US')
  if (unit === 'percent') return (Math.round(n * 10) / 10) + '%'
  return (Math.round(n * 100) / 100).toLocaleString('en-US')
}
