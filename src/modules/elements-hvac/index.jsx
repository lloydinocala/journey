// Elements-HVAC · module entry point
// Self-contained: exports its own routes and nav category so App.jsx / Layout.jsx stay thin.
import ElementsInventory from './ElementsInventory'
import ElementsLocations from './ElementsLocations'
import ElementsItems from './ElementsItems'
import ElementsServiceMap from './ElementsServiceMap'
import ElementsUsageReport from './ElementsUsageReport'
import ElementsSettings from './ElementsSettings'
import FleetDashboard from './FleetDashboard'
import FleetVehicles from './FleetVehicles'
import FleetFuel from './FleetFuel'
import FleetMaintenance from './FleetMaintenance'
import FleetRenewals from './FleetRenewals'
import FleetRepairs from './FleetRepairs'
import FleetRoutes from './FleetRoutes'

// Each entry rendered in App.jsx as <Route path element={<Component profile={profile} />} />
export const ELEMENTS_ROUTES = [
  { path: '/elements', Component: ElementsInventory },
  { path: '/elements/locations', Component: ElementsLocations },
  { path: '/elements/items', Component: ElementsItems },
  { path: '/elements/service-map', Component: ElementsServiceMap },
  { path: '/elements/usage', Component: ElementsUsageReport },
  { path: '/elements/settings', Component: ElementsSettings },
]

// Sidebar category (Layout.jsx). Shown to office roles (not techs).
export const ELEMENTS_NAV = {
  key: 'elements',
  label: 'Elements · Inventory',
  items: [
    { label: 'Inventory Overview', path: '/elements' },
    { label: 'Locations', path: '/elements/locations' },
    { label: 'Item Catalog', path: '/elements/items' },
    { label: 'Service → Part Mapping', path: '/elements/service-map' },
    { label: 'Parts Usage', path: '/elements/usage' },
    { label: 'Inventory Settings', path: '/elements/settings' },
  ],
}

// Fleet (Module 2) — same self-contained pattern, same entitlement gate.
export const ELEMENTS_FLEET_ROUTES = [
  { path: '/fleet', Component: FleetDashboard },
  { path: '/fleet/vehicles', Component: FleetVehicles },
  { path: '/fleet/fuel', Component: FleetFuel },
  { path: '/fleet/maintenance', Component: FleetMaintenance },
  { path: '/fleet/renewals', Component: FleetRenewals },
  { path: '/fleet/repairs', Component: FleetRepairs },
  { path: '/fleet/routes', Component: FleetRoutes },
]

export const ELEMENTS_FLEET_NAV = {
  key: 'fleet',
  label: 'Elements · Fleet',
  items: [
    { label: 'Fleet Dashboard', path: '/fleet' },
    { label: 'Vehicles', path: '/fleet/vehicles' },
    { label: 'Fuel Log', path: '/fleet/fuel' },
    { label: 'Maintenance', path: '/fleet/maintenance' },
    { label: 'Renewals', path: '/fleet/renewals' },
    { label: 'Repairs & Cost', path: '/fleet/repairs' },
    { label: 'Routes & GPS', path: '/fleet/routes' },
  ],
}
