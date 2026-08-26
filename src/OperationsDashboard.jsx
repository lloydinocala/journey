import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

// A WORKING dashboard for office staff — a queue of what needs doing, not a report.
// Every number links to the thing to resolve. Goal: clear the board to zero.

const C = {
  ink: '#1F2A37', mist: '#64748B', line: '#E7EBF0', card: '#FFFFFF',
  blue: '#2E6FB5',
  amber: '#B45309', amberBg: '#FEF3C7',
  over: '#B0472B', overBg: '#F7E2DA',
  good: '#15803D', goodBg: '#E7F5EC',
}

const money = (n) => '$' + Math.round(Number(n || 0)).toLocaleString()
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null)
const ageLabel = (days) => (days == null ? '' : days <= 0 ? 'today' : days === 1 ? '1 day' : `${days} days`)

function Pill({ tone, children }) {
  const map = { amber: [C.amber, C.amberBg], over: [C.over, C.overBg], good: [C.good, C.goodBg], mist: [C.mist, '#EEF2F6'] }
  const [fg, bg] = map[tone] || map.mist
  return <span style={{ fontSize: 11, fontWeight: 700, color: fg, background: bg, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{children}</span>
}

export default function OperationsDashboard({ profile }) {
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  const load = useCallback(async (orgId) => {
    if (!orgId) return
    const now = new Date()
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0)
    const in30 = new Date(now); in30.setDate(now.getDate() + 30)
    const iso = (dt) => dt.toISOString()
    const dateStr = (dt) => dt.toISOString().slice(0, 10)

    const [invRes, jobRes, agrRes, payRes, ocRes] = await Promise.all([
      supabase.from('invoices')
        .select('id, invoice_number, kind, estimate_type, sent_at, approval_status, approved_at, job_total, total_paid, job_id, property_id, bills_to_customer_id')
        .eq('org_id', orgId).is('deleted_at', null).eq('is_archived', false),
      supabase.from('jobs')
        .select('id, job_number, status, date_pending, job_date, completed_at, customer_id')
        .eq('org_id', orgId).is('deleted_at', null),
      supabase.from('maintenance_agreements')
        .select('id, next_visit_due_date, status, customer_id')
        .eq('org_id', orgId).eq('is_archived', false).not('next_visit_due_date', 'is', null),
      supabase.from('invoice_payments')
        .select('amount, recorded_at').eq('org_id', orgId).gte('recorded_at', iso(weekStart)),
      supabase.from('on_call_schedule')
        .select('period_end').eq('org_id', orgId).order('period_end', { ascending: false }).limit(1),
    ])
    const inv = invRes.data || [], jobs = jobRes.data || [], agr = agrRes.data || [], pays = payRes.data || []
    const onCallEnd = ocRes.data && ocRes.data[0] ? ocRes.data[0].period_end : null
    const twoWeeksOut = new Date(now); twoWeeksOut.setDate(now.getDate() + 14)
    const onCallShort = !onCallEnd || new Date(onCallEnd) < twoWeeksOut

    // resolve customer names
    const custIds = new Set()
    inv.forEach((i) => i.bills_to_customer_id && custIds.add(i.bills_to_customer_id))
    jobs.forEach((j) => j.customer_id && custIds.add(j.customer_id))
    agr.forEach((a) => a.customer_id && custIds.add(a.customer_id))
    let custById = {}
    if (custIds.size) {
      const { data: cs } = await supabase.from('customers').select('id, display_name').in('id', [...custIds])
      custById = Object.fromEntries((cs || []).map((c) => [c.id, c.display_name]))
    }
    const cname = (id) => custById[id] || 'Unknown'

    const bal = (i) => Number(i.job_total || 0) - Number(i.total_paid || 0)

    // buckets
    const unpaid = inv.filter((i) => i.kind === 'invoice' && i.sent_at && bal(i) > 0.5)
      .map((i) => ({ id: i.id, num: i.invoice_number, cust: cname(i.bills_to_customer_id), amt: bal(i), days: daysSince(i.sent_at), link: `/invoices?invoice=${i.id}` }))
      .sort((a, b) => b.days - a.days)

    const pendEst = inv.filter((i) => i.kind === 'estimate' && i.sent_at && i.approval_status === 'Pending')
      .map((i) => ({ id: i.id, num: i.invoice_number, cust: cname(i.bills_to_customer_id), amt: i.job_total, days: daysSince(i.sent_at), link: i.estimate_type === 'system' ? `/system-estimates?estimate=${i.id}` : `/estimates?estimate=${i.id}` }))
      .sort((a, b) => b.days - a.days)

    const draftEst = inv.filter((i) => i.kind === 'estimate' && !i.sent_at && i.approval_status === 'Pending')
      .map((i) => ({ id: i.id, num: i.invoice_number, cust: cname(i.bills_to_customer_id), amt: i.job_total, days: daysSince(i.created_at), link: i.estimate_type === 'system' ? `/system-estimates?estimate=${i.id}` : `/estimates?estimate=${i.id}` }))

    const toSchedule = jobs.filter((j) => ['unscheduled', 'incomplete'].includes(j.status) || j.date_pending)
      .filter((j) => j.status !== 'canceled' && j.status !== 'completed')
      .map((j) => ({ id: j.id, num: j.job_number, cust: cname(j.customer_id), days: daysSince(j.job_date), link: `/jobs?job=${j.id}` }))

    const invoicedJobIds = new Set(inv.filter((i) => i.kind === 'invoice' && i.job_id).map((i) => i.job_id))
    const completedNotInvoiced = jobs.filter((j) => j.status === 'completed' && !invoicedJobIds.has(j.id))
      .map((j) => ({ id: j.id, num: j.job_number, cust: cname(j.customer_id), days: daysSince(j.completed_at), link: `/jobs?job=${j.id}` }))

    const maintDue = agr.filter((a) => a.next_visit_due_date <= dateStr(in30) && !['canceled', 'cancelled', 'expired'].includes((a.status || '').toLowerCase()))
      .map((a) => ({ id: a.id, cust: cname(a.customer_id), due: a.next_visit_due_date, days: daysSince(a.next_visit_due_date), link: '/maintenance-due' }))
      .sort((a, b) => b.days - a.days)

    // wins this week
    const collected = pays.reduce((s, p) => s + Number(p.amount || 0), 0)
    const wonWeek = inv.filter((i) => i.kind === 'estimate' && i.approval_status === 'Approved' && i.approved_at && new Date(i.approved_at) >= weekStart)
    const wonAmt = wonWeek.reduce((s, i) => s + Number(i.job_total || 0), 0)
    const completedWeek = jobs.filter((j) => j.completed_at && new Date(j.completed_at) >= weekStart).length

    // close rate (this week): approved / (approved + still-pending sent)
    const sentEstimates = inv.filter((i) => i.kind === 'estimate' && i.sent_at)
    const approvedCount = sentEstimates.filter((i) => i.approval_status === 'Approved').length
    const closeRate = sentEstimates.length ? Math.round((approvedCount / sentEstimates.length) * 100) : null

    setD({
      unpaid, pendEst, draftEst, toSchedule, completedNotInvoiced, maintDue,
      outstanding: unpaid.reduce((s, x) => s + x.amt, 0),
      pendEstTotal: pendEst.reduce((s, x) => s + Number(x.amt || 0), 0),
      draftEstTotal: draftEst.reduce((s, x) => s + Number(x.amt || 0), 0),
      collected, wonAmt, wonCount: wonWeek.length, completedWeek, closeRate,
      onCallShort, onCallEnd,
    })
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!selectedOrg && isSuperAdmin) return
    load(selectedOrg)
    const iv = setInterval(() => load(selectedOrg), 60000)
    const onFocus = () => load(selectedOrg)
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(iv); window.removeEventListener('focus', onFocus) }
  }, [selectedOrg, load])

  if (loading || !d) {
    return (
      <div>
        <h2 className="page-title">Operations Dashboard</h2>
        {isSuperAdmin && <div style={{ maxWidth: 320, marginBottom: 16 }}><OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} /></div>}
        <p style={{ color: C.mist }}>Loading the board…</p>
      </div>
    )
  }

  const invTone = (days) => (days >= 60 ? 'over' : days >= 30 ? 'amber' : 'mist')
  const estTone = (days) => (days >= 5 ? 'over' : days >= 2 ? 'amber' : 'mist')

  return (
    <div style={{ color: C.ink }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 className="page-title" style={{ marginBottom: 4 }}>Operations Dashboard</h2>
        <span style={{ fontSize: 11.5, color: C.mist }}>Live · updated {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
      </div>
      <p style={{ color: C.mist, fontSize: 13, marginTop: 0, marginBottom: 18 }}>What needs doing today. Click anything to go resolve it.</p>

      {isSuperAdmin && <div style={{ maxWidth: 320, marginBottom: 18 }}><OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} /></div>}

      {d.onCallShort && (
        <Link to="/on-call" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.amberBg, border: '1px solid #F0D8A0', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>⏰</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: C.amber, fontSize: 14 }}>Complete On-Call Calendar Assignments</div>
              <div style={{ fontSize: 12.5, color: '#8A6D2B' }}>Less than 2 weeks of on-call coverage is scheduled{d.onCallEnd ? ` — covered only through ${new Date(d.onCallEnd).toLocaleDateString()}` : ''}.</div>
            </div>
            <span style={{ color: C.amber, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>Go to On-Call Schedule &rarr;</span>
          </div>
        </Link>
      )}

      {/* Hero vital signs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 14 }}>
        <Vital label="Outstanding A/R" value={money(d.outstanding)} sub={`${d.unpaid.length} unpaid invoice${d.unpaid.length === 1 ? '' : 's'}`} to="/invoices" accent={d.outstanding > 0 ? C.over : C.good} />
        <Vital label="Estimates Out" value={money(d.pendEstTotal)} sub={`${d.pendEst.length} awaiting a reply`} to="/estimates" accent={d.pendEst.length ? C.amber : C.good} />
        <Vital label="Jobs to Schedule" value={String(d.toSchedule.length)} sub="need a real date" to="/jobs" accent={d.toSchedule.length ? C.amber : C.good} />
        <Vital label="Maintenance Due" value={String(d.maintDue.length)} sub="within 30 days" to="/maintenance-due" accent={d.maintDue.length ? C.amber : C.good} />
      </div>

      {/* Wins */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', background: C.goodBg, border: `1px solid #CFE8D8`, borderRadius: 12, padding: '12px 18px', marginBottom: 22 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.good, letterSpacing: 0.4, alignSelf: 'center' }}>THIS WEEK ✓</span>
        <Win label="Collected" value={money(d.collected)} />
        <Win label="Estimates won" value={`${money(d.wonAmt)} · ${d.wonCount}`} />
        <Win label="Jobs completed" value={String(d.completedWeek)} />
        {d.closeRate != null && <Win label="Close rate" value={`${d.closeRate}%`} />}
      </div>

      <SectionHead>Needs attention now</SectionHead>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card title="Unpaid Invoices" headline={money(d.outstanding)} count={d.unpaid.length} seeAll="/invoices" emptyMsg="No money on the street">
          {d.unpaid.slice(0, 4).map((x) => (
            <Row key={x.id} to={x.link} left={<>{x.num} · {x.cust}</>} right={<Pill tone={invTone(x.days)}>{ageLabel(x.days)}</Pill>} amt={money(x.amt)} />
          ))}
        </Card>

        <Card title="Estimates to Follow Up" headline={money(d.pendEstTotal)} count={d.pendEst.length} seeAll="/estimates" emptyMsg="No estimates waiting">
          {d.pendEst.slice(0, 4).map((x) => (
            <Row key={x.id} to={x.link} left={<>{x.num} · {x.cust}</>} right={<Pill tone={estTone(x.days)}>sent {ageLabel(x.days)}</Pill>} amt={money(x.amt)} />
          ))}
        </Card>

        <Card title="Jobs to Schedule" headline={String(d.toSchedule.length)} count={d.toSchedule.length} seeAll="/jobs" emptyMsg="Everything's on the calendar">
          {d.toSchedule.slice(0, 4).map((x) => (
            <Row key={x.id} to={x.link} left={<>{x.num} · {x.cust}</>} right={x.days != null ? <Pill tone="mist">placeholder {ageLabel(x.days)}</Pill> : null} />
          ))}
        </Card>

        <Card title="Completed, Not Invoiced" headline={String(d.completedNotInvoiced.length)} count={d.completedNotInvoiced.length} seeAll="/jobs" emptyMsg="All completed work is billed">
          {d.completedNotInvoiced.slice(0, 4).map((x) => (
            <Row key={x.id} to={x.link} left={<>{x.num} · {x.cust}</>} right={<Pill tone={x.days >= 3 ? 'over' : 'amber'}>done {ageLabel(x.days)}</Pill>} />
          ))}
        </Card>
      </div>

      <SectionHead>Coming up</SectionHead>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        <Card title="Maintenance Due" headline={String(d.maintDue.length)} count={d.maintDue.length} seeAll="/maintenance-due" emptyMsg="No visits due soon">
          {d.maintDue.slice(0, 4).map((x) => (
            <Row key={x.id} to={x.link} left={x.cust} right={<Pill tone={x.days > 0 ? 'over' : 'mist'}>{x.days > 0 ? `overdue ${ageLabel(x.days)}` : `due ${x.due}`}</Pill>} />
          ))}
        </Card>

        <Card title="Estimates Not Yet Sent" headline={money(d.draftEstTotal)} count={d.draftEst.length} seeAll="/estimates" emptyMsg="No drafts sitting">
          {d.draftEst.slice(0, 4).map((x) => (
            <Row key={x.id} to={x.link} left={<>{x.num} · {x.cust}</>} right={<Pill tone={x.days >= 3 ? 'amber' : 'mist'}>drafted {ageLabel(x.days)}</Pill>} amt={money(x.amt)} />
          ))}
        </Card>
      </div>
    </div>
  )
}

function Vital({ label, value, sub, to, accent }) {
  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px', borderLeft: `4px solid ${accent}`, height: '100%' }}>
        <div style={{ fontSize: 12, color: C.mist, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 2px', color: accent }}>{value}</div>
        <div style={{ fontSize: 12, color: C.mist }}>{sub}</div>
      </div>
    </Link>
  )
}

function Win({ label, value }) {
  return (
    <div style={{ alignSelf: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.good }}>{value}</div>
      <div style={{ fontSize: 11, color: '#4B8A64', fontWeight: 600 }}>{label}</div>
    </div>
  )
}

function SectionHead({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 800, color: C.mist, letterSpacing: 0.6, textTransform: 'uppercase', margin: '4px 0 12px' }}>{children}</div>
}

function Card({ title, headline, count, seeAll, emptyMsg, children }) {
  const empty = count === 0
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(20,30,50,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: empty ? C.good : C.ink }}>{empty ? '✓' : headline}</span>
      </div>
      {empty ? (
        <div style={{ fontSize: 13, color: C.good, fontWeight: 600, padding: '6px 0' }}>All caught up — {emptyMsg}</div>
      ) : (
        <>
          <div>{children}</div>
          {count > 4 && <Link to={seeAll} style={{ display: 'inline-block', marginTop: 8, fontSize: 12.5, color: C.blue, fontWeight: 600 }}>see all {count} →</Link>}
        </>
      )}
    </div>
  )
}

function Row({ to, left, right, amt }) {
  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: `1px solid ${C.line}` }}>
      <span style={{ flex: 1, fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{left}</span>
      {amt && <span style={{ fontSize: 13, fontWeight: 700 }}>{amt}</span>}
      {right}
    </Link>
  )
}
