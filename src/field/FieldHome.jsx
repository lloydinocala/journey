import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldShell from './FieldShell'
import ClockWidget from '../ClockWidget'
import { signOutMobile } from '../utils/mobileSessionLog'

// FIELD MANAGEMENT — the supervisor's home in the Field App.
export default function FieldHome({ profile }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [today, setToday] = useState(() => new Date())
  useEffect(() => { try { sessionStorage.setItem('fa_home_seen', '1') } catch { /* private mode */ } }, [])
  useEffect(() => { const t = setInterval(() => setToday(new Date()), 60000); return () => clearInterval(t) }, [])
  const items = [
    ['Call Console', '/tech/field/calls'],
    ['Calendar', '/tech/field/calendar'],
    ['Jobs & Job Cards', '/tech/field/jobs'],
    ['Credits & Expenses', '/tech/field/expenses'],
    ['WorkForce', '/tech/field/workforce'],
    ['Admin', '/tech/field/admin'],
  ]
  const menu = (
    <>
      <button type="button" className="fa-menu-btn" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}>☰</button>
      {menuOpen && (
        <>
          <div className="fa-menu-scrim" onClick={() => setMenuOpen(false)} />
          <div className="fa-menu">
            <button type="button" onClick={() => navigate('/tech')}>My Jobs</button>
            <button type="button" onClick={() => navigate('/tech/my-schedule')}>My Schedule</button>
            <button type="button" onClick={() => navigate('/my')}>My Records</button>
            <button type="button" onClick={() => navigate('/tech/manual')}>Field Manual</button>
            <button type="button" onClick={() => navigate('/tech/settings')}>Settings</button>
            <button type="button" onClick={() => signOutMobile(profile)}>Sign Out</button>
          </div>
        </>
      )}
    </>
  )
  return (
    <FieldShell profile={profile} title="Field Management" back={false} menu={menu}>
      <div className="fa-datepill">{today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
      {profile?.id && profile?.org_id && <div style={{ marginBottom: 10 }}><ClockWidget userId={profile.id} orgId={profile.org_id} variant="field" /></div>}
      <div className="fa-panel fa-menu-list">
        {items.map(([label, to]) => <button key={to} type="button" className="fa-navbtn" onClick={() => navigate(to)}>{label}</button>)}
      </div>
    </FieldShell>
  )
}
