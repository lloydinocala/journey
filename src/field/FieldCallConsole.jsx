import { useNavigate, useLocation } from 'react-router-dom'
import FieldShell from './FieldShell'
import CallConsole from '../CallConsole'

// CALL CONSOLE — the desktop Call Console (same lookup, history and call logging, per company),
// sized for the phone. "+Add" on the caller opens +ADD with that customer picked up.
export default function FieldCallConsole({ profile }) {
  const navigate = useNavigate()
  // ?phone= comes from the store app's incoming-call notification.
  const phone = new URLSearchParams(useLocation().search).get('phone') || ''
  return (
    <FieldShell profile={profile} title="Call Console" onBack={() => navigate('/tech/field')}>
      <div className="fa-panel" style={{ display: 'block' }}>
        <CallConsole key={phone} profile={profile} field initialPhone={phone} onAdd={(mode, customer, phone) => navigate('/tech/field/add', { state: { mode, customer, phone } })} />
      </div>
      <button type="button" className="fa-navbtn" style={{ marginTop: 12 }} onClick={() => navigate('/tech/field/call-logs')}>Call Logs</button>
    </FieldShell>
  )
}
