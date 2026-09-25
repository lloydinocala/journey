// Journey · Mobile · Receiver — bottom navigation.
// The shop receiver's surface: receive deliveries and keep stock honest. No
// purchasing, no pricing, no payment — those live in the office. Counts/transfers
// arrive in the next update (shown disabled until then).
import { useNavigate, useLocation } from 'react-router-dom'
import { IconList, IconReceipt, IconMore } from './MobileIcons'

export default function ReceiverNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const TABS = [
    { key: 'home', label: 'Home', icon: IconList, path: '/receiver' },
    { key: 'receive', label: 'Receive', icon: IconReceipt, path: '/receiver/receive' },
    { key: 'counts', label: 'Counts', icon: IconMore, path: null },
  ]
  const active = pathname === '/receiver' ? 'home' : pathname.startsWith('/receiver/receive') ? 'receive' : ''
  return (
    <div className="mobile-bottom-nav">
      {TABS.map(({ key, label, icon: Icon, path }) => (
        <button
          key={key}
          className={'mobile-nav-item' + (active === key ? ' active' : '') + (path ? '' : ' disabled')}
          onClick={() => path && navigate(path)}
          disabled={!path}
          title={path ? label : `${label} — arriving next`}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
