import { useNavigate, useLocation } from 'react-router-dom'
import { IconCalendar, IconList, IconMore, IconSparkles } from './MobileIcons'

const TABS = [
  { key: 'calendar', label: 'Calendar', icon: IconCalendar, path: null },
  { key: 'jobcards', label: 'Job Cards', icon: IconList, path: '/tech' },
  { key: 'misc', label: 'Misc', icon: IconMore, path: null },
  { key: 'apollo', label: 'Apollo', icon: IconSparkles, path: null },
]

export default function MobileNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const active = location.pathname.startsWith('/tech') ? 'jobcards' : ''

  return (
    <div className="mobile-bottom-nav">
      {TABS.map(({ key, label, icon: Icon, path }) => (
        <button
          key={key}
          className={'mobile-nav-item' + (active === key ? ' active' : '') + (path ? '' : ' disabled')}
          onClick={() => path && navigate(path)}
          disabled={!path}
          title={path ? label : `${label} — coming soon`}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
