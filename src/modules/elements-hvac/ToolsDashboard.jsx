// Tools Management · Dashboard (module landing)
// At-a-glance tool health — where tools are, what's flagged, what's in the shop —
// plus the QuincyAI briefing scoped to tools. Enable toggle lives here too.
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toolsDashboardData, getToolsSettings, upsertToolsSettings } from './toolsData'
import { useOrgSelector, OrgBar, EnabledPill } from './shared'
import QuincyBrief from '../../QuincyBrief'

const money0 = (n) => (n == null || isNaN(n) ? '—' : `$${Math.round(Number(n)).toLocaleString()}`)

const CARDS = [
  { path: '/tools/catalog', title: 'Tool Catalog', desc: 'Add tools, assign to trucks/techs, inspect, and see each tool’s history.' },
  { path: '/tools/maintenance', title: 'Maintenance', desc: 'Tools in the shop for repair — record and verify work before redeploying.' },
]

export default function ToolsDashboard({ profile }) {
  const org = useOrgSelector(profile)
  const [d, setD] = useState(null)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savingEnable, setSavingEnable] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    const [data, s] = await Promise.all([toolsDashboardData(org.selectedOrg), getToolsSettings(org.selectedOrg)])
    setD(data); setEnabled(!!s?.enabled); setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

  async function toggleEnabled() {
    setSavingEnable(true)
    await upsertToolsSettings(org.selectedOrg, { enabled: !enabled })
    setEnabled((e) => !e); setSavingEnable(false)
  }

  const Metric = ({ to, label, value, sub, accent, alert }) => (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        border: `1px solid ${alert ? '#E3B0B0' : 'var(--line, #E2E8F0)'}`,
        background: alert ? '#FCEFEF' : '#FBFCFE',
        borderRadius: 12, padding: '14px 16px', height: '100%',
      }}>
        <div style={{ fontSize: 12, color: 'var(--mist)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: accent || '#132A4C', marginTop: 4 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 4, minHeight: 16 }}>{sub}</div>
      </div>
    </Link>
  )

  const flaggedAlert = !!d && d.flaggedCount > 0

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Tools Dashboard</h2>
          <EnabledPill enabled={enabled} />
        </div>
        <button className="logout-button" style={{ margin: 0 }} disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      <OrgBar {...org} />

      <div style={{ margin: '12px 0 16px' }}>
        <QuincyBrief kind="tools" context={{
          totalTools: d ? d.total : 0,
          inShop: d ? d.inShop : 0,
          onTrucksOrTechs: d ? d.assigned : 0,
          inMaintenance: d ? d.inMaintenance : 0,
          flaggedNeedsMaintenance: d ? d.flaggedCount : 0,
          openMaintenanceRecords: d ? d.openMaintenanceCount : 0,
          followUpNeeded_pastAnticipatedReturn: d ? d.followUpCount : 0,
          followUpTools: d ? d.followUp.map((f) => ({ tool: f.label, expectedReturn: f.expected, daysLate: f.daysLate })) : [],
        }} />
      </div>

      {!enabled && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', padding: '10px 14px', borderRadius: 10, marginBottom: 18, fontSize: 14 }}>
          Tools Management is currently <strong>disabled</strong> for this organization.{' '}
          <button onClick={toggleEnabled} disabled={savingEnable} style={{ color: '#9A3412', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            {savingEnable ? 'Enabling…' : 'Enable it'}
          </button>{' '}to start tracking tools.
        </div>
      )}

      {/* At a glance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Metric to="/tools/catalog" label="Total tools" value={loading && !d ? '…' : String(d ? d.total : 0)} sub="in the catalog" accent="#132A4C" />
        <Metric to="/tools/catalog" label="In the shop" value={loading && !d ? '…' : String(d ? d.inShop : 0)} sub="available to deploy" accent="#0B7A3B" />
        <Metric to="/tools/catalog" label="On trucks / techs" value={loading && !d ? '…' : String(d ? d.assigned : 0)} sub="currently assigned" accent="#1B3A6B" />
        <Metric to="/tools/maintenance" label="Needs maintenance" value={loading && !d ? '…' : String(d ? d.flaggedCount : 0)} sub={flaggedAlert ? 'flagged on inspection' : 'all clear'} accent={flaggedAlert ? '#B00020' : '#0B7A3B'} alert={flaggedAlert} />
        <Metric to="/tools/maintenance" label="In maintenance" value={loading && !d ? '…' : String(d ? d.inMaintenance : 0)} sub="in the shop for repair" accent={d && d.inMaintenance > 0 ? '#B8720A' : '#132A4C'} />
        <Metric to="/tools/maintenance" label="Follow-up needed" value={loading && !d ? '…' : String(d ? d.followUpCount : 0)} sub={d && d.followUpCount > 0 ? 'past anticipated return' : 'none overdue'} accent={d && d.followUpCount > 0 ? '#B00020' : '#0B7A3B'} alert={!!d && d.followUpCount > 0} />
      </div>

      {/* Value on hand (plain total cost; bookkeeping handles depreciation) */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', minWidth: 160 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1B3A6B' }}>{d ? money0(d.totalCost) : '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--mist)' }}>Total purchase cost on hand</div>
        </div>
      </div>

      {/* Follow-up needed — past anticipated return-to-service date */}
      {d && d.followUp.length > 0 && (
        <div style={{ border: '1px solid #E3B0B0', background: '#FCEFEF', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontWeight: 800, color: '#B00020', marginBottom: 8 }}>Follow-up needed — overdue return to service</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.followUp.map((f) => (
              <div key={f.id} style={{ fontSize: 14 }}>
                {f.label} <span style={{ color: 'var(--mist)' }}>· due back {new Date(f.expected).toLocaleDateString()} · {f.daysLate} day{f.daysLate === 1 ? '' : 's'} late</span>
              </div>
            ))}
          </div>
          <Link to="/tools/maintenance" style={{ color: '#B00020', fontWeight: 700, fontSize: 13, marginTop: 10, display: 'inline-block' }}>Go to Maintenance →</Link>
        </div>
      )}

      {/* Flagged list */}
      {d && d.flagged.length > 0 && (
        <div style={{ border: '1px solid #E3B0B0', background: '#FCEFEF', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontWeight: 800, color: '#B00020', marginBottom: 8 }}>Flagged for maintenance</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.flagged.map((t) => (
              <div key={t.id} style={{ fontSize: 14 }}>
                {t.label} <span style={{ color: 'var(--mist)' }}>· {t.status === 'in_maintenance' ? 'in the shop' : 'still deployed — pull it in'}</span>
              </div>
            ))}
          </div>
          <Link to="/tools/maintenance" style={{ color: '#B00020', fontWeight: 700, fontSize: 13, marginTop: 10, display: 'inline-block' }}>Go to Maintenance →</Link>
        </div>
      )}

      {/* Navigation cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {CARDS.map((c) => (
          <Link key={c.path} to={c.path} style={{ textDecoration: 'none' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 18, height: '100%' }}>
              <div style={{ fontWeight: 700, color: '#1B3A6B', marginBottom: 6 }}>{c.title}</div>
              <div style={{ color: 'var(--mist)', fontSize: 13 }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
