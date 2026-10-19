import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { fetchAllRows } from './utils/csvImport'

// Service-request (QR sticker) success report. Counts EVERY request — archived ones
// included — so archiving old records never changes the numbers. Shown as a tab on the
// Service Requests page and pinned to the Command Center home as its own tab.

const money = (n) => '$' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) + '%' : '—')
const PERIODS = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'Last 12 months'], ['all', 'All time']]

export default function ServiceRequestReport({ profile, orgId, embedded }) {
  const org = orgId || profile?.org_id
  const [period, setPeriod] = useState('90')
  const [d, setD] = useState(null)

  useEffect(() => { if (org) load() }, [org, period])

  async function load() {
    setD(null)
    const since = period === 'all' ? null : new Date(Date.now() - Number(period) * 86400000).toISOString()
    const inPeriod = (q) => (since ? q.gte('created_at', since) : q)
    const [reqs, tokens, tenants, repairJobs, invoices] = await Promise.all([
      fetchAllRows(() => inPeriod(supabase.from('service_requests').select('id, status, category, requested_by_owner, owner_approved_at, owner_declined_at, created_at, job_id').eq('org_id', org))),
      fetchAllRows(() => supabase.from('property_service_tokens').select('property_id, qr_printed_at').eq('org_id', org).not('qr_printed_at', 'is', null)),
      fetchAllRows(() => supabase.from('property_tenants').select('property_id').eq('org_id', org)),
      fetchAllRows(() => inPeriod(supabase.from('jobs').select('id, job_type').eq('org_id', org).is('deleted_at', null))),
      fetchAllRows(() => inPeriod(supabase.from('invoices').select('job_id, job_total, sales_tax').eq('org_id', org).eq('kind', 'invoice').is('deleted_at', null).not('is_filter_order', 'is', true))),
    ])
    const R = reqs || []
    const converted = R.filter((r) => r.status === 'converted')
    const declined = R.filter((r) => r.status === 'declined')
    const pending = R.filter((r) => r.status === 'pending' || r.status === 'awaiting_owner')
    // Landlord approval: requests from someone other than the account holder.
    const needOwner = R.filter((r) => !r.requested_by_owner)
    const ownerApproved = needOwner.filter((r) => r.owner_approved_at)
    const ownerDeclined = needOwner.filter((r) => r.owner_declined_at)
    const responses = needOwner.filter((r) => r.owner_approved_at || r.owner_declined_at)
      .map((r) => (new Date(r.owner_approved_at || r.owner_declined_at) - new Date(r.created_at)) / 3600000)
    const avgHours = responses.length ? responses.reduce((s, h) => s + h, 0) / responses.length : null
    // Revenue from jobs that came from requests, and its share of all sales.
    const reqJobIds = new Set(converted.map((r) => r.job_id).filter(Boolean))
    const net = (i) => (Number(i.job_total) || 0) - (Number(i.sales_tax) || 0)
    const allSales = (invoices || []).reduce((s, i) => s + net(i), 0)
    const reqSales = (invoices || []).filter((i) => reqJobIds.has(i.job_id)).reduce((s, i) => s + net(i), 0)
    // Repair calls: came through a QR request vs phoned in.
    const repairs = (repairJobs || []).filter((j) => (j.job_type || '').toLowerCase().includes('repair'))
    const repairsViaQr = repairs.filter((j) => reqJobIds.has(j.id)).length
    // QR coverage.
    const qrProps = new Set((tokens || []).map((t) => t.property_id))
    const tenantProps = new Set((tenants || []).map((t) => t.property_id))
    const qrTenant = [...qrProps].filter((p) => tenantProps.has(p)).length
    setD({
      total: R.length, converted: converted.length, declined: declined.length, pending: pending.length,
      needOwner: needOwner.length, ownerApproved: ownerApproved.length, ownerDeclined: ownerDeclined.length, avgHours,
      reqSales, allSales, repairs: repairs.length, repairsViaQr,
      qrHomes: qrProps.size, qrTenant, perHome: qrProps.size ? R.length / qrProps.size : null,
    })
  }

  const tile = (label, value, sub, tone) => (
    <div className="section-card" style={{ padding: 14, borderTop: `3px solid ${tone || '#176E7A'}` }}>
      <div style={{ fontSize: 12, color: 'var(--mist)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, margin: '4px 0 2px', color: '#0f172a' }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{sub}</div>}
    </div>
  )

  if (!org) return <p style={{ color: 'var(--mist)' }}>Pick an organization on the Service Requests page to see its report.</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Service Request (QR) Success</div>
          <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>Every request counts here, including archived ones.{embedded && <> <Link to="/service-requests">Open Service Requests</Link></>}</div>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
          {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {!d ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
          {tile('Requests', d.total, `${d.converted} became jobs · ${d.declined} declined · ${d.pending} open`)}
          {tile('Became jobs', pct(d.converted, d.converted + d.declined), `${d.converted} of ${d.converted + d.declined} decided`, '#15803D')}
          {tile('Landlord approved', pct(d.ownerApproved, d.ownerApproved + d.ownerDeclined), `${d.ownerApproved} approved · ${d.ownerDeclined} declined · ${d.needOwner} needed approval`, '#15803D')}
          {tile('Landlord response time', d.avgHours == null ? '—' : d.avgHours < 24 ? `${d.avgHours.toFixed(1)} hrs` : `${(d.avgHours / 24).toFixed(1)} days`, 'average, request → landlord answer', '#B45309')}
          {tile('Repair calls via QR', pct(d.repairsViaQr, d.repairs), `${d.repairsViaQr} of ${d.repairs} repair jobs came through a request; the rest were phoned in`, '#2E6FB5')}
          {tile('Sales from requests', money(d.reqSales), `${pct(d.reqSales, d.allSales)} of ${money(d.allSales)} total sales (before tax)`, '#15803D')}
          {tile('Homes with QR codes', d.qrHomes, `${d.qrTenant} tenant-occupied`, '#6A54C4')}
          {tile('Requests per QR home', d.perHome == null ? '—' : d.perHome.toFixed(2), 'in this period', '#6A54C4')}
        </div>
      )}
    </div>
  )
}
