// Marketing-HVAC · module entry point
// Self-contained: exports its own routes and nav category so App.jsx / Layout.jsx stay thin.
import MarketingCommand from './MarketingCommand'
import MarketingQueue from './MarketingQueue'
import MarketingChannels from './MarketingChannels'
import MarketingReviews from './MarketingReviews'

// Each entry rendered in App.jsx as <Route path element={<Component profile={profile} />} />
export const MARKETING_ROUTES = [
  { path: '/marketing', Component: MarketingCommand },
  { path: '/marketing/queue', Component: MarketingQueue },
  { path: '/marketing/channels', Component: MarketingChannels },
  { path: '/marketing/reviews', Component: MarketingReviews },
]

// Sidebar category (Layout.jsx). Shown to office roles (not techs).
export const MARKETING_NAV = {
  key: 'marketing',
  label: 'Marketing',
  items: [
    { label: 'Command Center', path: '/marketing' },
    { label: 'Approval Queue', path: '/marketing/queue' },
    { label: 'Channels & Assets', path: '/marketing/channels' },
    { label: 'Reviews', path: '/marketing/reviews' },
  ],
}
