import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldShell from './FieldShell'
import ClockWidget from '../ClockWidget'
import { signOutMobile } from '../utils/mobileSessionLog'
import { supabase } from '../utils/supabase'
import PushToggle from '../push/PushToggle'
import { inboxNewCount } from './FieldInbox'
import { isNative } from '../native/native'

// One-person company: only one active user. Team/payroll screens step aside and the time clock is optional.
export function useSolo(orgId) {
  const [solo, setSolo] = useState(null)
  useEffect(() => {
    if (!orgId) return
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('org_id', orgId).neq('is_active', false)
      .then(({ count }) => setSolo((count || 0) <= 1))
  }, [orgId])
  return solo
}

// FIELD MANAGEMENT — the supervisor's home in the Field App.
export default function FieldHome({ profile }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [today, setToday] = useState(() => new Date())
  useEffect(() => { try { sessionStorage.setItem('fa_home_seen', '1') } catch { /* private mode */ } }, [])
  useEffect(() => { const t = setInterval(() => setToday(new Date()), 60000); return () => clearInterval(t) }, [])
  const orgId = profile?.org_id
  const solo = useSolo(orgId)
  const clockKey = `fa_use_clock_${orgId}`
  const [useClock, setUseClock] = useState(() => { try { return localStorage.getItem(clockKey) === '1' } catch { return false } })
  const [newCount, setNewCount] = useState(0)
  useEffect(() => { if (orgId) inboxNewCount(orgId).then(setNewCount).catch(() => {}) }, [orgId])
  function toggleClock(v) { setUseClock(v); try { localStorage.setItem(clockKey, v ? '1' : '0') } catch { /* private mode */ } }
  const items = [
    ['Inbox', '/tech/field/inbox', newCount],
    ['Call Console', '/tech/field/calls'],
    ['Calendar', '/tech/field/calendar'],
    ['Jobs & Job Cards', '/tech/field/jobs'],
    ['Customers', '/tech/field/customers'],
    ['Estimates', '/tech/field/estimates'],
    ['Money', '/tech/field/money'],
    ['Credits & Expenses', '/tech/field/expenses'],
    ...(solo ? [] : [['WorkForce', '/tech/field/workforce']]),
    ['Admin', '/tech/field/admin'],
  ]
  const showClock = solo === false || (solo && useClock)
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
            {isNative() && <button type="button" onClick={() => navigate('/tech/field/phone-setup')}>Phone Setup</button>}
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
      {profile?.id && orgId && showClock && <div style={{ marginBottom: 10 }}><ClockWidget userId={profile.id} orgId={orgId} variant="field" /></div>}
      <div className="fa-panel fa-menu-list">
        {items.map(([label, to, badge]) => (
          <button key={to} type="button" className="fa-navbtn" style={{ position: 'relative' }} onClick={() => navigate(to)}>
            {label}{badge ? <span className="fa-badge">{badge > 99 ? '99+' : badge}</span> : null}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 10 }}><PushToggle profile={profile} /></div>
      {solo && <button type="button" className="fa-linkbtn" onClick={() => toggleClock(!useClock)}>{useClock ? 'Hide the time clock' : 'Track my hours with the time clock'}</button>}
    </FieldShell>
  )
}
