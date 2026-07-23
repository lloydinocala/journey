// Rewards-HVAC · HR Dashboard — headcount, compliance watchdog, quick links
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboardData, getSettings } from './hrData'
import { useOrgSelector, OrgBar, SetupNotice, FlagChip } from './shared'

function Stat({ label, value, to }) {
  const body = (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', minWidth: 150 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--route-blue, #1B3A6B)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 2 }}>{label}</div>
    </div>
  )
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{body}</Link> : body
}

export default function HrDashboard({ profile }) {
  const org = useOrgSelector(profile)
  const [data, setData] = useState(null)
  const [enabled, setEnabled] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    const [d, s] = await Promise.all([dashboardData(org.selectedOrg), getSettings(org.selectedOrg)])
    setData(d)
    setEnabled(!!s?.enabled)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  return (
    <div>
      <div className="page-header-bar">
        <h2>Rewards · People</h2>
      </div>
      <OrgBar {...org} />
      <SetupNotice enabled={enabled} />

      {!data ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
            <Stat label="Active employees" value={data.headcount} to="/rewards/employees" />
            <Stat label="Tracked certifications" value={data.certs.length} to="/rewards/certifications" />
            <Stat label="Open compliance flags" value={data.flags.length} />
          </div>

          <div style={{ marginBottom: 28 }}>
            <h3 style={{ marginBottom: 10 }}>Compliance watchdog</h3>
            {data.flags.length === 0 ? (
              <div style={{ color: 'var(--mist)' }}>All clear — no expiring certifications or threshold alerts.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Status</th><th>Subject</th><th>What to do</th></tr></thead>
                <tbody>
                  {data.flags.map((f, i) => (
                    <tr key={i}>
                      <td><FlagChip severity={f.severity}>{f.severity === 'red' ? 'Action' : 'Heads-up'}</FlagChip></td>
                      <td>{f.subject_label}</td>
                      <td>{f.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h3 style={{ marginBottom: 10 }}>Jump to</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              ['Employees', '/rewards/employees'],
              ['Hiring', '/rewards/hiring'],
              ['Onboarding', '/rewards/onboarding'],
              ['Job Descriptions', '/rewards/job-descriptions'],
              ['Discipline', '/rewards/discipline'],
              ['Certifications', '/rewards/certifications'],
              ['Documents', '/rewards/documents'],
            ].map(([label, to]) => (
              <Link key={to} to={to} className="nav-link" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px' }}>{label}</Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
