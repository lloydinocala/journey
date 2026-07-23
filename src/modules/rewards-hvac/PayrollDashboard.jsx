// Rewards-HVAC · Payroll Dashboard — recent runs + set-aside snapshot
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getSettings } from './hrData'
import { recentCalcs, money } from './payrollData'
import { useOrgSelector, OrgBar, SetupNotice } from './shared'

export default function PayrollDashboard({ profile }) {
  const org = useOrgSelector(profile)
  const [calcs, setCalcs] = useState([])
  const [enabled, setEnabled] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    const [c, s] = await Promise.all([recentCalcs(org.selectedOrg), getSettings(org.selectedOrg)])
    setCalcs(c); setEnabled(!!s?.enabled)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  // Group by week for the summary.
  const byWeek = {}
  calcs.forEach((c) => {
    const k = c.week_start || 'unknown'
    if (!byWeek[k]) byWeek[k] = { week: k, count: 0, gross: 0, net: 0, setAside: 0 }
    byWeek[k].count += 1
    byWeek[k].gross += Number(c.gross_pay) || 0
    byWeek[k].net += Number(c.net_pay) || 0
    byWeek[k].setAside += (Number(c.employee_taxes) || 0) + (Number(c.ss_employer) || 0) + (Number(c.medicare_employer) || 0) + (Number(c.futa) || 0) + (Number(c.suta) || 0)
  })
  const weeks = Object.values(byWeek).sort((a, b) => (a.week < b.week ? 1 : -1))

  return (
    <div>
      <div className="page-header-bar">
        <h2>Rewards · Payroll</h2>
        <Link to="/rewards/payroll/prepare" className="auth-button" style={{ width: 'auto', margin: 0, textDecoration: 'none' }}>Prepare Payroll →</Link>
      </div>
      <OrgBar {...org} />
      <SetupNotice enabled={enabled} />

      <p style={{ color: 'var(--mist)', maxWidth: 720, marginBottom: 20 }}>
        Rewards computes the greater of hourly vs. pricebook task-hour pay, layers federal taxes, and gives you net pay per
        employee. It never moves money — you keep the tax set-aside in your own account and pay the IRS directly (Tax Center, R3).
      </p>

      {weeks.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No payroll computed yet. Start in <Link to="/rewards/payroll/prepare">Prepare Payroll</Link>.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Week</th><th>Checks</th><th>Gross</th><th>Net</th><th>Tax to set aside</th></tr></thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week}>
                <td>{w.week}</td>
                <td>{w.count}</td>
                <td>{money(w.gross)}</td>
                <td>{money(w.net)}</td>
                <td style={{ color: '#B8720A', fontWeight: 700 }}>{money(w.setAside)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
