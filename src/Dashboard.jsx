import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { fetchAllRows } from './utils/csvImport'

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function startOfYear() {
  const d = new Date()
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

function money(n) {
  return '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function TileGrid({ tiles }) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {tiles.map((t) => (
        <div key={t.label} className="stat-tile">
          <div style={{ fontSize: 13, color: 'var(--mist)' }}>{t.label}</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{t.value}</div>
        </div>
      ))}
    </div>
  )
}

function ReminderRow({ label, count, detail, to }) {
  const urgent = count > 0
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #eee' }}>
      <div>
        <span style={{ fontWeight: urgent ? 600 : 400 }}>{label}</span>
        {detail && <span style={{ color: 'var(--mist)', fontSize: 13, marginLeft: 8 }}>{detail}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="badge" style={urgent ? { background: '#a33', color: '#fff' } : {}}>{count}</span>
        {urgent && to && (
          <Link to={to} className="logout-button" style={{ padding: '2px 10px', fontSize: 12 }}>
            View
          </Link>
        )}
      </div>
    </div>
  )
}

function PlatformHealth({ orgs }) {
  if (orgs.length === 0) return null
  const now = new Date()
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ marginBottom: 10 }}>Platform Health</h3>
        <Link to="/organizations" className="logout-button" style={{ fontSize: 12 }}>
          Manage Organizations →
        </Link>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Billing Status</th>
              <th>Trial Ends</th>
              <th>Stripe</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => {
              const trialDaysLeft = o.trial_ends_at ? Math.ceil((new Date(o.trial_ends_at) - now) / DAY_MS) : null
              const flags = []
              if (o.billing_status === 'trial' && trialDaysLeft !== null && trialDaysLeft <= 7) {
                flags.push(trialDaysLeft <= 0 ? 'Trial expired' : `Trial ends in ${trialDaysLeft}d`)
              }
              if (!o.stripe_charges_enabled) flags.push('Stripe not enabled')
              return (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td>
                    <span className={`status-pill status-${o.billing_status}`}>{o.billing_status}</span>
                  </td>
                  <td>{o.trial_ends_at ? new Date(o.trial_ends_at).toLocaleDateString() : '—'}</td>
                  <td>{o.stripe_charges_enabled ? 'Enabled' : 'Not enabled'}</td>
                  <td>
                    {flags.length === 0
                      ? '—'
                      : flags.map((f) => (
                          <span key={f} className="badge" style={{ background: '#a33', color: '#fff', marginRight: 4 }}>
                            {f}
                          </span>
                        ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OrgDashboard({ orgId, showAccounting, showOperations }) {
  const [loading, setLoading] = useState(true)
  const [orgInfo, setOrgInfo] = useState(null)
  const [jobs, setJobs] = useState([])
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [leads, setLeads] = useState([])
  const [agreements, setAgreements] = useState([])
  const [approvals, setApprovals] = useState([])

  useEffect(() => {
    if (orgId) loadAll(orgId)
  }, [orgId])

  async function loadAll(id) {
    setLoading(true)
    try {
      const [orgRes, jobsData, invoicesData, customersData, leadsData, agreementsData, approvalsData] = await Promise.all([
        supabase.from('organizations').select('name, payment_terms_days').eq('id', id).single(),
        fetchAllRows(() =>
          supabase
            .from('jobs')
            .select(`
              id, job_number, status, job_date, customer_id,
              job_technicians ( sort_order, users ( id, full_name ) )
            `)
            .eq('org_id', id)
        ),
        fetchAllRows(() =>
          supabase
            .from('invoices')
            .select('id, kind, invoice_date, job_total, balance, approval_status, paid_at, job_id, profit_pct')
            .eq('org_id', id)
        ),
        fetchAllRows(() => supabase.from('customers').select('id, created_at, is_active, is_banned').eq('org_id', id)),
        fetchAllRows(() => supabase.from('leads').select('id, status, created_at').eq('org_id', id)),
        fetchAllRows(() =>
          supabase
            .from('maintenance_agreements')
            .select('id, status, billing_cycle, price, next_visit_due_date, tier:maintenance_agreement_tiers(name)')
            .eq('org_id', id)
        ),
        fetchAllRows(() => supabase.from('job_approvals').select('job_id, stage').eq('org_id', id)),
      ])

      setOrgInfo(orgRes.data)
      setJobs(jobsData)
      setInvoices(invoicesData)
      setCustomers(customersData)
      setLeads(leadsData)
      setAgreements(agreementsData)
      setApprovals(approvalsData)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  if (loading) return <p style={{ color: 'var(--mist)' }}>Loading dashboard…</p>
  if (!orgInfo) return null

  const today = new Date().toISOString().slice(0, 10)
  const monthStart = startOfMonth()
  const yearStart = startOfYear()
  const paymentTermsDays = orgInfo.payment_terms_days || 0

  // Jobs
  const jobsToday = jobs.filter((j) => j.job_date === today)
  const upcomingUnassigned = jobs.filter((j) => j.job_date >= today && (!j.job_technicians || j.job_technicians.length === 0))
  const incompleteJobs = jobs.filter((j) => j.status === 'incomplete')

  const invoicedJobIds = new Set(invoices.filter((i) => i.kind === 'invoice').map((i) => i.job_id))
  const completedNoInvoice = jobs.filter((j) => j.status === 'completed' && !invoicedJobIds.has(j.id))

  const approvedJobIds = new Set(approvals.map((a) => a.job_id))
  const completedNoApproval = jobs.filter((j) => j.status === 'completed' && !approvedJobIds.has(j.id))

  // Revenue
  const realInvoices = invoices.filter((i) => i.kind === 'invoice')
  const mtdRevenue = realInvoices
    .filter((i) => i.invoice_date >= monthStart)
    .reduce((s, i) => s + Number(i.job_total || 0), 0)
  const ytdRevenue = realInvoices
    .filter((i) => i.invoice_date >= yearStart)
    .reduce((s, i) => s + Number(i.job_total || 0), 0)
  const outstanding = realInvoices.filter((i) => Number(i.balance) > 0)
  const outstandingTotal = outstanding.reduce((s, i) => s + Number(i.balance || 0), 0)
  const avgTicket = realInvoices.length
    ? realInvoices.reduce((s, i) => s + Number(i.job_total || 0), 0) / realInvoices.length
    : 0

  const agingBuckets = { current: 0, d30: 0, d60: 0, d90: 0 }
  const overdueInvoices = []
  outstanding.forEach((i) => {
    const dueDate = new Date(i.invoice_date)
    dueDate.setDate(dueDate.getDate() + paymentTermsDays)
    const daysPastDue = Math.floor((new Date(today) - dueDate) / DAY_MS)
    if (daysPastDue <= 0) {
      agingBuckets.current += Number(i.balance)
    } else {
      overdueInvoices.push(i)
      if (daysPastDue <= 30) agingBuckets.d30 += Number(i.balance)
      else if (daysPastDue <= 60) agingBuckets.d60 += Number(i.balance)
      else agingBuckets.d90 += Number(i.balance)
    }
  })

  const profitTracked = realInvoices.filter((i) => i.profit_pct !== null && i.profit_pct !== undefined)
  const avgProfitPct = profitTracked.length
    ? profitTracked.reduce((s, i) => s + Number(i.profit_pct), 0) / profitTracked.length
    : null

  // Estimates
  const estimates = invoices.filter((i) => i.kind === 'estimate')
  const openEstimates = estimates.filter((i) => i.approval_status === 'Pending')
  const pendingFinancing = estimates.filter((i) => i.approval_status === 'Pending Financing')
  const approvedEstimates = estimates.filter((i) => i.approval_status === 'Approved')
  const rejectedEstimates = estimates.filter((i) => i.approval_status === 'Rejected')
  const decidedCount = approvedEstimates.length + rejectedEstimates.length
  const conversionRate = decidedCount ? (approvedEstimates.length / decidedCount) * 100 : null
  const staleEstimates = [...openEstimates, ...pendingFinancing].filter(
    (i) => i.invoice_date && i.invoice_date <= daysAgo(14)
  )
  const openEstimatesValue = openEstimates.reduce((s, i) => s + Number(i.job_total || 0), 0)

  // Maintenance agreements
  const activeAgreements = agreements.filter((a) => a.status === 'active')
  const mrr = activeAgreements.reduce(
    (s, a) => s + (a.billing_cycle === 'monthly' ? Number(a.price) : Number(a.price) / 12),
    0
  )
  const upcomingVisits = agreements.filter(
    (a) => a.next_visit_due_date && a.next_visit_due_date >= today && a.next_visit_due_date <= daysFromNow(14)
  )

  // Customers
  const newCustomersThisMonth = customers.filter((c) => c.created_at >= monthStart)
  const doNotServiceCount = customers.filter((c) => c.is_banned).length
  const lastJobByCustomer = {}
  jobs.forEach((j) => {
    if (!j.customer_id) return
    if (!lastJobByCustomer[j.customer_id] || j.job_date > lastJobByCustomer[j.customer_id]) {
      lastJobByCustomer[j.customer_id] = j.job_date
    }
  })
  const winBackCandidates = customers.filter((c) => {
    if (!c.is_active) return false
    const last = lastJobByCustomer[c.id]
    return !last || last <= daysAgo(365)
  })

  // Leads
  const newLeadsThisWeek = leads.filter((l) => l.created_at >= daysAgo(7))
  const uncontactedLeads = leads.filter(
    (l) => l.status === 'new' && l.created_at <= new Date(Date.now() - DAY_MS).toISOString()
  )

  // Team
  function techsFor(job) {
    return (job.job_technicians || []).map((jt) => jt.users).filter(Boolean)
  }
  const techStats = {}
  jobs.forEach((j) => {
    techsFor(j).forEach((t) => {
      if (!techStats[t.id]) techStats[t.id] = { id: t.id, name: t.full_name, completed: 0, revenue: 0 }
      if (j.status === 'completed') techStats[t.id].completed += 1
    })
  })
  invoices
    .filter((i) => i.kind === 'invoice')
    .forEach((inv) => {
      const job = jobs.find((j) => j.id === inv.job_id)
      if (!job) return
      techsFor(job).forEach((t) => {
        if (!techStats[t.id]) return
        techStats[t.id].revenue += Number(inv.job_total || 0)
      })
    })
  const teamRows = Object.values(techStats).sort((a, b) => b.revenue - a.revenue)

  if (!showAccounting && !showOperations) {
    return (
      <div>
        <h3 style={{ marginTop: 32, marginBottom: 14 }}>{orgInfo.name}</h3>
        <p style={{ color: 'var(--mist)' }}>
          You don't have access to any dashboard sections yet. Ask your Org Admin to assign you Accounting and/or
          Operations access under Team.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h3 style={{ marginTop: 32, marginBottom: 4 }}>{orgInfo.name}</h3>

      {showAccounting && (
        <div style={{ marginBottom: 36 }}>
          <h3 style={{ marginTop: 24, marginBottom: 14, borderBottom: '2px solid #ddd', paddingBottom: 6 }}>
            Accounting
          </h3>

          <h4 style={{ marginTop: 16, marginBottom: 10 }}>Revenue</h4>
          <TileGrid
            tiles={[
              { label: 'MTD Revenue', value: money(mtdRevenue) },
              { label: 'YTD Revenue', value: money(ytdRevenue) },
              { label: 'Outstanding AR', value: money(outstandingTotal) },
              { label: 'Avg Ticket', value: money(avgTicket) },
              { label: 'Avg Profit %', value: avgProfitPct !== null ? avgProfitPct.toFixed(1) + '%' : 'Not tracked yet' },
            ]}
          />
          <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 8 }}>
            AR aging — Current: {money(agingBuckets.current)} · 1-30d: {money(agingBuckets.d30)} · 31-60d:{' '}
            {money(agingBuckets.d60)} · 60d+: {money(agingBuckets.d90)}
          </p>

          <h4 style={{ marginTop: 28, marginBottom: 10 }}>Recurring Revenue</h4>
          <TileGrid
            tiles={[
              { label: 'Active Agreements', value: activeAgreements.length },
              { label: 'Estimated MRR', value: money(mrr) },
            ]}
          />

          <h4 style={{ marginTop: 28, marginBottom: 10 }}>Accounts Payable</h4>
          <p style={{ color: 'var(--mist)', fontSize: 13 }}>
            Not tracked yet — there's no vendor bills/expenses table in the schema. Let me know if you want this
            built out and what it needs to cover (vendor bills, recurring expenses, etc.).
          </p>

          <h4 style={{ marginTop: 28, marginBottom: 10 }}>Reminders</h4>
          <div className="data-table" style={{ padding: 0 }}>
            <ReminderRow
              label="Overdue invoices"
              count={overdueInvoices.length}
              detail={
                overdueInvoices.length
                  ? money(overdueInvoices.reduce((s, i) => s + Number(i.balance), 0)) + ' outstanding'
                  : null
              }
              to="/invoices"
            />
            <ReminderRow label="Completed jobs with no invoice" count={completedNoInvoice.length} to="/jobs" />
          </div>
        </div>
      )}

      {showOperations && (
        <div>
          <h3 style={{ marginTop: 24, marginBottom: 14, borderBottom: '2px solid #ddd', paddingBottom: 6 }}>
            Operations
          </h3>

          <h4 style={{ marginTop: 16, marginBottom: 10 }}>Today</h4>
          <TileGrid
            tiles={[
              { label: 'Jobs Today', value: jobsToday.length },
              { label: 'Incomplete Jobs', value: incompleteJobs.length },
              { label: 'Upcoming Unassigned', value: upcomingUnassigned.length },
            ]}
          />

          <h4 style={{ marginTop: 28, marginBottom: 10 }}>Estimates</h4>
          <TileGrid
            tiles={[
              { label: 'Open Estimates', value: openEstimates.length },
              { label: 'Open Value', value: money(openEstimatesValue) },
              { label: 'Pending Financing', value: pendingFinancing.length },
              { label: 'Conversion Rate', value: conversionRate !== null ? conversionRate.toFixed(0) + '%' : '—' },
            ]}
          />

          <h4 style={{ marginTop: 28, marginBottom: 10 }}>Maintenance Visits</h4>
          <TileGrid tiles={[{ label: 'Visits Due (14d)', value: upcomingVisits.length }]} />

          <h4 style={{ marginTop: 28, marginBottom: 10 }}>Customers &amp; Leads</h4>
          <TileGrid
            tiles={[
              { label: 'New Customers (Month)', value: newCustomersThisMonth.length },
              { label: 'Do Not Service', value: doNotServiceCount },
              { label: 'Win-back Candidates', value: winBackCandidates.length },
              { label: 'New Leads (7d)', value: newLeadsThisWeek.length },
              { label: 'Uncontacted Leads', value: uncontactedLeads.length },
            ]}
          />

          <h4 style={{ marginTop: 28, marginBottom: 10 }}>Reminders</h4>
          <div className="data-table" style={{ padding: 0 }}>
            <ReminderRow label="Jobs stuck incomplete" count={incompleteJobs.length} to="/jobs" />
            <ReminderRow label="Completed jobs missing signed approval" count={completedNoApproval.length} to="/jobs" />
            <ReminderRow label="Stale estimates (14d+, no decision)" count={staleEstimates.length} to="/estimates" />
            <ReminderRow label="Leads not yet contacted (24h+)" count={uncontactedLeads.length} to="/customers" />
            <ReminderRow
              label="Maintenance visits due within 14 days"
              count={upcomingVisits.length}
              to="/maintenance-agreements"
            />
          </div>
        </div>
      )}

      {showAccounting && teamRows.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h4 style={{ marginTop: 28, marginBottom: 10 }}>Team Revenue</h4>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>Jobs Completed</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.completed}</td>
                    <td>{money(t.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ profile }) {
  const isSuperAdmin = profile?.role === 'super_admin'
  const fullAccess = profile?.role === 'super_admin' || profile?.role === 'org_admin'
  const showAccounting = fullAccess || !!profile?.can_view_accounting
  const showOperations = fullAccess || !!profile?.can_view_operations

  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase
        .from('organizations')
        .select('id, name, billing_status, trial_ends_at, stripe_charges_enabled, payment_terms_days')
        .order('name')
        .then(({ data }) => {
          setOrgs(data || [])
          if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
        })
    }
  }, [])

  if (!profile) return null

  return (
    <div>
      <p style={{ color: 'var(--mist)' }}>Welcome, {profile.full_name}.</p>

      {isSuperAdmin && <PlatformHealth orgs={orgs} />}

      {isSuperAdmin && orgs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>
            Viewing organization
          </label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {selectedOrg && (
        <OrgDashboard orgId={selectedOrg} showAccounting={showAccounting} showOperations={showOperations} />
      )}
    </div>
  )
}
