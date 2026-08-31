// Dashboard-HVAC · measure catalog. Curated definitions the subscriber will
// eventually compose from; for P0 they drive the default board. Each measure
// declares its label, unit, RPC, whether it takes a date range, its default
// visualization, an optional target, and where clicking drills to.
export const MEASURES = {
  sales: { label: 'Sales', sub: 'Invoiced revenue', unit: 'currency', rpc: 'dash_sales', dated: true, viz: 'tile', drill: '/invoices' },
  recurring: { label: 'Recurring revenue', sub: 'Agreement run-rate / mo', unit: 'currency', rpc: 'dash_recurring_revenue', dated: false, viz: 'tile', drill: '/maintenance-agreements' },
  outstanding_est: { label: 'Outstanding estimates', sub: 'Unsold pipeline', unit: 'currency', rpc: 'dash_outstanding_estimates', dated: false, viz: 'tile', drill: '/estimates' },
  jobs_per_tech_day: { label: 'Jobs / tech / day', sub: 'Completed, working days', unit: 'number', rpc: 'dash_jobs_per_tech_day', dated: true, viz: 'tile', drill: '/jobs-management' },
  gross_margin: { label: 'Gross margin', sub: 'Floor 60%', unit: 'percent', rpc: 'dash_gross_margin', dated: true, viz: 'gauge', target: 60, targetDir: 'floor', drill: '/invoices' },
  revenue_by_tech: { label: 'Revenue by tech', sub: 'Performing tech', unit: 'currency', rpc: 'dash_revenue_by_tech', dated: true, viz: 'bars', drill: '/jobs-management' },
  revenue_by_type: { label: 'Revenue by job type', sub: 'Service / install / maintenance', unit: 'currency', rpc: 'dash_revenue_by_job_type', dated: true, viz: 'bars', drill: '/jobs-management' },
  est_presented_sold: { label: 'Estimates: presented vs. sold', sub: 'This period', unit: 'currency', rpc: 'dash_estimates_presented_sold', dated: true, viz: 'estimates', drill: '/estimates' },
}

// The immutable default board: order + tile size (1 or 2 grid columns).
export const DEFAULT_TEMPLATE = [
  { key: 'sales', w: 1 },
  { key: 'recurring', w: 1 },
  { key: 'outstanding_est', w: 1 },
  { key: 'jobs_per_tech_day', w: 1 },
  { key: 'gross_margin', w: 1 },
  { key: 'revenue_by_tech', w: 2 },
  { key: 'revenue_by_type', w: 2 },
  { key: 'est_presented_sold', w: 2 },
]
