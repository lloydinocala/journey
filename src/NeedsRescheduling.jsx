import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { fetchAllRows } from './utils/csvImport'

// Dispatch side of incomplete-job routing. When a tech stops a job as Incomplete for
// a reason that only needs a new visit — no one home, weather, a scheduling
// interruption — the record lands here instead of Jobs Management (the database sets
// the route from the reason). Dispatch stages the return visit into the Calendar
// tray, or sends the record to Jobs Management if it was really a parts/estimate
// issue. A record clears on its own once the newest visit for that job is Complete.

const fmtDate = (d) => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString() : '—')

export default function NeedsRescheduling({ profile }) {
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile?.org_id || '')
  const [records, setRecords] = useState([])
  const [allJobs, setAllJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || []); if (!selectedOrg && data?.length) setSelectedOrg(data[0].id)
    })
  }, [])

  async function load(orgId) {
    if (!orgId) return
    setLoading(true)
    const [recs, jobs] = await Promise.all([
      fetchAllRows(() => supabase.from('job_incomplete_records')
        .select(`id, job_id, reason, reason_note, created_at, route,
          jobs ( id, job_number, segment, job_date, status, property_id, customer_id, job_type, deleted_at,
            properties ( street_address, city, customers!properties_customer_id_fkey ( display_name, primary_phone ) ) )`)
        .eq('org_id', orgId).eq('route', 'dispatch').order('created_at', { ascending: true })),
      fetchAllRows(() => supabase.from('jobs').select('id, job_number, segment, status, job_date, date_pending').eq('org_id', orgId).is('deleted_at', null)),
    ])
    setRecords(recs || []); setAllJobs(jobs || [])
    setLoading(false)
  }
  useEffect(() => { load(selectedOrg) }, [selectedOrg])

  // Same visibility rule as Jobs Management: open until the newest segment is Complete.
  const visible = records.map((rec) => {
    const job = rec.jobs
    if (!job || job.deleted_at) return null
    const sibs = allJobs.filter((j) => j.job_number === job.job_number)
    const maxSeg = sibs.reduce((m, j) => Math.max(m, j.segment || 1), job.segment || 1)
    const current = sibs.find((j) => j.segment === maxSeg)
    if (current?.status === 'completed') return null
    const staged = maxSeg > (job.segment || 1) ? current : null
    return { ...rec, job, maxSeg, staged }
  }).filter(Boolean)

  async function stageReturn(rec) {
    setBusy(rec.id); setMsg('')
    const { error } = await supabase.from('jobs').insert({
      org_id: selectedOrg, job_number: rec.job.job_number, segment: rec.maxSeg + 1,
      property_id: rec.job.property_id, customer_id: rec.job.customer_id, job_type: rec.job.job_type || null,
      service_complaint: `Return visit — ${rec.reason}${rec.reason_note ? ': ' + rec.reason_note : ''}`,
      status: 'unscheduled', date_pending: true, parts_ready: false,
    })
    setBusy(null)
    if (error) { setMsg('Could not stage the visit: ' + error.message); return }
    setMsg(`Return visit for ${rec.job.job_number} is in the Calendar tray, ready to schedule.`)
    load(selectedOrg)
  }

  async function sendToJobsManagement(rec) {
    setBusy(rec.id); setMsg('')
    await supabase.from('job_incomplete_records').update({ route: 'jobs_management' }).eq('id', rec.id)
    setBusy(null)
    setMsg(`${rec.job.job_number} sent to Jobs Management.`)
    load(selectedOrg)
  }

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Needs Rescheduling</h2>
          <span className="badge">{visible.length}</span>
        </div>
        {isSuper && <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />}
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 13.5, marginTop: 0, maxWidth: 820 }}>
        Incomplete jobs that only need another visit — no one home, weather, or a scheduling interruption.
        Stage the return visit to put it in the Calendar tray. If it&rsquo;s really a parts or estimate issue, send it to Jobs Management.
        Each job clears from this list once its return visit is marked Complete.
      </p>
      {msg && <div style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#EAF3EC', color: '#2E7D52', fontSize: 13.5, maxWidth: 820 }}>{msg}</div>}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : visible.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>Nothing to reschedule right now.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Job #</th><th>Customer</th><th>Phone</th><th>Address</th><th>Reason</th><th>Stopped</th><th>Return visit</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((rec) => {
                const c = rec.job.properties?.customers
                return (
                  <tr key={rec.id}>
                    <td><Link to={`/jobs?job=${rec.job.id}`} style={{ fontWeight: 700 }}>{rec.job.job_number}</Link>{rec.job.segment > 1 ? `-${rec.job.segment}` : ''}</td>
                    <td>{c?.display_name || '—'}</td>
                    <td>{c?.primary_phone || '—'}</td>
                    <td>{[rec.job.properties?.street_address, rec.job.properties?.city].filter(Boolean).join(', ') || '—'}</td>
                    <td style={{ fontSize: 12.5 }}>{rec.reason || '—'}{rec.reason_note && <div style={{ color: 'var(--mist)' }}>“{rec.reason_note}”</div>}</td>
                    <td>{fmtDate(rec.created_at)}</td>
                    <td style={{ fontSize: 13 }}>
                      {rec.staged
                        ? (rec.staged.job_date ? `Scheduled ${fmtDate(rec.staged.job_date)}` : <Link to="/calendar">In Calendar tray — schedule it</Link>)
                        : <button className="auth-button" style={{ width: 'auto', padding: '6px 12px', margin: 0 }} disabled={busy === rec.id} onClick={() => stageReturn(rec)}>Stage return visit</button>}
                    </td>
                    <td><button className="logout-button" disabled={busy === rec.id} onClick={() => sendToJobsManagement(rec)}>→ Jobs Management</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
