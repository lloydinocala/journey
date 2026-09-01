// Refrigerant-HVAC · module entry point
// Self-contained: exports its own routes and nav category so App.jsx / Layout.jsx
// stay thin. Refrigerant/EPA compliance is core for HVAC work (Section 608 applies
// to everyone), so it is shown to all non-tech office roles — no entitlement gate.
import RefrigerantDashboard from './RefrigerantDashboard'
import RefrigerantLog from './RefrigerantLog'
import RefrigerantSystems from './RefrigerantSystems'
import RefrigerantCylinders from './RefrigerantCylinders'

export const REFRIGERANT_ROUTES = [
  { path: '/refrigerant', Component: RefrigerantDashboard },
  { path: '/refrigerant/log', Component: RefrigerantLog },
  { path: '/refrigerant/systems', Component: RefrigerantSystems },
  { path: '/refrigerant/cylinders', Component: RefrigerantCylinders },
]

export const REFRIGERANT_NAV = {
  key: 'refrigerant',
  label: 'Refrigerant',
  items: [
    { label: 'Refrigerant Dashboard', path: '/refrigerant' },
    { label: 'Usage Log', path: '/refrigerant/log' },
    { label: 'Systems', path: '/refrigerant/systems' },
    { label: 'Cylinders', path: '/refrigerant/cylinders' },
  ],
}
