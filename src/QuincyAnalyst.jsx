// Quincy Analyst — a plain-spoken review of the company's own numbers, every Monday and on demand.
// Every finding shows the figures it rests on; the full numbers are one click away.
import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { viewingOrg } from './utils/viewingOrg'
import { can } from './utils/permissions'

const JOURNEY_ORG = '5bb0e0a2-9a0a-4f45-96b9-69e7fe31ba8b'
const SEV = {
  act: { label: 'Act on this', color: '#B00020', bg: '#FDECEE' },
  watch: { label: 'Keep an eye on', color: '#B8720A', bg: '#FFF8E6' },
  good: { label: 'Going well', color: '#166534', bg: '#EAF7EE' },
}
const LABELS = {
  jobs_completed: 'Jobs completed', jobs_booked: 'Jobs booked', jobs_canceled: 'Jobs canceled', invoices: 'Invoices',
  invoiced_total: 'Invoiced ($)', collected: 'Collected ($)', estimates_created: 'Estimates written', estimates_approved: 'Estimates approved',
  estimates_approved_value: 'Approved estimate value ($)', estimates_declined: 'Estimates declined', filter_orders: 'Filter orders',
  agreements_new: 'New maintenance agreements', agreements_canceled: 'Agreements canceled', ai_receptionist_calls: 'Calls answered by the AI receptionist',
  calls_logged: 'Calls logged', new_leads: 'New leads', leads_won: 'Leads won', leads_lost: 'Leads lost',
  unpaid_0_30: 'Unpaid, 0–30 days ($)', unpaid_31_60: 'Unpaid, 31–60 days ($)', unpaid_61_90: 'Unpaid, 61–90 days ($)', unpaid_over_90: 'Unpaid, over 90 days ($)',
  estimates_pending_count: 'Estimates waiting on the customer', estimates_pending_value: 'Value waiting ($)', estimates_pending_over_14_days: 'Waiting over 14 days',
  agreements_active: 'Active maintenance agreements', maintenance_visits_overdue: 'Maintenance visits overdue', jobs_scheduled_next_7_days: 'Jobs scheduled next 7 days',
  jobs_incomplete_open: 'Jobs marked incomplete', jobs_unscheduled: 'Jobs not yet scheduled', open_leads: 'Open leads', open_leads_untouched_3_days: 'New leads untouched 3+ days',
}
const fmt = (k, v) => (v == null ? '—' : k.includes('$') || /total|collected|value|unpaid|invoiced$/.test(k) ? '$' + Math.round(Number(v)).toLocaleString() : Number(v).toLocaleString())

export default function QuincyAnalyst({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const allowed = isSuper || profile?.role === 'org_admin' || can(profile, 'view_financials_dashboard')
  const [orgs, setOrgs] = useState([])
  const [orgId, setOrgId] = useState(() => profile?.org_id || viewingOrg())
  const [reports, setReports] = useState([])
  const [sel, setSel] = useState(null)
  const [days, setDays] = useState(7)
  const [running, setRunning] = useState(false)
  const [showNumbers, setShowNumbers] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!isSuper) return
    supabase.from('organizations').select('id, name').neq('id', JOURNEY_ORG).order('name').then(({ data }) => {
      setOrgs(data || [])
      if ((!orgId || orgId === JOURNEY_ORG) && data && data.length) setOrgId(data[0].id)
    })
  }, [])
  useEffect(() => { if (orgId && allowed) load() }, [orgId])

  async function load() {
    const { data } = await supabase.from('analyst_reports').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(30)
    setReports(data || []); setSel((data || [])[0] || null)
  }

  async function run() {
    setRunning(true); setMsg('')
    const { data, error } = await supabase.functions.invoke('quincy-analyst', { body: { org_id: orgId, days } })
    setRunning(false)
    if (error || data?.error) { setMsg(data?.error || error.message); return }
    await load()
  }

  if (!allowed) return <div><h2>Quincy Analyst</h2><p style={{ color: 'var(--mist)' }}>The business review is for owners and people who can see financials.</p></div>
  if (orgId === JOURNEY_ORG) return <div><h2>Quincy Analyst</h2><p style={{ color: 'var(--mist)' }}>Pick a subscriber company.</p>{isSuper && <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />}</div>

  const m = sel?.metrics || {}
  return (
    <div>
      <div className="page-header-bar">
        <div>
          <h2 style={{ marginBottom: 2 }}>Quincy Analyst</h2>
          <div style={{ fontSize: 13, color: 'var(--mist)' }}>Your numbers, read honestly. A new review arrives every Monday morning.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </select>
          <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={running || !orgId} onClick={run}>{running ? 'Reviewing…' : 'Run review now'}</button>
        </div>
      </div>
      {isSuper && <OrgPicker orgs={orgs} value={orgId} onChange={setOrgId} />}
      {msg && <div style={{ color: '#B00020', margin: '8px 0' }}>{msg}</div>}

      {!sel ? (
        <p style={{ color: 'var(--mist)', marginTop: 16 }}>No review yet. Press <b>Run review now</b> for your first one.</p>
      ) : (
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 12 }}>
          <div style={{ flex: '1 1 560px', minWidth: 300 }}>
            <div style={{ fontSize: 13, color: 'var(--mist)' }}>
              {sel.period_start} to {sel.period_end} · compared with the {sel.period_days} days before · {new Date(sel.created_at).toLocaleString()}
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.5, margin: '8px 0 14px' }}>{sel.summary}</p>
            {(sel.findings || []).map((f, i) => {
              const s = SEV[f.severity] || SEV.watch
              return (
                <div key={i} style={{ border: `1px solid ${s.color}33`, background: s.bg, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, margin: '2px 0 4px' }}>{f.title}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>{f.detail}</div>
                  {f.next_step && <div style={{ fontSize: 14, marginTop: 6 }}><b>Next step:</b> {f.next_step}</div>}
                </div>
              )
            })}
            <button className="logout-button" onClick={() => setShowNumbers(!showNumbers)}>{showNumbers ? 'Hide the numbers' : 'Show the numbers behind this'}</button>
            {showNumbers && (
              <div style={{ marginTop: 10 }}>
                <table className="data-table">
                  <thead><tr><th>Measure</th><th>This period</th><th>Previous</th></tr></thead>
                  <tbody>{Object.keys(m.this_period || {}).map((k) => (
                    <tr key={k}><td>{LABELS[k] || k}</td><td>{fmt(k, m.this_period[k])}</td><td>{m.previous_period && k in m.previous_period ? fmt(k, m.previous_period[k]) : '—'}</td></tr>
                  ))}</tbody>
                </table>
                <table className="data-table" style={{ marginTop: 10 }}>
                  <thead><tr><th>Right now</th><th></th></tr></thead>
                  <tbody>{Object.entries(m.right_now || {}).map(([k, v]) => <tr key={k}><td>{LABELS[k] || k}</td><td>{fmt(k, v)}</td></tr>)}</tbody>
                </table>
                {(m.technicians || []).length > 0 && (
                  <table className="data-table" style={{ marginTop: 10 }}>
                    <thead><tr><th>Technician</th><th>Jobs completed</th><th>Invoiced</th><th>Estimates written</th><th>Approved</th></tr></thead>
                    <tbody>{m.technicians.map((t) => <tr key={t.name}><td>{t.name}</td><td>{t.jobs_completed}</td><td>{fmt('invoiced', t.invoiced)}</td><td>{t.estimates_written}</td><td>{t.estimates_approved}</td></tr>)}</tbody>
                  </table>
                )}
              </div>
            )}
          </div>
          <div style={{ flex: '0 1 240px' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Past reviews</div>
            {reports.map((r) => (
              <div key={r.id} onClick={() => setSel(r)} style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 8, marginBottom: 4, background: r.id === sel.id ? '#EAF6FB' : 'transparent', fontSize: 13 }}>
                {r.period_start} – {r.period_end} <span style={{ color: 'var(--mist)' }}>({r.period_days}d{r.trigger === 'manual' ? ', run by hand' : ''})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
