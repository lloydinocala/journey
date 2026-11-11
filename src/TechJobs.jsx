import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { signOutMobile } from './utils/mobileSessionLog'
import { isFieldAdmin } from './MobileNav'
import AskBar from './AskBar'
import './fieldapp.css'
import ClockWidget from './ClockWidget'
import { formatTimeInZone, loadOrgTz } from './utils/tz'
import { can } from './utils/permissions'
import { hasFeature } from './utils/entitlements'

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [lockedMsg, setLockedMsg] = useState('')
  // Re-check lateness every minute while the list is open.
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])

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
          id, job_number, segment, status, job_date, start_time, arrival_at, job_type, service_complaint,
          properties ( street_address, unit, city, state, zip ),
          customers ( display_name )
        `)
        .eq('org_id', orgId)
        .eq('job_date', date)
        .is('deleted_at', null)
      if (!seeAll) jobQuery = jobQuery.in('id', jobIds)
      const { data } = await jobQuery
      jobRows = (data || []).filter((j) => j.status !== 'canceled' && j.status !== 'cancelled')
    }

    const jobItems = jobRows.map((j) => ({ kind: 'job', sortKey: j.start_time || '', data: j }))
    const taskItems = (taskRows || []).filter((t) => t.status !== 'canceled' && t.status !== 'cancelled').map((t) => ({ kind: 'task', sortKey: t.scheduled_at || '', data: t }))
    const all = [...jobItems, ...taskItems].sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || ''))
    setItems(all)
    setLoading(false)
  }

  const dateDisplay = new Date(date + 'T12:00:00').toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  // Card colour: green = complete, red = not complete yet, amber + red border = late
  // (the scheduled arrival time has been reached and the tech hasn't arrived).
  function cardState(it) {
    const d = it.data
    const st = it.kind === 'task' ? d.status : d.status
    if (st === 'completed') return 'complete'
    const t = it.kind === 'task' ? d.scheduled_at : d.start_time
    const notArrived = it.kind === 'task' ? (st === 'scheduled' || st === 'pending' || !st) : (!d.arrival_at && (st === 'scheduled' || st === 'on_my_way'))
    if (t && notArrived && new Date(t).getTime() <= now) return 'late'
    return 'incomplete'
  }
  function openItem(it) {
    if (it.data.status === 'completed' && !isFieldAdmin(profile) && !isSuperAdmin) {
      setLockedMsg(`${it.kind === 'task' ? 'This task' : `Job ${it.data.job_number}`} is complete — it can't be reopened.`)
      setTimeout(() => setLockedMsg(''), 3200)
      return
    }
    navigate(it.kind === 'task' ? `/tech/task/${it.data.id}` : `/tech/${it.data.id}`)
  }
  const firstName = (profile?.full_name || '').trim()
  const menu = [
    ['My Schedule', () => navigate('/tech/my-schedule')],
    ['My Records', () => navigate('/my')],
    ['Field Manual', () => navigate('/tech/manual')],
    ['Cycle Count', () => navigate('/tech/cycle-counts')],
    ['Settings', () => navigate('/tech/settings')],
    ...(isFieldAdmin(profile) ? [['Desktop', () => navigate('/home')]] : []),
    ['Sign Out', () => signOutMobile(profile)],
  ]

  return (
    <div className="fa-shell">
      <div className="fa-header">
        <div className="fa-header-title">My Jobs{firstName ? ` - ${firstName}` : ''}</div>
        <div className="fa-header-sub">{dateDisplay}</div>
        <button type="button" className="fa-menu-btn" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}>☰</button>
        {menuOpen && (
          <>
            <div className="fa-menu-scrim" onClick={() => setMenuOpen(false)} />
            <div className="fa-menu">
              {menu.map(([label, fn]) => <button key={label} type="button" onClick={() => { setMenuOpen(false); fn() }}>{label}</button>)}
            </div>
          </>
        )}
      </div>

      <div className="fa-body">
        {effUid && effOrgId && (
          <ClockWidget userId={effUid} orgId={effOrgId} variant="mobile" />
        )}
        <div className="fa-datebar">
          <button type="button" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">&lsaquo;</button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          <button type="button" onClick={() => setDate(shiftDate(date, 1))} aria-label="Next day">&rsaquo;</button>
          {date !== todayISO() && <button type="button" className="fa-today" onClick={() => setDate(todayISO())}>Today</button>}
        </div>
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
                {isNow ? `● On call now — ${role}` : `Next on-call turn — ${role}`}
              </div>
              <div style={{ fontSize: 13, color: '#5A6B7B', marginTop: 2 }}>
                {isNow
                  ? `Until ${fmtOnCall(p.period_end)} · supervisor access active this window`
                  : `${fmtOnCall(p.period_start)} → ${fmtOnCall(p.period_end)}`}
              </div>
            </div>
          )
        })()}
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
              {can(profile, 'access_receiver') && <button onClick={() => navigate('/receiver')}>Receiving</button>}
              <button onClick={() => navigate('/tech/schedule')}>Everyone's Schedule</button>
              {hasFeature(profile, 'commercial_projects') && <button onClick={() => navigate('/tech/projects')}>Commercial Projects</button>}
              <button onClick={() => navigate('/tech/new-job')}>+ New Job</button>
              <button onClick={() => navigate('/tech/new-estimate')}>+ Estimate</button>
              <button onClick={() => navigate('/tech/new-followup-estimate')}>+ Follow-up Estimate</button>
              <button onClick={() => navigate('/tech/new-system-estimate')}>+ System Estimate</button>
            </div>
          </div>
        )}

        {lockedMsg && <div className="fa-locked-msg">{lockedMsg}</div>}

        <div className="fa-panel">
          {loading ? (
            <p className="fa-empty">Loading…</p>
          ) : items.length === 0 ? (
            <p className="fa-empty">Nothing scheduled for this day.</p>
          ) : items.map((it) => {
            const st = cardState(it)
            const d = it.data
            const label = st === 'complete' ? 'COMPLETE' : st === 'late' ? 'LATE' : 'INCOMPLETE'
            return it.kind === 'task' ? (
              <div key={`t-${d.id}`} className={`fa-card ${st}`} role="button" tabIndex={0} onClick={() => openItem(it)}>
                <div className="fa-card-top"><span className="fa-card-num">TASK</span><span className={`fa-card-status ${st}`}>{label}</span></div>
                <div className="fa-card-name">{d.destination_name}</div>
                <div className="fa-card-sub">{timeLabel(d.scheduled_at)}{timeLabel(d.scheduled_at) && ' · '}Task{seeAll && d.assigned?.full_name ? ` · ${d.assigned.full_name}` : ''}</div>
                {d.address && <div className="fa-card-addr">{d.address}</div>}
              </div>
            ) : (
              <div key={`j-${d.id}`} className={`fa-card ${st}`} role="button" tabIndex={0} onClick={() => openItem(it)}>
                <div className="fa-card-top"><span className="fa-card-num">{d.job_number}{d.segment > 1 ? `-${d.segment}` : ''}</span><span className={`fa-card-status ${st}`}>{label}</span></div>
                <div className="fa-card-name">{d.customers?.display_name || 'Unknown Customer'}</div>
                <div className="fa-card-sub">{timeLabel(d.start_time)}{timeLabel(d.start_time) && ' · '}{d.job_type || 'Job'}</div>
                {d.properties?.street_address && (
                  <div className="fa-card-addr">{d.properties.street_address}{d.properties.unit ? ` #${d.properties.unit}` : ''}, {d.properties.city}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <AskBar />
    </div>
  )
}
