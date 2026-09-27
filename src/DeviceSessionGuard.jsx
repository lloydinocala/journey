// Single active session for EVERY org employee. A person may be signed in / using
// the app on exactly ONE device at a time — any part of the app, field or office —
// and the moment they open it on another device, the prior one locks (instantly,
// via a realtime channel; a poll is the fallback). This is the "no second device,
// no sharing to a competitor" guarantee. Enforcement is hard-wired: there is no
// org-admin option to turn it off. Only the platform super-admin (who manages
// multiple orgs and has no org of their own) is exempt.
import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'
import { getDeviceId, deviceLabel, devicePlatform } from './utils/deviceId'

export default function DeviceSessionGuard({ profile, children }) {
  const enforced = !!profile?.org_id && profile?.role !== 'super_admin'
  const [deviceState, setDeviceState] = useState(enforced ? 'checking' : 'active')
  const [claiming, setClaiming] = useState(false)

  async function claimDevice() {
    try {
      await supabase.rpc('tc_claim_device', {
        p_org: profile?.org_id || null, p_device_id: getDeviceId(),
        p_label: deviceLabel(), p_platform: devicePlatform(),
      })
    } catch { /* don't hard-fail the app on a claim hiccup */ }
    setDeviceState('active')
  }
  async function pollActive() {
    try {
      const { data } = await supabase.rpc('tc_device_active', { p_device_id: getDeviceId() })
      setDeviceState(data === false ? 'superseded' : 'active')
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
            if (r && r.device_id === getDeviceId() && r.is_active === false) setDeviceState('superseded')
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
            For security, this app can only be used on one device at a time. Your account is active on another device.
            If that was you, take over here — the other device will be locked, and the switch is recorded.
          </p>
          <button onClick={takeOver} disabled={claiming}
            style={{ width: '100%', padding: '15px', borderRadius: 12, border: 'none', background: '#1F7A43', color: '#fff', fontWeight: 800, fontSize: 17, cursor: 'pointer' }}>
            {claiming ? 'Switching…' : 'Use this device'}
          </button>
        </div>
      </div>
    )
  }
  return children
}
