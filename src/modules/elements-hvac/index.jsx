// Elements-HVAC · module entry point
// Self-contained: exports its own routes and nav category so App.jsx / Layout.jsx stay thin.
import ElementsInventory from './ElementsInventory'
import ElementsLocations from './ElementsLocations'
import ElementsItems from './ElementsItems'
import ElementsStock from './ElementsStock'
import ElementsCycleCounts from './ElementsCycleCounts'
import ElementsReplenishment from './ElementsReplenishment'
import ElementsAnomalies from './ElementsAnomalies'
import ElementsPurchaseOrders from './ElementsPurchaseOrders'
import ElementsSpecialOrders from './ElementsSpecialOrders'
import ElementsVendorInvoices from './ElementsVendorInvoices'
import ElementsVendorCrossref from './ElementsVendorCrossref'
import ElementsServiceMap from './ElementsServiceMap'
import ElementsPartsUsed from './ElementsPartsUsed'
import ElementsUsageReport from './ElementsUsageReport'
import ElementsSettings from './ElementsSettings'
import FleetDashboard from './FleetDashboard'
import FleetVehicles from './FleetVehicles'
import FleetFuel from './FleetFuel'
import FleetMaintenance from './FleetMaintenance'
import FleetRenewals from './FleetRenewals'
import FleetRepairs from './FleetRepairs'
import FleetRoutes from './FleetRoutes'
import FleetInspections from './FleetInspections'

// Each entry rendered in App.jsx as <Route path element={<Component profile={profile} />} />
export const ELEMENTS_ROUTES = [
  { path: '/elements', Component: ElementsInventory },
  { path: '/elements/locations', Component: ElementsLocations },
  { path: '/elements/items', Component: ElementsItems },
  { path: '/elements/stock', Component: ElementsStock },
  { path: '/elements/cycle-counts', Component: ElementsCycleCounts },
  { path: '/elements/replenishment', Component: ElementsReplenishment },
  { path: '/elements/health', Component: ElementsAnomalies },
  { path: '/elements/purchasing', Component: ElementsPurchaseOrders },
  { path: '/elements/special-orders', Component: ElementsSpecialOrders },
  { path: '/elements/ap', Component: ElementsVendorInvoices },
  { path: '/elements/vendor-crossref', Component: ElementsVendorCrossref },
  { path: '/elements/service-map', Component: ElementsServiceMap },
  { path: '/elements/parts-used', Component: ElementsPartsUsed },
  { path: '/elements/usage', Component: ElementsUsageReport },
  { path: '/elements/settings', Component: ElementsSettings },
]

// Sidebar category (Layout.jsx). Shown to office roles (not techs).
export const ELEMENTS_NAV = {
  key: 'elements',
  label: 'Inventory Management',
  items: [
    { label: 'Inventory Overview', path: '/elements' },
    { label: 'Locations', path: '/elements/locations' },
    { label: 'Item Catalog', path: '/elements/items' },
    { label: 'Stock & Receiving', path: '/elements/stock' },
    { label: 'Cycle Counts', path: '/elements/cycle-counts' },
    { label: 'Replenishment', path: '/elements/replenishment' },
    { label: 'Inventory Health', path: '/elements/health' },
    { label: 'Purchase Orders', path: '/elements/purchasing' },
    { label: 'Special Orders', path: '/elements/special-orders' },
    { label: 'Vendor Invoices (A/P)', path: '/elements/ap' },
    { label: 'Vendor Cross-Reference', path: '/elements/vendor-crossref' },
    { label: 'Service → Part Mapping', path: '/elements/service-map' },
    { label: 'Record Parts Used', path: '/elements/parts-used' },
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
  { path: '/fleet/inspections', Component: FleetInspections },
]

export const ELEMENTS_FLEET_NAV = {
  key: 'fleet',
  label: 'Fleet Management',
  items: [
    { label: 'Fleet Dashboard', path: '/fleet' },
    { label: 'Vehicles', path: '/fleet/vehicles' },
    { label: 'Fuel Log', path: '/fleet/fuel' },
    { label: 'Maintenance', path: '/fleet/maintenance' },
    { label: 'Renewals', path: '/fleet/renewals' },
    { label: 'Repairs & Cost', path: '/fleet/repairs' },
    { label: 'Routes & GPS', path: '/fleet/routes' },
    { label: 'Inspections', path: '/fleet/inspections' },
  ],
}

// Assets Management — umbrella nav grouping Inventory + Fleet under one section.
// Sub-headers keep each area visually distinct within the single panel.
export const ASSETS_NAV = {
  key: 'assets',
  label: 'Assets Management',
  items: [
    { label: 'Assets Dashboard', path: '/assets' },
    { header: 'Inventory Management' },
    ...ELEMENTS_NAV.items,
    { header: 'Fleet Management' },
    ...ELEMENTS_FLEET_NAV.items,
  ],
}
