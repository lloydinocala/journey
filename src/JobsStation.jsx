import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { can } from './utils/permissions'
import OrgPicker from './OrgPicker'
import StationShell, { StationKpi } from './StationShell'

const money0 = (n) => '$' + Math.round(Number(n) || 0).toLocaleString()

// Completed jobs that have no invoice yet — finished work that hasn't been billed.
async function completedNotInvoiced(org) {
  const { data: jobs } = await supabase.from('jobs').select('id').eq('org_id', org).eq('status', 'completed').is('deleted_at', null)
  const ids = (jobs || []).map((j) => j.id)
  if (!ids.length) return 0
  const { data: inv } = await supabase.from('invoices').select('job_id').eq('kind', 'invoice').is('deleted_at', null).in('job_id', ids)
  const invoiced = new Set((inv || []).map((i) => i.job_id))
  return ids.filter((id) => !invoiced.has(id)).length
}

// The Jobs Dash — the Jobs & Customers domain landing. Surfaces the job -> invoice
// -> payment lifecycle (distinct from Dispatch's intake/schedule), with an owner
// money tier (A/R, collected) and an ops backlog tier.
export default function JobsStation({ profile }) {
  const nav = useNavigate()
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)
  const opsAdmin = isSuper || can(profile, 'view_operational_metrics')
  const ownerAdmin = isSuper || can(profile, 'view_owner_metrics')

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [isSuper])
  useEffect(() => { if (selectedOrg) load(); else setLoading(false) }, [selectedOrg])

  async function load() {
    setLoading(true)
    const org = selectedOrg
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString()
    const [completed, toSendRes, arRes, estRes, paidRes] = await Promise.all([
      completedNotInvoiced(org),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('org_id', org).is('deleted_at', null).not('is_filter_order', 'is', true).eq('kind', 'invoice').is('sent_at', null),
      supabase.from('invoices').select('balance, amount_due').eq('org_id', org).is('deleted_at', null).not('is_filter_order', 'is', true).eq('kind', 'invoice').not('sent_at', 'is', null).is('paid_at', null),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('org_id', org).is('deleted_at', null).eq('kind', 'estimate').not('sent_at', 'is', null).is('converted_to_job_id', null),
      supabase.from('invoices').select('total_paid, job_total, amount_due').eq('org_id', org).is('deleted_at', null).not('is_filter_order', 'is', true).eq('kind', 'invoice').not('paid_at', 'is', null).gte('paid_at', since30),
    ])
    const arRows = arRes.data || []
    const arTotal = arRows.reduce((s, r) => s + (Number(r.balance ?? r.amount_due) || 0), 0)
    const collected = (paidRes.data || []).reduce((s, r) => s + (Number(r.total_paid || r.job_total || r.amount_due) || 0), 0)
    setD({ completed, toSend: toSendRes.count || 0, unpaid: arRows.length, arTotal, estPending: estRes.count || 0, collected })
    setLoading(false)
  }

  const signals = d ? [
    { key: 'bill', name: 'Completed — needs invoicing', n: d.completed, tone: 'red', line: d.completed ? `${d.completed} finished job${d.completed === 1 ? '' : 's'} not yet billed` : 'all completed work billed', cta: 'Open jobs', onClick: () => nav('/jobs') },
    { key: 'send', name: 'Invoices to send', n: d.toSend, tone: 'amber', line: d.toSend ? `${d.toSend} invoice${d.toSend === 1 ? '' : 's'} created, not sent` : 'none waiting to send', cta: 'Open invoices', onClick: () => nav('/invoices') },
    { key: 'ar', name: 'Unpaid invoices', n: d.unpaid, tone: 'amber', line: d.unpaid ? `${d.unpaid} sent, still unpaid` : 'nothing outstanding', cta: 'Open invoices', onClick: () => nav('/invoices') },
    { key: 'est', name: 'Estimates pending', n: d.estPending, tone: 'amber', line: d.estPending ? `${d.estPending} sent, awaiting a decision` : 'none pending', cta: 'Open estimates', onClick: () => nav('/estimates') },
  ] : []
  const need = signals.filter((s) => (s.n || 0) > 0)
  const total = need.reduce((a, s) => a + (s.n || 0), 0)
  const sub = total > 0 ? (<>Jobs moving to billing — <b style={{ color: 'inherit' }}>{total}</b> across {need.length} area{need.length === 1 ? '' : 's'} need a hand.</>) : "Every job is billed, sent, and collected."

  const ownerCards = d ? (<>
    <StationKpi label="A/R outstanding" big={money0(d.arTotal)} sub={`${d.unpaid} unpaid invoice${d.unpaid === 1 ? '' : 's'}`} tone={d.arTotal > 0 ? 'alert' : 'opp'} onClick={() => nav('/invoices')} />
    <StationKpi label="Collected (30 days)" big={money0(d.collected)} sub="payments received" tone="opp" />
  </>) : null
  const opsCards = d ? (<>
    <StationKpi label="Unbilled completed" big={String(d.completed)} sub="finished, not invoiced" tone={d.completed > 0 ? 'alert' : undefined} onClick={() => nav('/jobs')} />
    <StationKpi label="Unsent invoices" big={String(d.toSend)} sub="created, not sent" tone={d.toSend > 0 ? 'alert' : undefined} onClick={() => nav('/invoices')} />
  </>) : null

  return (
    <div style={{ padding: '22px 24px 70px' }}>
      <StationShell
        eyebrow="Jobs & Customers"
        officeTitle="Your jobs dashboard"
        adminTitle="Jobs & billing health"
        officeSubtitle={sub}
        loading={loading}
        signals={signals}
        opsAdmin={opsAdmin} ownerAdmin={ownerAdmin}
        opsCards={opsCards} ownerCards={ownerCards}
        emptyHint="Completed work is billed, invoices are out, and A/R is clear."
        fanoutNote={<>Unpaid invoices are <b style={{ color: 'var(--mist)' }}>a follow-up</b> for the office and <b style={{ color: 'var(--mist)' }}>dollars in A/R</b> for you — same source, two views.</>}
        headerRight={isSuper ? <div><div style={{ fontSize: 11.5, color: '#98A2AD', marginBottom: 4, textAlign: 'right' }}>Organization</div><OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} /></div> : null}
      />
    </div>
  )
}
