import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import AnnouncementBanner from './AnnouncementBanner'

const CATEGORIES = [
  { key: 'operations', label: 'Operations', items: [
    { label: 'Calendar', path: '/calendar' },
    { label: 'Jobs', path: '/jobs' },
    { label: 'Properties', path: '/properties' },
    { label: 'Customers', path: '/customers' },
    { label: 'Maintenance Agreements', path: '/maintenance-agreements' },
    { label: 'Job Estimates', path: '/estimates' },
  ]},
  { key: 'financials', label: 'Financials', items: [
    { label: 'Invoices', path: '/invoices' },
    { label: 'Pricebook', path: '/pricebook' },
    { label: 'Systems Pricebook', path: '/systems-pricebook' },
    { label: 'Maintenance Tiers', path: '/maintenance-tiers' },
  ]},
  { key: 'admin', label: 'Admin', items: [
    { label: 'Team', path: '/team' },
    { label: 'Settings', path: '/settings' },
  ]},
]

const PLATFORM_CATEGORY = { key: 'platform', label: 'Platform', items: [
  { label: 'Organizations', path: '/organizations' },
  { label: 'Announcements', path: '/announcements' },
]}

function getCategoryForPath(pathname) {
  if (pathname === '/') return null
  if (pathname.startsWith('/calendar') || pathname.startsWith('/jobs') || pathname.startsWith('/properties') || pathname.startsWith('/customers') || pathname.startsWith('/maintenance-agreements')) return 'operations'
  if (pathname.startsWith('/invoice') || pathname.startsWith('/pricebook') || pathname.startsWith('/systems-pricebook') || pathname.startsWith('/maintenance-tiers')) return 'financials'
  if (pathname.startsWith('/estimate')) return 'operations'
  if (pathname.startsWith('/team') || pathname.startsWith('/settings')) return 'admin'
  if (pathname.startsWith('/organizations') || pathname.startsWith('/announcements')) return 'platform'
  return null
}

export default function Layout({ profile }) {
  const location = useLocation()
  const isSuperAdmin = profile?.role === 'super_admin'
  const allCategories = isSuperAdmin ? [...CATEGORIES, PLATFORM_CATEGORY] : CATEGORIES

  const [expandedCategory, setExpandedCategory] = useState(getCategoryForPath(location.pathname))

  useEffect(() => {
    const cat = getCategoryForPath(location.pathname)
    if (cat) setExpandedCategory(cat)
  }, [location.pathname])

  async function handleLogout() {
    const { data } = await supabase.auth.getUser()
    if (data?.user && profile?.org_id) {
      await supabase.from('session_log').insert({
        org_id: profile.org_id,
        user_id: data.user.id,
        event: 'sign_out',
        source: 'desktop',
      })
    }
    await supabase.auth.signOut()
  }

  const activeCategoryData = allCategories.find((c) => c.key === expandedCategory)

  return (
    <div className="app-shell-v2">
      <AnnouncementBanner profile={profile} />
      <div className="shell-body">
        <div className="sidebar-rail">
          <div className="rail-brand">Journey<br />HVAC</div>
          <Link to="/" className={'rail-item' + (location.pathname === '/' ? ' active' : '')}>
            Home
          </Link>
          {allCategories.map((cat) => (
            <button
              key={cat.key}
              className={'rail-item' + (expandedCategory === cat.key ? ' active' : '')}
              onClick={() => setExpandedCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
          <div className="rail-spacer" />
          {isSuperAdmin && <span className="badge" style={{ marginBottom: 12 }}>Super Admin</span>}
          <button className="rail-item" onClick={() => window.location.reload(true)}>Refresh</button>
          <button className="rail-item" onClick={handleLogout}>Sign out</button>
        </div>

        {activeCategoryData && (
          <div className="sidebar-panel">
            <h3>{activeCategoryData.label}</h3>
            {activeCategoryData.items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={'sidebar-panel-link' + (location.pathname.startsWith(item.path) ? ' active' : '')}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}

        <div className="main-content-area">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
