import { Outlet, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import AnnouncementBanner from './AnnouncementBanner'

export default function Layout({ profile }) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="app-shell">
      <AnnouncementBanner profile={profile} />
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <h1 className="wordmark" style={{ fontSize: 22, margin: 0 }}>Journey</h1>
          {profile?.role === 'super_admin' && <span className="badge">Super Admin</span>}
          <Link to="/" className="nav-link">Dashboard</Link>
          <Link to="/customers" className="nav-link">Customers</Link>
          <Link to="/properties" className="nav-link">Properties</Link>
          <Link to="/jobs" className="nav-link">Jobs</Link>
          <Link to="/settings" className="nav-link">Settings</Link>
          <Link to="/team" className="nav-link">Team</Link>
          <Link to="/calendar" className="nav-link">Calendar</Link>
          <Link to="/invoices" className="nav-link">Invoices</Link>
          <Link to="/pricebook" className="nav-link">Pricebook</Link>
          {profile?.role === 'super_admin' && (
            <Link to="/organizations" className="nav-link">Organizations</Link>
          )}
          {profile?.role === 'super_admin' && (
            <Link to="/announcements" className="nav-link">Announcements</Link>
          )}
        </div>
        <button className="logout-button" onClick={handleLogout}>Sign out</button>
      </div>
      <div className="dashboard-content">
        <Outlet />
      </div>
    </div>
  )
}
