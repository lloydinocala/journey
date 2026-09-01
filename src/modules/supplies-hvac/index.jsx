// Supplies-HVAC · module entry point
// Self-contained: exports its own routes and nav category. Supplies are a core
// office convenience (expendables you buy but don't inventory), shown to all
// non-tech roles — no entitlement gate.
import SuppliesCatalog from './SuppliesCatalog'
import SuppliesReorder from './SuppliesReorder'
import SuppliesPurchases from './SuppliesPurchases'

export const SUPPLIES_ROUTES = [
  { path: '/supplies', Component: SuppliesCatalog },
  { path: '/supplies/reorder', Component: SuppliesReorder },
  { path: '/supplies/purchases', Component: SuppliesPurchases },
]

export const SUPPLIES_NAV = {
  key: 'supplies',
  label: 'Supplies',
  items: [
    { label: 'Supplies Catalog', path: '/supplies' },
    { label: 'Reorder List', path: '/supplies/reorder' },
    { label: 'Purchases', path: '/supplies/purchases' },
  ],
}
