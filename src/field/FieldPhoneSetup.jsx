import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldShell from './FieldShell'
import { isNative, platform, JourneyCalls, callStatus, setupCalls, syncCallLog } from '../native/native'

// PHONE SETUP — the store app's phone permissions in one place: caller ID for business calls,
// call history (so calls are logged), contacts, notifications, and location.
export default function FieldPhoneSetup({ profile }) {
  const navigate = useNavigate()
  const [st, setSt] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState('')
  const android = isNative() && platform() === 'android'
  async function refresh() { setSt(await callStatus()) }
  useEffect(() => { refresh() }, [])

  async function run(k, fn) {
    setBusy(k); setMsg(null)
    try { await fn() } catch (e) { setMsg({ ok: false, t: e?.message || 'Something went wrong.' }) }
    setBusy(''); refresh()
  }
  const row = (done, title, text, btn, onClick, k) => (
    <div className="fa-info" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 24, height: 24, borderRadius: 12, flex: '0 0 24px', display: 'grid', placeItems: 'center', fontWeight: 900, color: '#fff', background: done ? '#1B7A3D' : '#B8C4CF' }}>{done ? '✓' : ''}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <div className="fa-muted" style={{ fontSize: 13 }}>{text}</div>
        {!done && btn && <button type="button" className="fa-small-btn" style={{ marginTop: 8, fontSize: 14, padding: '6px 12px' }} disabled={!!busy} onClick={onClick}>{busy === k ? 'Working…' : btn}</button>}
      </div>
    </div>
  )

  return (
    <FieldShell profile={profile} title="Phone Setup" onBack={() => navigate(-1)}>
      <div className="fa-panel">
        {!isNative() ? (
          <p className="fa-empty">These settings are part of the Journey app from the app store. In a web browser, calls and location can&apos;t be read by any app.</p>
        ) : !android ? (
          <p className="fa-empty">On iPhone, Journey can&apos;t see calls. Location is turned on when Journey asks.</p>
        ) : !st ? <p className="fa-empty">Checking…</p> : (<>
          {row(st.callerId, 'Caller ID for business calls', 'While the phone rings, Journey names customers, vendors and others from your records and lets you open them in the Call Console with one tap. It never blocks or answers calls.',
            st.callerIdAvailable ? 'Turn on' : null, () => run('cid', async () => { await JourneyCalls.requestCallerId(); await setupCalls(profile) }), 'cid')}
          {!st.callerIdAvailable && <div className="fa-muted" style={{ fontSize: 12.5, margin: '0 4px' }}>Caller ID needs Android 10 or newer.</div>}
          {row(st.callLog && st.contacts, 'Log calls automatically', 'After each call, Journey adds it to Call Logs (business callers and numbers it doesn\'t know yet). People saved in your phone\'s contacts who aren\'t in Journey are treated as personal and skipped.',
            'Allow', () => run('log', async () => { await JourneyCalls.requestAccess(); await syncCallLog(profile) }), 'log')}
          {row(st.notifications, 'Notifications', 'Needed to show the caller ID and the location notice.', 'Allow', () => run('log', () => JourneyCalls.requestAccess()), 'notif')}
          {row(true, 'Location', 'Journey shares your location with your company while the app is running. Android shows a notice while it does. Set it to "Allow all the time" in the phone\'s settings if it asks.', null, null, 'gps')}
          {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.t}</div>}
        </>)}
      </div>
    </FieldShell>
  )
}
