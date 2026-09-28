// Single active session PER DEVICE KIND for every org employee. A person may hold
// at most ONE active phone (field app) and ONE active computer (office app) at a
// time — so a manager can work a desktop and a phone at once, but the field app
// stays strictly one-per-person. Opening a SECOND device of the same kind locks
// the prior one — the "no shared field app, no sharing to a competitor" guarantee.
// Field techs without desktop access simply never get a second kind. Enforcement is
// hard-wired: there is no org-admin option to turn it off. Only the platform
// super-admin (who manages multiple orgs and has no org of their own) is exempt.
//
// Grace for the same phone under different identities: iOS wipes the stored device
// id when the PWA is deleted, and the installed app and Safari keep SEPARATE storage,
// so one physical phone can look like several. To avoid locking a person out of their
// own phone, a device that has been peacefully active for longer than the contention
// window quietly RE-CLAIMS its slot when it finds itself superseded, instead of
// throwing up the lock. The lock appears only on genuine real-time contention — two
// live devices bumping each other within seconds — which is the real sharing signal,
// and the server still records it as a rapid switch for the office to see.
import { useEffect, useRef, useState } from 'react'
import { supabase } from './utils/supabase'
import { getDeviceId, deviceLabel, devicePlatform, deviceKind } from './utils/deviceId'

// If we get bumped again within this long of our own last claim, another device is
// actively fighting us right now (real concurrent use) — show the lock. A longer gap
// means the other identity is idle/stale (a reinstall or Safari-vs-icon on the same
// phone), so we take the slot back silently.
const CONTENTION_MS = 20000

export default function DeviceSessionGuard({ profile, children }) {
  const enforced = !!profile?.org_id && profile?.role !== 'super_admin'
  const [deviceState, setDeviceState] = useState(enforced ? 'checking' : 'active')
  const [claiming, setClaiming] = useState(false)
  const lastClaimAt = useRef(0)

  async function claimDevice() {
    try {
      await supabase.rpc('tc_claim_device', {
        p_org: profile?.org_id || null, p_device_id: getDeviceId(),
        p_label: deviceLabel(), p_platform: devicePlatform(), p_kind: deviceKind(),
      })
      lastClaimAt.current = Date.now()
    } catch { /* don't hard-fail the app on a claim hiccup */ }
    setDeviceState('active')
  }

  // Decide what a supersede means. If we're on screen and have held the slot longer
  // than the contention window, this is almost certainly our own phone under another
  // identity — retake it quietly. If we were just active moments ago, another live
  // device is contending in real time — show the lock.
  async function handleSuperseded() {
    if (document.visibilityState === 'visible' && Date.now() - lastClaimAt.current > CONTENTION_MS) {
      await claimDevice()
    } else {
      setDeviceState('superseded')
    }
  }

  async function pollActive() {
    try {
      const { data } = await supabase.rpc('tc_device_active', { p_device_id: getDeviceId() })
      if (data === false) handleSuperseded()
      else setDeviceState('active')
    } catch { /* transient — ignore */ }
  }
  async function takeOver() { setClaiming(true); await claimDevice(); setClaiming(false) }

  useEffect(() => {
    if (!enforced) return
    let stopped = false
    let channel = null
    claimDevice()
    const iv = setInterval(() => { if (!stopped && document.visibilityState === 'visible') pollActive() }, 30000)
    const onVis = () => { if (document.visibilityState === 'visible') pollActive() }
    document.addEventListener('visibilitychange', onVis)
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid || stopped) return
      channel = supabase.channel('devlock-' + uid)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_devices', filter: `user_id=eq.${uid}` },
          (payload) => {
            const r = payload?.new
            if (r && r.device_id === getDeviceId() && r.is_active === false) handleSuperseded()
            else pollActive()
          })
        .subscribe()
    })()
    return () => { stopped = true; clearInterval(iv); document.removeEventListener('visibilitychange', onVis); if (channel) supabase.removeChannel(channel) }
  }, [enforced]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!enforced) return children
  if (deviceState === 'superseded') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: '#B00020', color: '#fff', fontWeight: 800, fontSize: 12, letterSpacing: 0.5, padding: '4px 10px', borderRadius: 999, marginBottom: 14 }}>LOCKED FOR SECURITY</div>
          <h1 style={{ fontSize: 22, margin: '0 0 10px' }}>You're signed in on another device</h1>
          <p style={{ color: '#CBD5E1', fontSize: 15, lineHeight: 1.5, margin: '0 0 22px' }}>
            For security, you can use this app on only one phone and one computer at a time. Your account is already
            active on another device of this type. If that was you, take over here — the other one will be locked,
            and the switch is recorded.
          </p>
          <button onClick={takeOver} disabled={claiming}
            style={{ width: '100%', padding: '15px', borderRadius: 12, border: 'none', background: '#1F7A43', color: '#fff', fontWeight: 800, fontSize: 17, cursor: 'pointer' }}>
            {claiming ? 'Switching…' : 'Use this device'}
          </button>
          {/* Escape hatch — never leave someone trapped on this screen. */}
          <button onClick={() => { try { supabase.auth.signOut() } catch { /* ignore */ } }}
            style={{ marginTop: 14, background: 'none', border: 'none', color: '#94A3B8', fontSize: 13.5, cursor: 'pointer', textDecoration: 'underline' }}>
            Sign out instead
          </button>
        </div>
      </div>
    )
  }
  return children
}
