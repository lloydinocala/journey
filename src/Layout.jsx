import { Outlet, Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

export default function Layout({ profile }) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <h1 className="wordmark" style={{ fontSize: 22, margin: 0 }}>Journey</h1>
          {profile?.role === 'super_admin' && <span className="badge">Super Admin</span>}
          <Link to="/" className="nav-link">Dashboard</Link>
          <Link to="/customers" className="nav-link">Customers</Link>
          {profile?.role === 'super_admin' && (
            <Link to="/organizations" className="nav-link">Organizations</Link>
          )}
        </div>
        <button className="logout-button" onClick={handleLogout}>Sign out</button>
      </div>
      <Outlet />
    </div>
  )
}
