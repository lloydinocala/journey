// CommandCenter — the one-stop morning landing. Tabs across the office dashboards so a
// user can survey everything first thing, then choose their direction. Reuses the existing
// dashboard components as-is; only the active tab mounts (fast open), and visited tabs stay
// mounted so switching back is instant. Remembers the last tab per browser.
import { useState } from 'react'
import OperationsDashboard from './OperationsDashboard'
import FinancialsDash from './FinancialsDashboard'
import { CommandDashboard } from './modules/dashboard-hvac'
import MaintenanceDashboard from './MaintenanceDashboard'

const TABS = [
  { key: 'today', label: 'Today', Comp: OperationsDashboard },
  { key: 'financials', label: 'Financials', Comp: FinancialsDash },
  { key: 'kpis', label: 'KPIs', Comp: CommandDashboard },
  { key: 'maintenance', label: 'Maintenance', Comp: MaintenanceDashboard },
]

export default function CommandCenter({ profile }) {
  const [active, setActive] = useState(() => {
    try { const s = localStorage.getItem('command_center_tab'); if (s && TABS.some((t) => t.key === s)) return s } catch (_) { /* ignore */ }
    return 'today'
  })
  const [mounted, setMounted] = useState(() => ({ [active]: true }))

  function go(key) {
    setActive(key)
    setMounted((m) => (m[key] ? m : { ...m, [key]: true }))
    try { localStorage.setItem('command_center_tab', key) } catch (_) { /* ignore */ }
  }

  return (
    <div className="command-center">
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--border, #E7EBF0)', padding: '0 4px', marginBottom: 14, position: 'sticky', top: 0, zIndex: 5, background: 'var(--panel, #ffffff)' }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => go(t.key)}
            style={{
              border: 'none', background: 'none', padding: '12px 18px', fontSize: 14, cursor: 'pointer',
              fontWeight: active === t.key ? 700 : 500,
              color: active === t.key ? '#176E7A' : 'var(--mist, #64748B)',
              borderBottom: active === t.key ? '2px solid #176E7A' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {TABS.map((t) => {
        if (!mounted[t.key]) return null
        const Comp = t.Comp
        return (
          <div key={t.key} style={{ display: active === t.key ? 'block' : 'none' }}>
            <Comp profile={profile} />
          </div>
        )
      })}
    </div>
  )
}
