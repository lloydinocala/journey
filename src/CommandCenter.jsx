// CommandCenter — the one-stop morning landing. One dashboard name on top, colored tabs
// below it, dashboard content below that. Reuses the existing dashboards as-is; only the
// active tab mounts (fast open) and visited tabs stay mounted. Each dashboard's own title
// is hidden (via the embedded flag + a scoped rule for .page-title) so the page shows a
// single name. Remembers the last tab per browser.
import { useState } from 'react'
import OperationsDashboard from './OperationsDashboard'
import FinancialsDash from './FinancialsDashboard'
import { CommandDashboard } from './modules/dashboard-hvac'
import MaintenanceDashboard from './MaintenanceDashboard'

const TABS = [
  { key: 'today', label: 'Today', name: 'Operations Dashboard', color: '#2E6FB5', Comp: OperationsDashboard },
  { key: 'financials', label: 'Financials', name: 'Financials', color: '#15803D', Comp: FinancialsDash },
  { key: 'kpis', label: 'KPIs', name: 'Performance & KPIs', color: '#6A54C4', Comp: CommandDashboard },
  { key: 'maintenance', label: 'Maintenance', name: 'Maintenance Dashboard', color: '#B45309', Comp: MaintenanceDashboard },
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

  const current = TABS.find((t) => t.key === active) || TABS[0]

  return (
    <div className="command-center">
      {/* Each embedded dashboard's own title is suppressed so the page shows ONE name (below)
          and then the tabs. Dashboards that title with .page-title are hidden here; Financials
          uses its embedded flag. */}
      <style>{`.cc-pane .page-title{display:none!important}`}</style>

      <h2 className="page-title" style={{ marginBottom: 10 }}>{current.name}</h2>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: '2px solid #CBD5E1', margin: '0 0 18px', paddingLeft: 2 }}>
        {TABS.map((t) => {
          const on = active === t.key
          return (
            <button key={t.key} type="button" onClick={() => go(t.key)}
              style={{
                cursor: 'pointer', fontWeight: 700, fontSize: 14, padding: '9px 18px',
                borderRadius: '10px 10px 0 0', marginBottom: '-2px',
                borderTop: `1px solid ${on ? t.color : '#CBD5E1'}`,
                borderLeft: `1px solid ${on ? t.color : '#CBD5E1'}`,
                borderRight: `1px solid ${on ? t.color : '#CBD5E1'}`,
                borderBottom: on ? `2px solid ${t.color}` : '2px solid transparent',
                background: on ? t.color : t.color + '14',
                color: on ? '#ffffff' : t.color,
                transition: 'background .12s',
              }}>
              {t.label}
            </button>
          )
        })}
      </div>

      {TABS.map((t) => {
        if (!mounted[t.key]) return null
        const Comp = t.Comp
        return (
          <div key={t.key} className="cc-pane" style={{ display: active === t.key ? 'block' : 'none' }}>
            <Comp profile={profile} embedded />
          </div>
        )
      })}
    </div>
  )
}
