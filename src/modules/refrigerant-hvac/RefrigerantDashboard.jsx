// Refrigerant Management · Dashboard (module landing)
// EPA-compliance at a glance — refrigerant added/recovered, covered systems over
// their leak threshold (30-day repair clock), cylinders on hand and awaiting
// reclaim/disposal — plus the QuincyAI briefing scoped to refrigerant compliance.
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboardData } from './refrigerantData'
import { useOrgSelector, OrgBar } from '../elements-hvac/shared'
import QuincyBrief from '../../QuincyBrief'

const lbs = (n) => (n == null || isNaN(n) ? '—' : `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })} lb`)

const CARDS = [
  { path: '/refrigerant/log', title: 'Usage Log', desc: 'Record refrigerant added or recovered on a job — with the tech’s EPA cert on file.' },
  { path: '/refrigerant/systems', title: 'Systems', desc: 'Set each system’s refrigerant, full charge, and sector — this drives covered vs. exempt.' },
  { path: '/refrigerant/cylinders', title: 'Cylinders', desc: 'Cradle-to-grave — virgin purchased, recovered on hand, sent to reclaim or disposal.' },
]

export default function RefrigerantDashboard({ profile }) {
  const org = useOrgSelector(profile)
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!org.selectedOrg) return
    setLoading(true)
    setD(await dashboardData(org.selectedOrg))
    setLoading(false)
  }
  useEffect(() => { load() }, [org.selectedOrg])

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

  const overAlert = !!d && d.overThresholdCount > 0
  const reclaimAlert = !!d && d.awaitingReclaimCount > 0

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Refrigerant Dashboard</h2>
        </div>
        <button className="logout-button" style={{ margin: 0 }} disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      <OrgBar {...org} />

      <div style={{ margin: '12px 0 16px' }}>
        <QuincyBrief kind="refrigerant" context={{
          systemsTracked: d ? d.systemsTracked : 0,
          lbsAddedLast90Days: d ? d.added90 : 0,
          lbsRecoveredLast90Days: d ? d.recovered90 : 0,
          coveredSystemsOverLeakThreshold: d ? d.overThresholdCount : 0,
          overThresholdSystems: d ? d.overThreshold.map((s) => ({ system: s.label, location: s.location, refrigerant: s.type, leakRatePct: s.leakRate, thresholdPct: s.threshold })) : [],
          cylindersOnHand: d ? d.cylinderCount : 0,
          poundsOnHand: d ? d.onHandLbs : 0,
          recoveredCylindersAwaitingReclaimOrDisposal: d ? d.awaitingReclaimCount : 0,
        }} />
      </div>

      {/* At a glance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Metric to="/refrigerant/systems" label="Systems tracked" value={loading && !d ? '…' : String(d ? d.systemsTracked : 0)} sub="with a refrigerant profile" accent="#132A4C" />
        <Metric to="/refrigerant/log" label="Added (90 days)" value={loading && !d ? '…' : lbs(d ? d.added90 : 0)} sub="charged into systems" accent="#1B3A6B" />
        <Metric to="/refrigerant/log" label="Recovered (90 days)" value={loading && !d ? '…' : lbs(d ? d.recovered90 : 0)} sub="pulled back out" accent="#0B7A3B" />
        <Metric to="/refrigerant/systems" label="Over leak threshold" value={loading && !d ? '…' : String(d ? d.overThresholdCount : 0)} sub={overAlert ? 'repair within 30 days' : 'all covered systems OK'} accent={overAlert ? '#B00020' : '#0B7A3B'} alert={overAlert} />
        <Metric to="/refrigerant/cylinders" label="Cylinders on hand" value={loading && !d ? '…' : String(d ? d.cylinderCount : 0)} sub={d ? `${lbs(d.onHandLbs)} total` : ''} accent="#132A4C" />
        <Metric to="/refrigerant/cylinders" label="Awaiting reclaim" value={loading && !d ? '…' : String(d ? d.awaitingReclaimCount : 0)} sub={reclaimAlert ? 'recovered — send out' : 'nothing waiting'} accent={reclaimAlert ? '#B8720A' : '#0B7A3B'} alert={reclaimAlert} />
      </div>

      {/* Covered systems over threshold — 30-day repair clock */}
      {d && d.overThreshold.length > 0 && (
        <div style={{ border: '1px solid #E3B0B0', background: '#FCEFEF', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontWeight: 800, color: '#B00020', marginBottom: 4 }}>Covered systems over the leak threshold</div>
          <div style={{ fontSize: 12, color: '#7A3030', marginBottom: 10 }}>
            AIM Act ER&amp;R: a repair (or an approved plan) is required within 30 days of exceeding the threshold. Leak rate is a trailing-12-month estimate (refrigerant added ÷ full charge).
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.overThreshold.map((s) => (
              <div key={s.id} style={{ fontSize: 14 }}>
                <strong>{s.label}</strong> <span style={{ color: 'var(--mist)' }}>· {s.location} · {s.type || 'refrigerant n/a'} · leak rate ~{s.leakRate}% (threshold {s.threshold}%)</span>
              </div>
            ))}
          </div>
          <Link to="/refrigerant/log" style={{ color: '#B00020', fontWeight: 700, fontSize: 13, marginTop: 10, display: 'inline-block' }}>Record a repair →</Link>
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

      <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 20, maxWidth: 820 }}>
        Section 608 of the Clean Air Act applies to <strong>all</strong> refrigerant work — only certified techs, no venting,
        recover before opening a system, and keep records. The AIM Act leak-repair rules (leak-rate thresholds and the
        30-day repair clock) apply only to <strong>covered</strong> systems: 15 lb or more of refrigerant and not a
        residential / light-commercial AC or heat pump. Each system’s sector is set on the Systems page.
      </p>
    </div>
  )
}
