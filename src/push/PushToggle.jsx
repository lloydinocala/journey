import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePush } from './usePush'
import { isNative, pushStatus, setupPush } from '../native/native'

// In the store app, notifications come through Firebase instead of the browser.
function NativePushToggle({ profile }) {
  const navigate = useNavigate()
  const [st, setSt] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { pushStatus().then(setSt) }, [])
  async function on() {
    setBusy(true)
    const r = await setupPush(profile, (u) => { try { const x = new URL(u, 'https://www.journey-hvac.app'); navigate(x.pathname + x.search) } catch { /* ignore */ } }).catch(() => null)
    setSt(r || await pushStatus()); setBusy(false)
  }
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }
  return (
    <div className="fa-info">
      <div style={row}>
        <strong>Phone notifications: {st == null ? '…' : st === 'granted' ? 'On' : 'Off'}</strong>
        {st && st !== 'granted' && st !== 'denied' && <button type="button" className="fa-small-btn" disabled={busy} onClick={on}>{busy ? '…' : 'Turn on'}</button>}
      </div>
      {st === 'denied' && <div className="fa-muted" style={{ marginTop: 4 }}>Notifications are blocked for Journey. Allow them in the phone&apos;s Settings → Apps → Journey → Notifications.</div>}
    </div>
  )
}

// Compact "Phone notifications: On/Off" row for the Field App.
export default function PushToggle({ profile }) {
  return isNative() ? <NativePushToggle profile={profile} /> : <WebPushToggle profile={profile} />
}

function WebPushToggle({ profile }) {
  const { status, busy, error, turnOn, turnOff, needsHomeScreen } = usePush(profile)

  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }

  if (status === 'unsupported') {
    return (
      <div className="fa-info">
        <div style={row}><strong>Phone notifications: Off</strong></div>
        <div className="fa-muted" style={{ marginTop: 4 }}>
          {needsHomeScreen
            ? 'On iPhone, tap Share → "Add to Home Screen", then open Journey from the home screen to turn on notifications.'
            : 'This browser doesn’t support phone notifications.'}
        </div>
      </div>
    )
  }

  const on = status === 'on'
  return (
    <div className="fa-info">
      <div style={row}>
        <strong>Phone notifications: {status === 'checking' ? '…' : on ? 'On' : 'Off'}</strong>
        {status !== 'checking' && status !== 'denied' && (
          <button type="button" className="fa-small-btn" disabled={busy} onClick={on ? turnOff : turnOn}>
            {busy ? '…' : on ? 'Turn off' : 'Turn on'}
          </button>
        )}
      </div>
      {status === 'denied' && (
        <div className="fa-muted" style={{ marginTop: 4 }}>Notifications are blocked for this app. Allow them in your phone’s settings, then come back.</div>
      )}
      {error && <div className="fa-muted" style={{ marginTop: 4, color: '#B42318' }}>{error}</div>}
    </div>
  )
}
