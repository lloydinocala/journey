// Where a user can choose to land when they open the app. Per-user preference,
// stored on users.default_landing. Empty path = fall back to the role default.
// The Train Station will be added here once its route exists.
export const LANDING_OPTIONS = [
  { path: '', label: 'Company home (default for your role)' },
  { path: '/call', label: 'Call Console' },
  { path: '/dispatch-map', label: 'Dispatch Map' },
  { path: '/calendar', label: 'Calendar' },
  { path: '/jobs-management', label: 'Jobs' },
  { path: '/financials', label: 'Financials / A/R' },
  { path: '/maintenance-dashboard', label: 'Maintenance' },
  { path: '/permits', label: 'Permitting' },
  { path: '/to-do', label: 'To-Do List' },
]
export const LANDING_PATHS = new Set(LANDING_OPTIONS.map((o) => o.path).filter(Boolean))
