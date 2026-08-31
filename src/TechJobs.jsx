import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { signOutMobile } from './utils/mobileSessionLog'
import MobileNav, { isFieldAdmin } from './MobileNav'
import ClockWidget from './ClockWidget'
import { formatTimeInZone, loadOrgTz } from './utils/tz'
import { can } from './utils/permissions'

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  on_my_way: 'On My Way',
  in_progress: 'In Progress',
  incomplete: 'Incomplete',
  completed: 'Completed',
  canceled: 'Canceled',
}

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

function shiftDate(iso, days) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmtOnCall(iso) {
  return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function timeLabel(startTime) {
  return formatTimeInZone(startTime)
}

export default function TechJobs({ profile }) {
  const navigate = useNavigate()
  const isSuperAdmin = profile?.role === 'super_admin'
  const seeAll = isSuperAdmin || isFieldAdmin(profile) || can(profile, 'view_all_jobs')

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayISO())
  const [effUid, setEffUid] = useState(null)
  const [effOrgId, setEffOrgId] = useState(null)
  const [onCallInfo, setOnCallInfo] = useState(null)

  useEffect(() => {
    const uid = profile?.id
    const oid = profile?.org_id
    if (!uid || !oid) return
    const nowIso = new Date().toISOString()
    supabase
      .from('on_call_schedule')
      .select('period_start, period_end, supervisor_user_id, tech_user_id')
      .eq('org_id', oid)
      .or(`supervisor_user_id.eq.${uid},tech_user_id.eq.${uid}`)
      .gt('period_end', nowIso)
      .order('period_start')
      .limit(5)
      .then(({ data }) => {
        if (!data || !data.length) { setOnCallInfo(null); return }
        const now = Date.now()
        const current = data.find((p) => new Date(p.period_start).getTime() <= now && now < new Date(p.period_end).getTime())
        const next = data.find((p) => new Date(p.period_start).getTime() > now)
        setOnCallInfo({ current, next, uid })
      })
  }, [profile?.id, profile?.org_id])

  const [orgs, setOrgs] = useState([])
  const [previewOrgId, setPreviewOrgId] = useState(localStorage.getItem('tech_preview_org_id') || '')
  const [orgUsers, setOrgUsers] = useState([])
  const [previewUserId, setPreviewUserId] = useState(localStorage.getItem('tech_preview_user_id') || '')

  useEffect(() => {
    if (!isSuperAdmin) return
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || [])
      if (!previewOrgId && data && data.length > 0) setPreviewOrgId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!isSuperAdmin || !previewOrgId) return
    localStorage.setItem('tech_preview_org_id', previewOrgId)
    supabase
      .from('users')
      .select('id, full_name, role')
      .eq('org_id', previewOrgId)
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => {
        setOrgUsers(data || [])
        if (data && data.length > 0 && !data.find((u) => u.id === previewUserId)) {
          setPreviewUserId(data[0].id)
        }
      })
  }, [previewOrgId])

  useEffect(() => {
    if (isSuperAdmin && previewUserId) localStorage.setItem('tech_preview_user_id', previewUserId)
  }, [previewUserId])

  useEffect(() => {
    loadJobs()
  }, [date, previewOrgId, previewUserId])

  async function loadJobs() {
    setLoading(true)

    let orgId, uid
    if (isSuperAdmin) {
      orgId = previewOrgId
      uid = previewUserId
    } else {
      orgId = profile?.org_id
      const { data: userData } = await supabase.auth.getUser()
      uid = userData?.user?.id
    }

    if (!orgId || (!seeAll && !uid)) {
      setItems([])
      setLoading(false)
      return
    }

    setEffUid(uid)
    setEffOrgId(orgId)
    loadOrgTz(orgId)

    const dayStart = new Date(date + 'T00:00:00')
    const dayEnd = new Date(dayStart.getTime() + 86400000)

    let taskQuery = supabase
      .from('field_tasks')
      .select('id, destination_name, address, scheduled_at, status, assigned_user_id, assigned:users!field_tasks_assigned_user_id_fkey ( full_name )')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('scheduled_at', dayStart.toISOString())
      .lt('scheduled_at', dayEnd.toISOString())
    if (!seeAll) taskQuery = taskQuery.eq('assigned_user_id', uid)

    const [{ data: assignedRows }, { data: taskRows }] = await Promise.all([
      seeAll ? Promise.resolve({ data: [] }) : supabase.from('job_technicians').select('job_id').eq('org_id', orgId).eq('user_id', uid),
      taskQuery,
    ])

    const jobIds = seeAll ? null : [...new Set((assignedRows || []).map((r) => r.job_id))]
    let jobRows = []
    if (seeAll || (jobIds && jobIds.length > 0)) {
      let jobQuery = supabase
        .from('jobs')
        .select(`
          id, job_number, segment, status, job_date, start_time, job_type, service_complaint,
          properties ( street_address, unit, city, state, zip ),
          customers ( display_name )
        `)
        .eq('org_id', orgId)
        .eq('job_date', date)
        .is('deleted_at', null)
      if (!seeAll) jobQuery = jobQuery.in('id', jobIds)
      const { data } = await jobQuery
      jobRows = data || []
    }

    const jobItems = jobRows.map((j) => ({ kind: 'job', sortKey: j.start_time || '', data: j }))
    const taskItems = (taskRows || []).map((t) => ({ kind: 'task', sortKey: t.scheduled_at || '', data: t }))
    const all = [...jobItems, ...taskItems].sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || ''))
    setItems(all)
    setLoading(false)
  }

  const dateDisplay = new Date(date + 'T12:00:00').toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="mobile-shell">
      <div className="mobile-header">
        <div className="mobile-header-top-row">
          <div>
            <div className="mobile-header-date">{dateDisplay}</div>
            <div className="mobile-header-title">My Job Cards</div>
          </div>
          <div className="mobile-header-actions">
            {isFieldAdmin(profile) && (
              <button className="mobile-header-action-btn" onClick={() => navigate('/')}>Desktop</button>
            )}
            <button className="mobile-header-action-btn" onClick={() => navigate('/my')}>My Records</button>
            <button className="mobile-header-action-btn" onClick={() => navigate('/tech/settings')}>Settings</button>
            <button className="mobile-header-action-btn" onClick={() => signOutMobile(profile)}>Sign Out</button>
          </div>
        </div>
      </div>

      <div className="mobile-body">
        {onCallInfo && (onCallInfo.current || onCallInfo.next) && (() => {
          const p = onCallInfo.current || onCallInfo.next
          const role = p.supervisor_user_id === onCallInfo.uid ? 'On-Call Supervisor' : 'On-Call Tech'
          const isNow = !!onCallInfo.current
          return (
            <div style={{
              borderRadius: 10, padding: '10px 14px', marginBottom: 12,
              background: isNow ? '#eaf5ec' : '#fff6e5',
              border: isNow ? '1px solid #0B6E2E' : '1px solid #d9a441',
            }}>
              <div style={{ fontWeight: 600, color: isNow ? '#0B6E2E' : '#8a5a00' }}>
                {isNow ? `\u25CF On call now \u2014 ${role}` : `Next on-call turn \u2014 ${role}`}
              </div>
              <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 2 }}>
                {isNow
                  ? `Until ${fmtOnCall(p.period_end)} \u00B7 supervisor access active this window`
                  : `${fmtOnCall(p.period_start)} \u2192 ${fmtOnCall(p.period_end)}`}
              </div>
            </div>
          )
        })()}
        {seeAll && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <button type="button" className="mobile-header-action-btn" onClick={() => setDate(shiftDate(date, -1))}>&lsaquo;</button>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: 1 }} />
            <button type="button" className="mobile-header-action-btn" onClick={() => setDate(shiftDate(date, 1))}>&rsaquo;</button>
            <button type="button" className="mobile-header-action-btn" onClick={() => setDate(todayISO())}>Today</button>
          </div>
        )}
        {effUid && effOrgId && (
          <ClockWidget userId={effUid} orgId={effOrgId} variant="mobile" />
        )}
        {isSuperAdmin && (
          <div className="preview-banner">
            <div className="preview-banner-label">Super Admin Preview</div>
            <div className="preview-banner-row">
              <select value={previewOrgId} onChange={(e) => setPreviewOrgId(e.target.value)}>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <select value={previewUserId} onChange={(e) => setPreviewUserId(e.target.value)}>
                {orgUsers.length === 0 && <option value="">No users in this org</option>}
                {orgUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </select>
            </div>
          </div>
        )}

        {isFieldAdmin(profile) && (
          <div className="supervisor-tools">
            <div className="supervisor-tools-label">Supervisor Tools</div>
            <div className="supervisor-tools-row">
              <button onClick={() => navigate('/tech/tower')}>The Tower</button>
              <button onClick={() => navigate('/tech/cycle-counts')}>Cycle Count</button>
              <button onClick={() => navigate('/tech/schedule')}>Everyone's Schedule</button>
              <button onClick={() => navigate('/tech/new-job')}>+ New Job</button>
              <button onClick={() => navigate('/tech/new-service-estimate')}>+ Service Estimate</button>
              <button onClick={() => navigate('/tech/new-followup-estimate')}>+ Follow-up Estimate</button>
              <button onClick={() => navigate('/tech/new-system-estimate')}>+ System Estimate</button>
              <button onClick={() => navigate('/tech/apollo')}>Chat with Quincy</button>
              <button onClick={() => navigate('/tech/manual')}>Field Manual</button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--mist)', padding: '4px 2px' }}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--mist)', padding: '4px 2px' }}>
            {isFieldAdmin(profile)
              ? "You have nothing of your own today — use Supervisor Tools above to check the team's schedule or create a job."
              : 'Nothing scheduled for this day.'}
          </p>
        ) : (
          <div className="mobile-card-grid">{items.map((it) => it.kind === 'task' ? (
            <div key={`t-${it.data.id}`} className="job-card-item job-card-item-task" onClick={() => navigate(`/tech/task/${it.data.id}`)}>
              <div className="job-card-item-top">
                <span className="job-card-number">TASK</span>
                <span className={`status-pill status-${it.data.status}`}>{STATUS_LABEL[it.data.status] || it.data.status}</span>
              </div>
              <div className="job-card-customer">{it.data.destination_name}</div>
              <div className="job-card-sub">
                {timeLabel(it.data.scheduled_at)}{timeLabel(it.data.scheduled_at) && ' · '}Task
                {seeAll && it.data.assigned?.full_name && <> · for {it.data.assigned.full_name}</>}
              </div>
              {it.data.address && (
                <div className="job-card-address">{it.data.address}</div>
              )}
            </div>
          ) : (
            <div key={`j-${it.data.id}`} className="job-card-item" onClick={() => navigate(`/tech/${it.data.id}`)}>
              <div className="job-card-item-top">
                <span className="job-card-number">{it.data.job_number}{it.data.segment > 1 ? `-${it.data.segment}` : ''}</span>
                <span className={`status-pill status-${it.data.status}`}>{STATUS_LABEL[it.data.status] || it.data.status}</span>
              </div>
              <div className="job-card-customer">{it.data.customers?.display_name || 'Unknown Customer'}</div>
              <div className="job-card-sub">
                {timeLabel(it.data.start_time)}{timeLabel(it.data.start_time) && ' · '}{it.data.job_type || 'Job'}
              </div>
              {it.data.properties?.street_address && (
                <div className="job-card-address">
                  {it.data.properties.street_address}{it.data.properties.unit ? ` #${it.data.properties.unit}` : ''}, {it.data.properties.city}
                </div>
              )}
            </div>
          ))}</div>
        )}
      </div>

      <MobileNav profile={profile} />
    </div>
  )
}
