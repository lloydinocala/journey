import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import '../customer-hvac/portal.css'
import EmployeeLogin from './EmployeeLogin'
import EmployeeScorecard from './EmployeeScorecard'

// Self-contained employee portal. Mounted at /employee/* in App.jsx, OUTSIDE the
// staff app — its own auth context. Data comes only from sc_my_scorecard (the
// signed-in employee's own record), so there is no cross-employee exposure.
export default function EmployeePortal() {
  const [session, setSession] = useState(undefined)
  const [data, setData] = useState(undefined) // undefined = loading, null = not a recognized employee

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Employee Portal'
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => { sub.subscription.unsubscribe(); document.title = prevTitle }
  }, [])

  useEffect(() => {
    if (!session) { setData(undefined); return }
    let live = true
    ;(async () => {
      const { data: res, error } = await supabase.rpc('sc_my_scorecard')
      if (!live) return
      if (error || !res || !res.employee) setData(null)
      else setData(res)
    })()
    return () => { live = false }
  }, [session])

  if (session === undefined) return null
  if (!session) return <EmployeeLogin />
  if (data === undefined) return <div className="cp-root"><div className="cp-center">Loading your profile…</div></div>

  if (data === null) return (
    <div className="cp-root">
      <div className="cp-center">
        <div style={{ fontSize: 42 }}>🔎</div>
        <h2 className="cp-h2">We couldn’t find your employee record</h2>
        <p className="cp-lead" style={{ maxWidth: 340 }}>
          This sign-in isn’t linked to an active employee. Use the work email your office set up for you,
          or ask them to add you in the Employees list.
        </p>
        <button className="cp-btn ghost" style={{ maxWidth: 240 }} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  )

  return <EmployeeScorecard data={data} onSignOut={() => supabase.auth.signOut()} />
}
