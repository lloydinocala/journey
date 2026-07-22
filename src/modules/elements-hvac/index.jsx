// Elements-HVAC · module entry point
// Self-contained: exports its own routes and nav category so App.jsx / Layout.jsx stay thin.
import ElementsInventory from './ElementsInventory'
import ElementsLocations from './ElementsLocations'
import ElementsItems from './ElementsItems'
import ElementsServiceMap from './ElementsServiceMap'
import ElementsUsageReport from './ElementsUsageReport'
import ElementsSettings from './ElementsSettings'

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
    { label: 'Service → SKU Mapping', path: '/elements/service-map' },
    { label: 'Parts Usage', path: '/elements/usage' },
    { label: 'Inventory Settings', path: '/elements/settings' },
  ],
}
