import { usePush } from './usePush'

// Compact "Phone notifications: On/Off" row for the Field App.
export default function PushToggle({ profile }) {
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
