import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { can } from './utils/permissions'
import OrgPicker from './OrgPicker'
import QuincyBrief from './QuincyBrief'

const BUCKETS = [
  { key: 'active', label: 'Active', tone: '#1F7A43' },
  { key: 'offered', label: 'Offered — not yet accepted', tone: '#2563EB' },
  { key: 'lapsed', label: 'Lapsed', tone: '#DC2626' },
  { key: 'never_offered', label: 'Never offered', tone: '#D97706' },
  { key: 'opted_out', label: 'Opted out', tone: '#64748B' },
]
const ROW_CAP = 200

function money(n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function dateDisplay(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function MaintenanceDashboard({ profile }) {
  const allowed = profile?.role === 'super_admin' || can(profile, 'view_maintenance_dashboard')
  const isSuperAdmin = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [rows, setRows] = useState([])
  const [mrr, setMrr] = useState(0)
  const [recentNoPlan, setRecentNoPlan] = useState([])
  const [loading, setLoading] = useState(true)
  const [bucket, setBucket] = useState(null)
  const [search, setSearch] = useState('')
  const [groupByCustomer, setGroupByCustomer] = useState(false)

  useEffect(() => {
    if (isSuperAdmin) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
  }, [isSuperAdmin])

  useEffect(() => { if (allowed && selectedOrg) loadData(selectedOrg) }, [allowed, selectedOrg])

  async function loadData(orgId) {
    setLoading(true)
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const [{ data: status }, { data: agr }, { data: props }, { data: custs }, { data: tiers }, { data: completed }] = await Promise.all([
      supabase.from('property_maintenance_status').select('*').eq('org_id', orgId),
      supabase.from('maintenance_agreements').select('price, billing_cycle').eq('org_id', orgId).eq('status', 'active'),
      supabase.from('properties').select('id, street_address, unit, city, customer_id').eq('org_id', orgId),
      supabase.from('customers').select('id, display_name').eq('org_id', orgId),
      supabase.from('maintenance_agreement_tiers').select('id, name').eq('org_id', orgId),
      supabase.from('jobs').select('id, job_number, completed_at, property_id, customer_id').eq('org_id', orgId).eq('status', 'completed').gte('completed_at', since).order('completed_at', { ascending: false }),
    ])

    const propMap = Object.fromEntries((props || []).map((p) => [p.id, p]))
    const custMap = Object.fromEntries((custs || []).map((c) => [c.id, c.display_name]))
    const tierMap = Object.fromEntries((tiers || []).map((t) => [t.id, t.name]))
    const statusByProp = Object.fromEntries((status || []).map((s) => [s.property_id, s]))

    const enriched = (status || []).map((s) => {
      const p = propMap[s.property_id]
      return {
        ...s,
        address: p ? p.street_address + (p.unit ? ' ' + p.unit : '') + (p.city ? ', ' + p.city : '') : '—',
        customer: custMap[s.customer_id] || '—',
        tier: s.active_tier_id ? (tierMap[s.active_tier_id] || 'Plan') : null,
      }
    })
    setRows(enriched)

    let m = 0
    ;(agr || []).forEach((a) => { m += a.billing_cycle === 'annual' ? Number(a.price || 0) / 12 : Number(a.price || 0) })
    setMrr(m)

    // Recently completed jobs whose property still has no active plan — the "did we sell it?" sweep.
    const noPlan = (completed || [])
      .filter((j) => { const st = statusByProp[j.property_id]; return st && !st.has_active_plan })
      .slice(0, 25)
      .map((j) => {
        const st = statusByProp[j.property_id]
        return {
          ...j,
          customer: custMap[j.customer_id] || '—',
          address: propMap[j.property_id] ? propMap[j.property_id].street_address : '—',
          offered: !!st && st.offer_count > 0,
        }
      })
    setRecentNoPlan(noPlan)
    setLoading(false)
  }

  const counts = BUCKETS.reduce((acc, b) => { acc[b.key] = rows.filter((r) => r.status === b.key).length; return acc }, {})
  const acv = mrr * 12

  const q = search.trim().toLowerCase()
  const filtered = rows.filter((r) => {
    if (bucket && r.status !== bucket) return false
    if (q && !(`${r.customer} ${r.address}`.toLowerCase().includes(q))) return false
    return true
  })
  const shown = filtered.slice(0, ROW_CAP)

  const grouped = {}
  if (groupByCustomer) shown.forEach((r) => { (grouped[r.customer] = grouped[r.customer] || []).push(r) })

  if (!allowed) {
    return <div><h2 className="page-title">Maintenance Dashboard</h2><p style={{ color: 'var(--mist)' }}>You don't have access to this page. Ask an owner to grant the Maintenance Dashboard permission in Roles &amp; Tags.</p></div>
  }

  function StatusPill({ s }) {
    const b = BUCKETS.find((x) => x.key === s)
    return <span style={{ fontSize: 12, fontWeight: 600, color: b?.tone || '#64748B' }}>{b?.label.split(' — ')[0] || s}</span>
  }

  function Row({ r }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderBottom: '1px solid var(--border, #E2E6ED)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link to={`/customers/${r.customer_id}`} style={{ fontWeight: 600, textDecoration: 'none', color: 'inherit' }}>{r.customer}</Link>
          <div style={{ fontSize: 13, color: 'var(--mist, #64748B)' }}>{r.address}</div>
        </div>
        <div style={{ minWidth: 120 }}><StatusPill s={r.status} /></div>
        <div style={{ minWidth: 110, fontSize: 13 }}>{r.tier ? `${r.tier}${r.billing_cycle ? ' · ' + r.billing_cycle : ''}` : '—'}</div>
        <div style={{ minWidth: 130, fontSize: 13, color: 'var(--mist, #64748B)' }}>{r.last_offered_at ? `Offered ${dateDisplay(r.last_offered_at)}` : (r.status === 'active' ? '' : 'Never offered')}</div>
        <div style={{ minWidth: 90, textAlign: 'right' }}>
          {r.status === 'active'
            ? <Link to="/maintenance-due" style={{ fontSize: 13 }}>Visits ›</Link>
            : <Link to={`/customers/${r.customer_id}`} style={{ fontSize: 13 }}>Open ›</Link>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Maintenance Dashboard</h2>
        <span className="badge">{rows.length.toLocaleString()} properties</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <QuincyBrief kind="maintenance" context={{
          monthlyRecurringRevenue: Math.round(mrr),
          annualizedContractValue: Math.round(acv),
          totalProperties: rows.length,
          active: counts.active || 0,
          offeredNotAccepted: counts.offered || 0,
          lapsed: counts.lapsed || 0,
          neverOffered: counts.never_offered || 0,
          optedOut: counts.opted_out || 0,
          recentlyCompletedNoPlan: recentNoPlan.length,
        }} />
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {/* Recurring revenue on file — the asset numbers */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 18 }}>
        <div className="stat-tile"><div className="stat-value">{money(mrr)}</div><div className="stat-label">Monthly recurring revenue</div></div>
        <div className="stat-tile"><div className="stat-value">{money(acv)}</div><div className="stat-label">Annualized contract value</div></div>
      </div>

      {/* Acceptance-status buckets — click to filter the list */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {BUCKETS.map((b) => (
          <button key={b.key} onClick={() => setBucket(bucket === b.key ? null : b.key)}
            className="stat-tile" style={{ cursor: 'pointer', textAlign: 'left', border: bucket === b.key ? `2px solid ${b.tone}` : '2px solid transparent', minWidth: 150 }}>
            <div className="stat-value" style={{ color: b.tone }}>{(counts[b.key] || 0).toLocaleString()}</div>
            <div className="stat-label">{b.label}</div>
          </button>
        ))}
      </div>

      {/* Recently completed with no plan — the daily "did we sell it?" sweep */}
      {recentNoPlan.length > 0 && (
        <div style={{ marginBottom: 22, border: '1px solid var(--border, #E2E6ED)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '9px 12px', background: 'var(--rail, #F1F5F9)', fontWeight: 600, fontSize: 14 }}>
            Recently completed — still no plan ({recentNoPlan.length})
          </div>
          {recentNoPlan.map((j) => (
            <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderTop: '1px solid var(--border, #E2E6ED)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/customers/${j.customer_id}`} style={{ fontWeight: 600, textDecoration: 'none', color: 'inherit' }}>{j.customer}</Link>
                <div style={{ fontSize: 13, color: 'var(--mist, #64748B)' }}>{j.address} · {j.job_number} · completed {dateDisplay(j.completed_at)}</div>
              </div>
              <div style={{ minWidth: 150, textAlign: 'right', fontSize: 13, color: j.offered ? '#2563EB' : '#D97706', fontWeight: 600 }}>
                {j.offered ? 'Offered — follow up' : 'Not offered yet'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Property list */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder="Search customer or address…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '8px 10px', border: '1px solid var(--border, #E2E6ED)', borderRadius: 6 }} />
        {bucket && <button className="logout-button" onClick={() => setBucket(null)}>Clear filter: {BUCKETS.find((b) => b.key === bucket)?.label}</button>}
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={groupByCustomer} onChange={(e) => setGroupByCustomer(e.target.checked)} /> Group by customer
        </label>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist, #64748B)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--mist, #64748B)' }}>{bucket || q ? 'No properties match.' : 'No properties yet.'}</p>
      ) : (
        <>
          <div style={{ border: '1px solid var(--border, #E2E6ED)', borderRadius: 8, overflow: 'hidden' }}>
            {groupByCustomer
              ? Object.keys(grouped).sort().map((cust) => (
                  <div key={cust}>
                    <div style={{ padding: '8px 12px', background: 'var(--rail, #F1F5F9)', fontWeight: 600, fontSize: 13 }}>{cust} <span style={{ color: 'var(--mist)', fontWeight: 400 }}>· {grouped[cust].length}</span></div>
                    {grouped[cust].map((r) => <Row key={r.property_id} r={r} />)}
                  </div>
                ))
              : shown.map((r) => <Row key={r.property_id} r={r} />)}
          </div>
          {filtered.length > ROW_CAP && <p style={{ color: 'var(--mist, #64748B)', fontSize: 13, marginTop: 8 }}>Showing first {ROW_CAP} of {filtered.length.toLocaleString()} — refine with search or a status filter.</p>}
        </>
      )}
    </div>
  )
}
