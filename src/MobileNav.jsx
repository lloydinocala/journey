import { useNavigate, useLocation } from 'react-router-dom'
import { IconCalendar, IconList, IconMore, IconSparkles } from './MobileIcons'

export function isFieldAdmin(profile) {
  return profile?.role === 'org_admin' || profile?.role === 'super_admin' || !!profile?.is_field_supervisor
}

export default function MobileNav({ profile }) {
  const navigate = useNavigate()
  const location = useLocation()
  const admin = isFieldAdmin(profile)

  const TABS = [
    { key: 'calendar', label: admin ? 'Schedule' : 'Calendar', icon: IconCalendar, path: admin ? '/tech/schedule' : null },
    { key: 'jobcards', label: 'Job Cards', icon: IconList, path: '/tech' },
    { key: 'misc', label: admin ? 'New Job' : 'Misc', icon: IconMore, path: admin ? '/tech/new-job' : null },
    { key: 'apollo', label: 'Apollo', icon: IconSparkles, path: '/tech/apollo' },
  ]

  const active = TABS.find((t) => t.path && location.pathname === t.path)?.key
    || (location.pathname === '/tech' ? 'jobcards' : '')

  return (
    <div className="mobile-bottom-nav">
      {TABS.map(({ key, label, icon: Icon, path }) => (
        <button
          key={key}
          className={'mobile-nav-item' + (active === key ? ' active' : '') + (path ? '' : ' disabled')}
          onClick={() => path && navigate(path)}
          disabled={!path}
          title={path ? label : `${label} — admin only`}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
