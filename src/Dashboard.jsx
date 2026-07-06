import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

export default function Dashboard({ session }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase
        .from('users')
        .select('full_name, role, org_id')
        .eq('id', session.user.id)
        .single()
      setProfile(data)
      setLoading(false)
    }
    loadProfile()
  }, [session])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (loading) return null

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="wordmark" style={{ fontSize: 22, margin: 0 }}>Journey</h1>
          {profile?.role === 'super_admin' && <span className="badge">Super Admin</span>}
        </div>
        <button className="logout-button" onClick={handleLogout}>Sign out</button>
      </div>

      <p>Welcome, {profile?.full_name || session.user.email}.</p>

      {profile?.role === 'super_admin' && !profile?.org_id && (
        <p style={{ color: 'var(--mist)' }}>
          You're signed in as platform owner. Organization management and the
          scheduling dashboard get built here next.
        </p>
      )}
    </div>
  )
}
