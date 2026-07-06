import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import Login from './Login'
import Dashboard from './Dashboard'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return null // still checking, avoid a flash of the login screen
  }

  return session ? <Dashboard session={session} /> : <Login />
}
