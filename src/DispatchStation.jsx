import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import StationShell from './StationShell'

// The Dispatch Station — the front-of-house domain: getting work in the door
// (calls, service requests) and onto a truck (schedule, dispatch), plus the
// recurring filter-order intake. Office-focused; the tiles door into the
// dispatcher's working surfaces (Call Console, Calendar, Dispatch Map).

async function unassignedCount(org) {
  const { data: jobs, error } = await supabase.from('jobs').select('id').eq('org_id', org).eq('status', 'scheduled')
  if (error) return { count: null }
  const ids = (jobs || []).map((j) => j.id)
  if (!ids.length) return { count: 0 }
  const { data: assigns } = await supabase.from('job_technicians').select('job_id').in('job_id', ids)
  const assigned = new Set((assigns || []).map((a) => a.job_id))
  return { count: ids.filter((id) => !assigned.has(id)).length }
}

const REGISTRY = [
  { key: 'requests', name: 'New service requests', href: '/service-requests', tone: 'amber', cta: 'Triage requests',
    line: (n) => `${n} request${n === 1 ? '' : 's'} to review & book`,
    q: (org) => supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'pending') },
  { key: 'toschedule', name: 'Jobs to schedule', href: '/calendar', tone: 'amber', cta: 'Open calendar',
    line: (n) => `${n} approved job${n === 1 ? '' : 's'} not on the board`,
    q: (org) => supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('status', 'unscheduled') },
  { key: 'dispatch', name: 'Needs dispatch', href: '/dispatch-map', tone: 'amber', cta: 'Open dispatch map',
    line: (n) => `${n} scheduled job${n === 1 ? '' : 's'} with no tech assigned`,
    q: (org) => unassignedCount(org) },
  { key: 'filters', name: 'Filter orders to fulfill', href: '/filter-orders', tone: 'amber', cta: 'Open filter orders',
    line: (n) => `${n} filter order${n === 1 ? '' : 's'} awaiting fulfillment`,
    q: (org) => supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('org_id', org).eq('is_filter_order', true).eq('is_archived', false).is('deleted_at', null).is('filter_fulfilled_at', null) },
]

export default function DispatchStation({ profile }) {
  const nav = useNavigate()
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || [])) }, [isSuper])
  useEffect(() => { if (selectedOrg) load(); else setLoading(false) }, [selectedOrg])

  async function load() {
    setLoading(true)
    const results = await Promise.all(REGISTRY.map(async (t) => {
      try { const { count, error } = await t.q(selectedOrg); return [t.key, error ? null : (count || 0)] } catch { return [t.key, null] }
    }))
    setCounts(Object.fromEntries(results)); setLoading(false)
  }

  const signals = REGISTRY.map((t) => ({ key: t.key, name: t.name, n: counts[t.key], tone: t.tone, line: t.line(counts[t.key] || 0), cta: t.cta, onClick: () => nav(t.href) }))
  const needing = signals.filter((s) => (s.n || 0) > 0)
  const total = needing.reduce((a, s) => a + (s.n || 0), 0)
  const sub = total > 0 ? (<>Work coming in and going out — <b style={{ color: 'inherit' }}>{total}</b> across {needing.length} area{needing.length === 1 ? '' : 's'} need a hand.</>) : "The board's clear — nothing waiting to book or dispatch."

  return (
    <div style={{ padding: '22px 24px 70px' }}>
      <StationShell
        eyebrow="Dispatch Station"
        officeTitle="Your dispatch board"
        officeSubtitle={sub}
        loading={loading}
        signals={signals}
        headerRight={isSuper ? <div><div style={{ fontSize: 11.5, color: '#98A2AD', marginBottom: 4, textAlign: 'right' }}>Organization</div><OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} /></div> : null}
        emptyHint="No new requests, everything scheduled and dispatched, filters fulfilled."
      />
    </div>
  )
}
