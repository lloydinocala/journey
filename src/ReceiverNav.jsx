// Journey · Mobile · Receiver — bottom navigation.
// The shop receiver's surface: receive deliveries, count stock, move stock. No
// purchasing, no pricing, no payment — those live in the office.
import { useNavigate, useLocation } from 'react-router-dom'
import { IconList, IconReceipt, IconCalculator, IconNavigation } from './MobileIcons'

export default function ReceiverNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const TABS = [
    { key: 'home', label: 'Home', icon: IconList, path: '/receiver' },
    { key: 'receive', label: 'Receive', icon: IconReceipt, path: '/receiver/receive' },
    { key: 'counts', label: 'Counts', icon: IconCalculator, path: '/receiver/counts' },
    { key: 'transfer', label: 'Transfer', icon: IconNavigation, path: '/receiver/transfer' },
  ]
  const active =
    pathname === '/receiver' ? 'home'
      : pathname.startsWith('/receiver/receive') ? 'receive'
        : pathname.startsWith('/receiver/counts') ? 'counts'
          : pathname.startsWith('/receiver/transfer') ? 'transfer'
            : ''
  return (
    <div className="mobile-bottom-nav">
      {TABS.map(({ key, label, icon: Icon, path }) => (
        <button
          key={key}
          className={'mobile-nav-item' + (active === key ? ' active' : '')}
          onClick={() => navigate(path)}
          title={label}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
