import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { can } from './utils/permissions'
import OrgPicker from './OrgPicker'
import StationShell, { StationKpi } from './StationShell'
import { useSignals } from './signals/useSignals'

const money0 = (n) => '$' + Math.round(Number(n) || 0).toLocaleString()

// Jobs Dash — task tiles come from the shared registry (useSignals). The owner
// tier's dollar figures (A/R outstanding, collected) are KPIs rather than task
// signals, so they stay as a small metric load; their COUNTS reuse the registry.
export default function JobsStation({ profile }) {
  const nav = useNavigate()
  const isSuper = profile?.role === 'super_admin'
  const opsAdmin = isSuper || can(profile, 'view_operational_metrics')
  const ownerAdmin = isSuper || can(profile, 'view_owner_metrics')
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [money, setMoney] = useState(null)

  useEffect(() => {
    if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []))
  }, [isSuper])

  const { signals, counts, loading, total, needing } = useSignals({ station: 'work' }, selectedOrg, nav)

  useEffect(() => {
    if (!selectedOrg) { setMoney(null); return }
    let live = true
    const run = async () => {
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString()
      const [arRes, paidRes] = await Promise.all([
        supabase.from('invoices').select('balance, amount_due').eq('org_id', selectedOrg).is('deleted_at', null).not('is_filter_order', 'is', true).eq('kind', 'invoice').not('sent_at', 'is', null).is('paid_at', null),
        supabase.from('invoices').select('total_paid, job_total, amount_due').eq('org_id', selectedOrg).is('deleted_at', null).not('is_filter_order', 'is', true).eq('kind', 'invoice').not('paid_at', 'is', null).gte('paid_at', since30),
      ])
      const arTotal = (arRes.data || []).reduce((s, r) => s + (Number(r.balance ?? r.amount_due) || 0), 0)
      const collected = (paidRes.data || []).reduce((s, r) => s + (Number(r.total_paid || r.job_total || r.amount_due) || 0), 0)
      if (live) setMoney({ arTotal, collected })
    }
    run()
    return () => { live = false }
  }, [selectedOrg])

  const sub = loading
    ? 'Checking what needs a hand…'
    : total > 0
      ? (<>Jobs moving to billing — <b style={{ color: 'inherit' }}>{total}</b> across {needing.length} area{needing.length === 1 ? '' : 's'} need a hand.</>)
      : 'Every job is billed, sent, and collected.'

  const unpaid = counts['unpaid-invoices'] || 0
  const completed = counts['completed-not-invoiced'] || 0
  const toSend = counts['invoices-to-send'] || 0

  const ownerCards = money ? (<>
    <StationKpi label="A/R outstanding" big={money0(money.arTotal)} sub={`${unpaid} unpaid invoice${unpaid === 1 ? '' : 's'}`} tone={money.arTotal > 0 ? 'alert' : 'opp'} onClick={() => nav('/invoices')} />
    <StationKpi label="Collected (30 days)" big={money0(money.collected)} sub="payments received" tone="opp" />
  </>) : null
  const opsCards = (<>
    <StationKpi label="Unbilled completed" big={String(completed)} sub="finished, not invoiced" tone={completed > 0 ? 'alert' : undefined} onClick={() => nav('/jobs')} />
    <StationKpi label="Unsent invoices" big={String(toSend)} sub="created, not sent" tone={toSend > 0 ? 'alert' : undefined} onClick={() => nav('/invoices')} />
  </>)

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
