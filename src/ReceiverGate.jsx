// Journey · Mobile · Receiver — access gate + shell.
// Anyone with the "Access the Receiving app" permission can open this surface —
// a dedicated receiver, an office user, or a field supervisor who's been granted
// it. No permission → a plain note, no data loads.
import { Outlet, useNavigate } from 'react-router-dom'
import { can } from './utils/permissions'
import ReceiverNav from './ReceiverNav'

export default function ReceiverGate({ profile }) {
  const navigate = useNavigate()
  if (!can(profile, 'access_receiver')) {
    return (
      <div className="mobile-shell job-card-v2">
        <div className="jc-header"><div className="jc-header-text"><div className="jc-title">Receiving</div></div></div>
        <div className="jc-body">
          <p className="jc-muted-note">
            You don’t have access to the Receiving app. Ask an admin to add the “Access the Receiving app” permission to your role.
          </p>
          <button className="auth-button" style={{ width: 'auto' }} onClick={() => navigate('/')}>Go back</button>
        </div>
      </div>
    )
  }
  return (<><Outlet /><ReceiverNav /></>)
}
