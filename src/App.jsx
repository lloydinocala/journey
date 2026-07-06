import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import Login from './Login'
import Layout from './Layout'
import Dashboard from './Dashboard'
import Organizations from './Organizations'
import Customers from './Customers'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    supabase
      .from('users')
      .select('full_name, role, org_id')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [session])

  if (session === undefined) return null
  if (!session) return <Login />
  if (!profile) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout profile={profile} />}>
          <Route path="/" element={<Dashboard profile={profile} />} />
          {profile.role === 'super_admin' && (
            <Route path="/organizations" element={<Organizations />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
