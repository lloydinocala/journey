import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import AnnouncementBanner from './AnnouncementBanner'
import ClockWidget from './ClockWidget'
import ClockInPrompt from './ClockInPrompt'
import { ELEMENTS_NAV, ELEMENTS_FLEET_NAV } from './modules/elements-hvac'

const CATEGORIES = [
  { key: 'operations', label: 'Operations', items: [
    { label: 'Calendar', path: '/calendar' },
    { label: 'Jobs', path: '/jobs' },
    { label: 'Jobs Management', path: '/jobs-management' },
    { label: 'Vendors', path: '/vendors' },
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
    { label: 'Payroll Capture', path: '/payroll' },
    { label: 'Time Clock', path: '/time-clock' },
    { label: 'Sign-In Log', path: '/session-log' },
    { label: 'Settings', path: '/settings' },
  ]},
  { key: 'import', label: 'Bulk Import', items: [
    { label: 'Import Customers', path: '/import/customers' },
    { label: 'Import Properties', path: '/import/properties' },
    { label: 'Import Jobs', path: '/import/jobs' },
    { label: 'Import Services Pricebook', path: '/import/services-pricebook' },
    { label: 'Import Systems Pricebook', path: '/import/systems-pricebook' },
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
  if (pathname.startsWith('/team') || pathname.startsWith('/settings') || pathname.startsWith('/session-log')) return 'admin'
  if (pathname.startsWith('/elements')) return 'elements'
  if (pathname.startsWith('/fleet')) return 'fleet'
  if (pathname.startsWith('/import')) return 'import'
  if (pathname.startsWith('/organizations') || pathname.startsWith('/announcements')) return 'platform'
  return null
}

export default function Layout({ profile }) {
  const location = useLocation()
  const isSuperAdmin = profile?.role === 'super_admin'
  // Elements-HVAC appears only for the platform owner or an entitled subscriber.
  const showElements = profile?.role !== 'tech' && (isSuperAdmin || profile?.elementsEntitled)
  const baseCategories = showElements ? [...CATEGORIES, ELEMENTS_NAV, ELEMENTS_FLEET_NAV] : CATEGORIES
  const allCategories = isSuperAdmin ? [...baseCategories, PLATFORM_CATEGORY] : baseCategories

  const [expandedCategory, setExpandedCategory] = useState(getCategoryForPath(location.pathname))
  const [logoutShiftId, setLogoutShiftId] = useState(null)  // open shift id when logging out
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const cat = getCategoryForPath(location.pathname)
    if (cat) setExpandedCategory(cat)
  }, [location.pathname])

  async function handleLogout() {
    // If they're clocked in (open shift), show a colorful prompt offering to
    // clock out too — catches the common forgotten-clock-out at end of day.
    try {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData?.user?.id
      if (uid) {
        const { data: openShifts } = await supabase
          .from('time_clock_events')
          .select('id')
          .eq('user_id', uid)
          .is('clock_out', null)
          .limit(1)
        if (openShifts && openShifts.length > 0) {
          setLogoutShiftId(openShifts[0].id)  // open the styled modal; it finishes logout
          return
        }
      }
    } catch (e) { /* don't block sign-out on a clock hiccup */ }
    finishLogout(false, null)
  }

  async function finishLogout(alsoClockOut, shiftId) {
    setLoggingOut(true)
    try {
      if (alsoClockOut && shiftId) {
        // End any open break first, then close the shift.
        const { data: openBreaks } = await supabase
          .from('clock_breaks')
          .select('id')
          .eq('clock_event_id', shiftId)
          .is('break_end', null)
          .limit(1)
        if (openBreaks && openBreaks.length > 0) {
          await supabase.from('clock_breaks').update({ break_end: new Date().toISOString() }).eq('id', openBreaks[0].id)
        }
        await supabase.from('time_clock_events').update({ clock_out: new Date().toISOString() }).eq('id', shiftId)
      }
    } catch (e) { /* ignore clock hiccup */ }

    const { data } = await supabase.auth.getUser()
    if (data?.user) {
      await supabase.from('session_log').insert({
        org_id: profile?.org_id || null,
        user_id: data.user.id,
        event: 'sign_out',
        source: 'desktop',
      })
    }
    await supabase.auth.signOut()
    try {
      Object.keys(sessionStorage).forEach((k) => { if (k.startsWith('clockPromptSeen:')) sessionStorage.removeItem(k) })
    } catch (e) { /* ignore */ }
  }

  const activeCategoryData = allCategories.find((c) => c.key === expandedCategory)

  return (
    <div className="app-shell-v2">
      <ClockInPrompt profile={profile} />
      {logoutShiftId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', zIndex: 4500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 0, maxWidth: 440, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ background: '#B00020', color: '#fff', padding: '18px 24px', fontSize: 20, fontWeight: 800, textAlign: 'center' }}>
              ⏱ You're still clocked in
            </div>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ color: '#334155', marginTop: 0, marginBottom: 24, fontSize: 15 }}>
                You're about to sign out but you haven't clocked out. Do you want to clock out now too?
              </p>
              <button
                onClick={async () => { await finishLogout(true, logoutShiftId); setLogoutShiftId(null) }}
                disabled={loggingOut}
                style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: '#B00020', color: '#fff', fontWeight: 800, fontSize: 17, cursor: 'pointer', marginBottom: 10 }}
              >
                {loggingOut ? 'Clocking out…' : 'Yes — Clock Out & Sign Out'}
              </button>
              <button
                onClick={async () => { await finishLogout(false, logoutShiftId); setLogoutShiftId(null) }}
                disabled={loggingOut}
                style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #CBD5E1', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                No — Stay Clocked In, Just Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
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
          {!isSuperAdmin && profile?.id && profile?.org_id && (
            <div style={{ marginBottom: 12 }}>
              <ClockWidget userId={profile.id} orgId={profile.org_id} variant="desktop" />
            </div>
          )}
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
