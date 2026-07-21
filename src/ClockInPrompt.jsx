import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

// Shown once per app session after an org employee logs in, IF they aren't
// already clocked in. Big "Clock In" to start paid time, small "Skip for now"
// so someone doing off-the-clock office work isn't trapped. Once they clock in
// (or skip), it doesn't reappear this session.
export default function ClockInPrompt({ profile }) {
  const [checked, setChecked] = useState(false)   // finished the open-shift lookup
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const sessionKey = `clockPromptSeen:${profile?.id}`

  useEffect(() => {
    let cancelled = false
    async function check() {
      // Only for org-scoped, non-super-admin employees.
      if (!profile?.id || !profile?.org_id || profile.role === 'super_admin') {
        setChecked(true)
        return
      }
      // Don't nag twice in one session.
      if (sessionStorage.getItem(sessionKey)) {
        setChecked(true)
        return
      }
      // Skip if already clocked in (open shift exists).
      const { data } = await supabase
        .from('time_clock_events')
        .select('id')
        .eq('user_id', profile.id)
        .is('clock_out', null)
        .limit(1)
      if (cancelled) return
      if (!data || data.length === 0) setShow(true)
      setChecked(true)
    }
    check()
    return () => { cancelled = true }
  }, [profile?.id])

  async function clockIn() {
    setBusy(true)
    const { error } = await supabase.from('time_clock_events').insert({
      org_id: profile.org_id,
      user_id: profile.id,
      clock_in: new Date().toISOString(),
      source: 'desktop',
    })
    setBusy(false)
    if (error) { alert('Could not clock in: ' + error.message); return }
    sessionStorage.setItem(sessionKey, '1')
    setShow(false)
    // Let the sidebar clock refresh
    window.dispatchEvent(new Event('clock-changed'))
  }

  function skip() {
    sessionStorage.setItem(sessionKey, '1')
    setShow(false)
  }

  if (!checked || !show) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', zIndex: 4000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px' }}>Welcome, {profile.full_name?.split(' ')[0] || 'there'}</h2>
        <p style={{ color: '#64748B', marginTop: 0, marginBottom: 24 }}>
          Ready to start your workday? Clock in to begin recording your hours.
        </p>
        <button
          onClick={clockIn}
          disabled={busy}
          style={{
            width: '100%', padding: '16px', borderRadius: 12, border: 'none',
            background: '#1F7A43', color: '#fff', fontWeight: 800, fontSize: 18, cursor: 'pointer',
          }}
        >
          {busy ? 'Clocking in…' : 'Clock In'}
        </button>
        <button
          onClick={skip}
          disabled={busy}
          style={{
            marginTop: 12, background: 'none', border: 'none', color: '#64748B',
            fontSize: 14, cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
