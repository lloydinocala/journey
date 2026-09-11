// ============================================================================
//  SIGNAL REGISTRY — one declaration per task signal, for the whole app.
//  A "signal" is a unit of work that needs attention (a count that should drop
//  to zero when handled). Every station and every hub is just a *lens* over this
//  list: a station renders the signals tagged to it; a hub rolls up every signal
//  tagged to it. Change a rule here once and it updates everywhere it appears.
//
//  Each signal: { key, station, hub, name, tone, href, cta, audience, line, count }
//    station  — the sub-station domain it belongs to (dispatch, work, fleet, ...)
//    hub      — the hub it rolls up to (start, inventory-central, command-center, workforce)
//    audience — 'office' (a task) | 'operational' (a health flag) | 'owner' (dollars)
//    count    — async (org, cache) => number   (cache memoizes heavy per-load fetches)
// ============================================================================
import { supabase } from '../utils/supabase'
import { listReplenishment } from '../modules/elements-hvac/data'
import { toolsDashboardData } from '../modules/elements-hvac/toolsData'
import { dashboardData as fleetDashboardData } from '../modules/elements-hvac/fleetData'
import { dashboardData as refrigerantDashboardData } from '../modules/refrigerant-hvac/refrigerantData'

const DAY = 864e5
const d30 = () => new Date(Date.now() - 30 * DAY).toISOString()
const d7 = () => new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10)

// Per-load memoization so a domain helper (fleet/tools/refrigerant) runs ONCE
// even when several signals read from it.
function memo(cache, key, fn) { if (!cache[key]) cache[key] = fn(); return cache[key] }
const toolsData = (org, c) => memo(c, 'tools:' + org, () => toolsDashboardData(org))
const fleetData = (org, c) => memo(c, 'fleet:' + org, () => fleetDashboardData(org))
const refrigData = (org, c) => memo(c, 'refrig:' + org, () => refrigerantDashboardData(org))
const replenData = (org, c) => memo(c, 'replen:' + org, () => listReplenishment(org))

// A simple org-scoped head-count query builder.
const headCount = (table, build) => async (org) => {
  let q = supabase.from(table).select('*', { count: 'exact', head: true }).eq('org_id', org)
  if (build) q = build(q)
  const { count, error } = await q
  return error ? null : (count || 0)
}

// ---- two-step / computed counts (kept identical to their station's logic) ----
async function needsDispatch(org) {
  const { data: jobs } = await supabase.from('jobs').select('id').eq('org_id', org).eq('status', 'scheduled')
  const ids = (jobs || []).map((j) => j.id)
  if (!ids.length) return 0
  const { data: a } = await supabase.from('job_technicians').select('job_id').in('job_id', ids)
  const assigned = new Set((a || []).map((x) => x.job_id))
  return ids.filter((id) => !assigned.has(id)).length
}
async function completedNotInvoiced(org) {
  const { data: jobs } = await supabase.from('jobs').select('id').eq('org_id', org).eq('status', 'completed').is('deleted_at', null)
  const ids = (jobs || []).map((j) => j.id)
  if (!ids.length) return 0
  const { data: inv } = await supabase.from('invoices').select('job_id').eq('kind', 'invoice').is('deleted_at', null).in('job_id', ids)
  const invoiced = new Set((inv || []).map((i) => i.job_id))
  return ids.filter((id) => !invoiced.has(id)).length
}
async function postjobCount(org) {
  const { data: jobs } = await supabase.from('jobs').select('property_id').eq('org_id', org).eq('status', 'completed').gte('completed_at', d30()).not('property_id', 'is', null)
  const propIds = [...new Set((jobs || []).map((j) => j.property_id))]
  if (!propIds.length) return 0
  const { count } = await supabase.from('property_maintenance_status').select('*', { count: 'exact', head: true }).eq('org_id', org).in('property_id', propIds).not('status', 'in', '("active","opted_out")')
  return count || 0
}

export const REGISTRY = [
  // ========================= TRAIN STATION (hub: start) =====================
  // --- Dispatch ---
  { key: 'service-requests', station: 'dispatch', hub: 'start', name: 'New service requests', tone: 'amber', href: '/service-requests', cta: 'Triage requests', audience: 'office',
    line: (n) => `${n} request${n === 1 ? '' : 's'} to review & book`,
    count: headCount('service_requests', (q) => q.eq('status', 'pending')) },
  { key: 'jobs-to-schedule', station: 'dispatch', hub: 'start', name: 'Jobs to schedule', tone: 'amber', href: '/calendar', cta: 'Open calendar', audience: 'office',
    line: (n) => `${n} approved job${n === 1 ? '' : 's'} not on the board`,
    count: headCount('jobs', (q) => q.eq('status', 'unscheduled')) },
  { key: 'needs-dispatch', station: 'dispatch', hub: 'start', name: 'Needs dispatch', tone: 'amber', href: '/dispatch-map', cta: 'Open dispatch map', audience: 'office',
    line: (n) => `${n} scheduled job${n === 1 ? '' : 's'} with no tech assigned`,
    count: (org) => needsDispatch(org) },
  { key: 'filter-orders', station: 'dispatch', hub: 'start', name: 'Filter orders to fulfill', tone: 'amber', href: '/filter-orders', cta: 'Open filter orders', audience: 'office',
    line: (n) => `${n} filter order${n === 1 ? '' : 's'} awaiting fulfillment`,
    count: headCount('invoices', (q) => q.eq('is_filter_order', true).eq('is_archived', false).is('deleted_at', null).is('filter_fulfilled_at', null)) },
  { key: 'todos', station: 'dispatch', hub: 'start', name: 'To-Dos', tone: 'amber', href: '/to-do', cta: 'Open to-dos', audience: 'office',
    line: (n) => `${n} open office to-do${n === 1 ? '' : 's'}`,
    count: headCount('office_reminders', (q) => q.eq('done', false)) },

  // --- Jobs & Customers (work) ---
  { key: 'completed-not-invoiced', station: 'work', hub: 'start', name: 'Completed — needs invoicing', tone: 'red', href: '/jobs', cta: 'Open jobs', audience: 'office',
    line: (n) => `${n} finished job${n === 1 ? '' : 's'} not yet billed`,
    count: (org) => completedNotInvoiced(org) },
  { key: 'invoices-to-send', station: 'work', hub: 'start', name: 'Invoices to send', tone: 'amber', href: '/invoices', cta: 'Open invoices', audience: 'office',
    line: (n) => `${n} invoice${n === 1 ? '' : 's'} created, not sent`,
    count: headCount('invoices', (q) => q.eq('kind', 'invoice').not('is_filter_order', 'is', true).is('deleted_at', null).is('sent_at', null)) },
  { key: 'unpaid-invoices', station: 'work', hub: 'start', name: 'Unpaid invoices', tone: 'amber', href: '/invoices', cta: 'Open invoices', audience: 'office',
    line: (n) => `${n} sent, still unpaid`,
    count: headCount('invoices', (q) => q.eq('kind', 'invoice').not('is_filter_order', 'is', true).is('deleted_at', null).not('sent_at', 'is', null).is('paid_at', null)) },
  { key: 'estimates-to-convert', station: 'work', hub: 'start', name: 'Estimates to convert', tone: 'amber', href: '/estimates', cta: 'Open estimates', audience: 'office',
    line: (n) => `${n} approved, not yet turned into a job`,
    count: headCount('invoices', (q) => q.eq('kind', 'estimate').ilike('approval_status', 'approved').is('spawned_job_id', null).is('converted_to_job_id', null).is('deleted_at', null).eq('is_archived', false)) },
  { key: 'estimates-out', station: 'work', hub: 'start', name: 'Estimates out', tone: 'amber', href: '/estimates', cta: 'Open estimates', audience: 'office',
    line: (n) => `${n} sent, awaiting a customer decision`,
    count: headCount('invoices', (q) => q.eq('kind', 'estimate').not('sent_at', 'is', null).is('deleted_at', null).eq('is_archived', false).or('approval_status.eq.Pending,approval_status.is.null')) },

  // --- Maintenance ---
  { key: 'maint-lapsed', station: 'maintenance', hub: 'start', name: 'Win back lapsed plans', tone: 'red', href: '/maintenance-station', cta: 'Win them back', audience: 'office',
    line: (n) => `${n} had a plan, none active now`,
    count: headCount('property_maintenance_status', (q) => q.eq('status', 'lapsed')) },
  { key: 'maint-offered', station: 'maintenance', hub: 'start', name: 'Follow up on offers', tone: 'amber', href: '/maintenance-station', cta: 'Open nurture list', audience: 'office',
    line: (n) => `${n} offered, awaiting a decision`,
    count: headCount('property_maintenance_status', (q) => q.eq('status', 'offered')) },
  { key: 'maint-postjob', station: 'maintenance', hub: 'start', name: 'Offer a plan after service', tone: 'amber', href: '/maintenance-station', cta: 'Review jobs', audience: 'office',
    line: (n) => `${n} recent job${n === 1 ? '' : 's'} with no plan on file`,
    count: (org) => postjobCount(org) },
  { key: 'maint-filters-due', station: 'maintenance', hub: 'start', name: 'Filters to ship', tone: 'amber', href: '/filter-subscriptions', cta: 'Open subscriptions', audience: 'office',
    line: (n) => `${n} filter subscription${n === 1 ? '' : 's'} due to ship`,
    count: headCount('filter_subscriptions', (q) => q.eq('status', 'active').lte('next_ship_date', d7())) },
  { key: 'maint-visits-due', station: 'maintenance', hub: 'start', name: 'Visits to book', tone: 'amber', href: '/maintenance-dashboard', cta: 'Open maintenance', audience: 'office',
    line: (n) => `${n} maintenance visit${n === 1 ? '' : 's'} due`,
    count: headCount('maintenance_visits', (q) => q.eq('status', 'due')) },

  // --- Permitting --- (approved-start / awaiting-inspection / failed are multi-query;
  //     they get added when the Permits station is migrated onto the registry.)
  { key: 'permit-in-progress', station: 'permitting', hub: 'start', name: 'In progress', tone: 'amber', href: '/permits', cta: 'Resume', audience: 'office',
    line: (n) => `${n} permit package${n === 1 ? '' : 's'} mid-workflow`,
    count: headCount('permit_packages', (q) => q.eq('status', 'in_progress')) },

  // --- 608 Refrigeration Compliance ---
  { key: 'ref-over-threshold', station: 'refrigerant', hub: 'start', name: 'Systems over leak threshold', tone: 'red', href: '/refrigerant/log', cta: 'Record a repair', audience: 'office',
    line: (n) => `${n} covered system${n === 1 ? '' : 's'} \u2014 repair within 30 days`,
    count: async (org, c) => { const d = await refrigData(org, c); return d?.overThresholdCount || 0 } },
  { key: 'ref-reclaim', station: 'refrigerant', hub: 'start', name: 'Cylinders awaiting reclaim', tone: 'amber', href: '/refrigerant/cylinders', cta: 'Open cylinders', audience: 'office',
    line: (n) => `${n} recovered \u2014 send to reclaim or disposal`,
    count: async (org, c) => { const d = await refrigData(org, c); return d?.awaitingReclaimCount || 0 } },

  // ==================== INVENTORY CENTRAL (hub: inventory-central) ===========
  // --- Stock & Purchasing ---
  { key: 'stock-reorder', station: 'stock-purchasing', hub: 'inventory-central', name: 'Reorder \u2014 low stock', tone: 'red', href: '/elements/replenishment', cta: 'Open replenishment', audience: 'office',
    line: (n) => `${n} item${n === 1 ? '' : 's'} at or under reorder point`,
    count: async (org, c) => { const r = await replenData(org, c); return (r || []).length } },
  { key: 'stock-open-po', station: 'stock-purchasing', hub: 'inventory-central', name: 'Open POs to receive', tone: 'amber', href: '/elements/purchasing', cta: 'Open purchase orders', audience: 'office',
    line: (n) => `${n} PO${n === 1 ? '' : 's'} awaiting receipt`,
    count: headCount('elements_purchase_orders', (q) => q.eq('status', 'ordered').is('received_at', null)) },

  // --- Fleet --- (inspections / insurance-docs split come with the Fleet migration)
  { key: 'fleet-flags', station: 'fleet', hub: 'inventory-central', name: 'Vehicle flags', tone: 'amber', href: '/fleet/vehicles', cta: 'Open vehicles', audience: 'office',
    line: (n) => `${n} vehicle flag${n === 1 ? '' : 's'} \u2014 fuel, MPG, meter, PM`,
    count: async (org, c) => { const rows = await fleetData(org, c); return (rows || []).reduce((s, v) => s + (v.redFlags || 0) + (v.amberFlags || 0), 0) } },

  // --- Tools ---
  { key: 'tools-maint', station: 'tools', hub: 'inventory-central', name: 'Tools need maintenance', tone: 'red', href: '/tools/maintenance', cta: 'Open maintenance', audience: 'office',
    line: (n) => `${n} tool${n === 1 ? '' : 's'} flagged on inspection`,
    count: async (org, c) => { const d = await toolsData(org, c); return d?.flaggedCount || 0 } },
  { key: 'tools-followup', station: 'tools', hub: 'inventory-central', name: 'Tool follow-up overdue', tone: 'red', href: '/tools/maintenance', cta: 'Open maintenance', audience: 'office',
    line: (n) => `${n} past anticipated return`,
    count: async (org, c) => { const d = await toolsData(org, c); return d?.followUpCount || 0 } },
  { key: 'tools-rentals', station: 'tools', hub: 'inventory-central', name: 'Rentals overdue', tone: 'red', href: '/tools/orders', cta: 'Open orders', audience: 'office',
    line: (n) => `${n} past return-by date`,
    count: async (org, c) => { const d = await toolsData(org, c); return d?.rentalsOverdueCount || 0 } },
  { key: 'tools-reconcile', station: 'tools', hub: 'inventory-central', name: 'Tool charges to reconcile', tone: 'amber', href: '/tools/reconcile', cta: 'Open reconcile', audience: 'office',
    line: (n) => `${n} unmatched card charge${n === 1 ? '' : 's'}`,
    count: async (org, c) => { const d = await toolsData(org, c); return d?.unreconciledChargeCount || 0 } },
  { key: 'tools-onorder', station: 'tools', hub: 'inventory-central', name: 'Tools on order', tone: 'amber', href: '/tools/orders', cta: 'Open orders', audience: 'office',
    line: (n) => `${n} PO${n === 1 ? '' : 's'} awaiting receipt`,
    count: async (org, c) => { const d = await toolsData(org, c); return d?.onOrderCount || 0 } },

  // --- Insights & Planning / Supplies: no task signals yet (built later) ---

  // ==================== COMMAND CENTER (hub: command-center) = Marketing =====
  { key: 'marketing-review', station: 'marketing', hub: 'command-center', name: 'Marketing to review', tone: 'amber', href: '/marketing/queue', cta: 'Open queue', audience: 'office',
    line: (n) => `${n} item${n === 1 ? '' : 's'} pending your review`,
    count: headCount('marketing_content_items', (q) => q.eq('status', 'pending_review')) },

  // ==================== WORKFORCE (hub: workforce) — signals added at Workforce build ===
]
