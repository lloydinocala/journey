import { useState, useEffect, useMemo } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

function money(val) {
  return '$' + Number(val || 0).toFixed(2)
}

function dateDisplay(val) {
  if (!val) return '—'
  return new Date(val + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

function daysBetween(a, b) {
  return Math.round((new Date(a) - new Date(b)) / 86400000)
}

export default function MaintenanceLifecycle({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'

  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [agreements, setAgreements] = useState([])
  const [billingHistory, setBillingHistory] = useState([])
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  useEffect(() => {
    loadData(selectedOrg)
  }, [selectedOrg])

  async function loadData(orgId) {
    if (!orgId) return
    setLoading(true)
    const [agrRes, billRes, tierRes] = await Promise.all([
      supabase
        .from('maintenance_agreements')
        .select(`
          id, status, billing_cycle, price, start_date, next_visit_due_date, last_visit_completed_date,
          canceled_at, canceled_reason, created_at,
          tier:maintenance_agreement_tiers ( id, name, visit_count_per_year ),
          customer:customers ( display_name ),
          property:properties ( street_address, unit, city )
        `)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
      supabase
        .from('maintenance_agreement_billing_history')
        .select('id, agreement_id, billed_date, amount, status, paid_at')
        .eq('org_id', orgId)
        .order('billed_date', { ascending: false })
        .limit(500),
      supabase
        .from('maintenance_agreement_tiers')
        .select('id, name, sort_order, monthly_price, annual_price')
        .eq('org_id', orgId)
        .order('sort_order'),
    ])
    setAgreements(agrRes.data || [])
    setBillingHistory(billRes.data || [])
    setTiers(tierRes.data || [])
    setLoading(false)
  }

  const today = todayISO()

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, active: 0, lapsed: 0, canceled: 0 }
    for (const a of agreements) counts[a.status] = (counts[a.status] || 0) + 1
    return counts
  }, [agreements])

  const atRisk = useMemo(() => {
    return agreements.filter((a) => {
      if (a.status !== 'active') return false
      const visitOverdue = a.next_visit_due_date && a.next_visit_due_date < today
      const lastBillFailed = billingHistory.find((b) => b.agreement_id === a.id)?.status === 'failed'
      return visitOverdue || lastBillFailed
    })
  }, [agreements, billingHistory, today])

  const mrr = useMemo(() => {
    return agreements
      .filter((a) => a.status === 'active')
      .reduce((sum, a) => sum + (a.billing_cycle === 'monthly' ? Number(a.price) : Number(a.price) / 12), 0)
  }, [agreements])

  const revenueByTier = useMemo(() => {
    const map = new Map()
    for (const t of tiers) map.set(t.id, { name: t.name, activeCount: 0, mrr: 0 })
    for (const a of agreements) {
      if (a.status !== 'active' || !a.tier?.id) continue
      if (!map.has(a.tier.id)) map.set(a.tier.id, { name: a.tier?.name || 'Unknown Tier', activeCount: 0, mrr: 0 })
      const entry = map.get(a.tier.id)
      entry.activeCount += 1
      entry.mrr += a.billing_cycle === 'monthly' ? Number(a.price) : Number(a.price) / 12
    }
    return Array.from(map.values()).sort((a, b) => b.mrr - a.mrr)
  }, [agreements, tiers])

  const renewalRate = useMemo(() => {
    if (billingHistory.length === 0) return null
    const paid = billingHistory.filter((b) => b.status === 'paid').length
    return (paid / billingHistory.length) * 100
  }, [billingHistory])

  const recentlyLapsedOrCanceled = useMemo(() => {
    return agreements
      .filter((a) => a.status === 'lapsed' || a.status === 'canceled')
      .slice(0, 10)
  }, [agreements])

  const totalEver = agreements.length
  const lifetimeChurnPct = totalEver > 0 ? ((statusCounts.lapsed + statusCounts.canceled) / totalEver) * 100 : null

  return (
    <div>
      <h2 className="page-title">Maintenance Agreement Lifecycle</h2>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>
            Viewing organization
          </label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <>
          {agreements.length === 0 && (
            <p style={{ color: 'var(--mist)', marginBottom: 20 }}>
              No maintenance agreements exist yet for this organization — the tiles and tables below will populate once customers enroll.
            </p>
          )}

          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <div className="stat-tile">
              <div className="stat-value">{statusCounts.active}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-tile" style={{ borderColor: atRisk.length > 0 ? '#B8720A' : undefined }}>
              <div className="stat-value" style={{ color: atRisk.length > 0 ? '#B8720A' : undefined }}>{atRisk.length}</div>
              <div className="stat-label">At-Risk</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{statusCounts.lapsed}</div>
              <div className="stat-label">Lapsed</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{statusCounts.pending}</div>
              <div className="stat-label">Pending</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{statusCounts.canceled}</div>
              <div className="stat-label">Canceled</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{money(mrr)}</div>
              <div className="stat-label">Monthly Recurring Revenue</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{renewalRate === null ? '—' : renewalRate.toFixed(0) + '%'}</div>
              <div className="stat-label">Renewal / Payment Success Rate</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{lifetimeChurnPct === null ? '—' : lifetimeChurnPct.toFixed(0) + '%'}</div>
              <div className="stat-label">Lifetime Churn Rate</div>
            </div>
          </div>

          <h3 style={{ fontSize: 16, marginBottom: 10 }}>Revenue by Tier</h3>
          <div style={{ overflowX: 'auto', marginBottom: 28 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Active Agreements</th>
                  <th>MRR Contribution</th>
                  <th>Avg Price / Agreement</th>
                </tr>
              </thead>
              <tbody>
                {revenueByTier.map((t) => (
                  <tr key={t.name}>
                    <td>{t.name}</td>
                    <td>{t.activeCount}</td>
                    <td>{money(t.mrr)}</td>
                    <td>{t.activeCount > 0 ? money(t.mrr / t.activeCount) : '—'}</td>
                  </tr>
                ))}
                {revenueByTier.length === 0 && (
                  <tr><td colSpan="4" style={{ color: 'var(--mist)' }}>No active agreements yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: 16, marginBottom: 10 }}>At-Risk Agreements</h3>
          <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -6, marginBottom: 10 }}>
            Active agreements with an overdue visit, or whose most recent billing attempt failed.
          </p>
          <div style={{ overflowX: 'auto', marginBottom: 28 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Property</th>
                  <th>Tier</th>
                  <th>Next Visit Due</th>
                  <th>Days Overdue</th>
                  <th>Last Billing</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((a) => {
                  const overdueDays = a.next_visit_due_date && a.next_visit_due_date < today ? daysBetween(today, a.next_visit_due_date) : null
                  const lastBill = billingHistory.find((b) => b.agreement_id === a.id)
                  return (
                    <tr key={a.id}>
                      <td>{a.customer?.display_name || '—'}</td>
                      <td>{a.property?.street_address || '—'}{a.property?.unit ? ` #${a.property.unit}` : ''}</td>
                      <td>{a.tier?.name || '—'}</td>
                      <td>{dateDisplay(a.next_visit_due_date)}</td>
                      <td>{overdueDays !== null ? overdueDays : '—'}</td>
                      <td>
                        {lastBill ? (
                          <span className="badge" style={lastBill.status === 'failed' ? { background: '#C0392B', color: '#fff' } : {}}>
                            {lastBill.status}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
                {atRisk.length === 0 && (
                  <tr><td colSpan="6" style={{ color: 'var(--mist)' }}>No agreements currently at risk.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: 16, marginBottom: 10 }}>Recently Lapsed / Canceled</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Property</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {recentlyLapsedOrCanceled.map((a) => (
                  <tr key={a.id}>
                    <td>{a.customer?.display_name || '—'}</td>
                    <td>{a.property?.street_address || '—'}{a.property?.unit ? ` #${a.property.unit}` : ''}</td>
                    <td>{a.tier?.name || '—'}</td>
                    <td>
                      <span className="badge" style={{ background: '#888', color: '#fff' }}>
                        {a.status === 'lapsed' ? 'Lapsed' : 'Canceled'}
                      </span>
                    </td>
                    <td>{a.canceled_reason || '—'}</td>
                  </tr>
                ))}
                {recentlyLapsedOrCanceled.length === 0 && (
                  <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>None yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
