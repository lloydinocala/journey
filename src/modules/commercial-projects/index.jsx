// Commercial Projects · module entry point
// Self-contained: exports its own routes and nav items so App.jsx / Layout.jsx
// stay thin. Gated by the 'commercial_projects' entitlement (add-on).
import CommercialDashboard from './CommercialDashboard'
import CommercialProjectList from './CommercialProjectList'
import CommercialProject from './CommercialProject'
import PayApplications from './PayApplications'
import PayAppEditor from './PayAppEditor'

export const COMMERCIAL_FEATURE = 'commercial_projects'

export const COMMERCIAL_ROUTES = [
  { path: '/commercial', Component: CommercialDashboard },
  { path: '/commercial/projects', Component: CommercialProjectList },
  { path: '/commercial/projects/:id', Component: CommercialProject },
  { path: '/commercial/pay-apps', Component: PayApplications },
  { path: '/commercial/pay-apps/:id', Component: PayAppEditor },
]

export const COMMERCIAL_NAV_ITEMS = [
  { label: 'Commercial Dashboard', path: '/commercial' },
  { label: 'Commercial Project List', path: '/commercial/projects' },
  { label: 'Pay Applications', path: '/commercial/pay-apps' },
]
