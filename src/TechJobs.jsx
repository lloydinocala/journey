import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { signOutMobile } from './utils/mobileSessionLog'
import MobileNav, { isFieldAdmin } from './MobileNav'
import ClockWidget from './ClockWidget'
import Watermark from './Watermark'
import { getOpenShift } from './utils/shiftClock'
import { formatTimeInZone, loadOrgTz } from './utils/tz'

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  on_my_way: 'On My Way',
  in_progress: 'In Progress',
  incomplete: 'Incomplete',
  completed: 'Completed',
  canceled: 'Canceled',
}

const CLOSED = ['completed', 'incomplete', 'canceled']

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

function timeLabel(startTime) {
  return formatTimeInZone(startTime)
}

// First name + last initial — enough to recognize, not a full name to harvest.
function shortName(full) {
  const p = (full || '').trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return ''
  if (p.length === 1) return p[0]
  return `${p[0]} ${p[p.length - 1][0]}.`
}

// The one job shown in full on the hardened tech list: whatever he's actively
// on, else the next open job of the day.
function pickActiveJob(rows) {
  const prog = rows.find((r) => r.status === 'in_progress') || rows.find((r) => r.status === 'on_my_way')
  if (prog) return prog
  const open = rows.filter((r) => !CLOSED.includes(r.status))
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  return open[0] || null
}

export default function TechJobs({ profile }) {
  const navigate = useNavigate()
  const isSuperAdmin = profile?.role === 'super_admin'
  // Field admins/supervisors see the whole team's tasks in their card list
  // (each labeled with who it's for); regular techs see only their own.
  const seeAllTasks = isFieldAdmin(profile) && !isSuperAdmin

  // Super-admins can flip into the hardened "what a tech sees" view to review it.
  const [forceHardened, setForceHardened] = useState(() => { try { return localStorage.getItem('tech_force_hardened') === '1' } catch { return false } })
  // Regular (non-supervisor) techs get the screenshot-hardened, minimal-data list.
  const hardened = !isFieldAdmin(profile) || (isSuperAdmin && forceHardened)

  const [items, setItems] = useState([])
  const [activeFull, setActiveFull] = useState(null)   // full detail for the one active job (hardened)
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [standbyNote, setStandbyNote] = useState(() => { try { return localStorage.getItem('tech_standby_note') || '' } catch { return '' } })
  function dismissStandby() { try { localStorage.removeItem('tech_standby_note') } catch { /* ignore */ } setStandbyNote('') }
  const [date, setDate] = useState(todayISO())
  const [effUid, setEffUid] = useState(null)
  const [effOrgId, setEffOrgId] = useState(null)

  // Access requires being clocked in AND signed in. Super-admin preview is exempt
  // (no org/clock of its own). null = still checking.
  const [clockedIn, setClockedIn] = useState(isSuperAdmin ? true : null)

  const [orgs, setOrgs] = useState([])
  const [previewOrgId, setPreviewOrgId] = useState(localStorage.getItem('tech_preview_org_id') || '')
  const [orgUsers, setOrgUsers] = useState([])
  const [previewUserId, setPreviewUserId] = useState(localStorage.getItem('tech_preview_user_id') || '')

  // Clock-in gate check (non-super-admin), re-checked when the clock changes.
  useEffect(() => {
    if (isSuperAdmin) { setClockedIn(true); return }
    let cancelled = false
    async function check() {
      const { data } = await supabase.auth.getUser()
      const uid = data?.user?.id
      if (!uid) { if (!cancelled) setClockedIn(false); return }
      if (!cancelled) { setEffUid(uid); if (profile?.org_id) setEffOrgId(profile.org_id) }
      const sh = await getOpenShift(uid)
      if (!cancelled) setClockedIn(!!sh)
    }
    check()
    function onChanged() { check() }
    window.addEventListener('clock-changed', onChanged)
    return () => { cancelled = true; window.removeEventListener('clock-changed', onChanged) }
  }, [isSuperAdmin, profile?.org_id])

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
  }, [date, previewOrgId, previewUserId, hardened])

  async function loadJobs() {
    setLoading(true)
    setActiveFull(null); setActiveId(null)

    let orgId, uid
    if (isSuperAdmin) {
      orgId = previewOrgId
      uid = previewUserId
    } else {
      orgId = profile?.org_id
      const { data: userData } = await supabase.auth.getUser()
      uid = userData?.user?.id
    }

    if (!uid || !orgId) {
      setItems([])
      setLoading(false)
      return
    }

    setEffUid(uid)
    setEffOrgId(orgId)
    loadOrgTz(orgId)

    const dayStart = new Date(date + 'T00:00:00')
    const dayEnd = new Date(dayStart.getTime() + 86400000)

    // In hardened mode the day's task list carries NO destination/address —
    // only enough to show a collapsed row. Full detail is fetched per job on open.
    const taskSelect = hardened
      ? 'id, scheduled_at, status, assigned_user_id'
      : 'id, destination_name, address, scheduled_at, status, assigned_user_id, assigned:users!field_tasks_assigned_user_id_fkey ( full_name )'
    let taskQuery = supabase
      .from('field_tasks')
      .select(taskSelect)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('scheduled_at', dayStart.toISOString())
      .lt('scheduled_at', dayEnd.toISOString())
    if (!seeAllTasks) taskQuery = taskQuery.eq('assigned_user_id', uid)

    const [{ data: assignedRows }, { data: taskRows }] = await Promise.all([
      supabase.from('job_technicians').select('job_id').eq('org_id', orgId).eq('user_id', uid),
      taskQuery,
    ])

    const jobIds = [...new Set((assignedRows || []).map((r) => r.job_id))]

    // Hardened: the list query ships NO customer/property data. The tech's phone
    // only ever receives the day's job numbers, times, and status — the other
    // customers' info is never downloaded, so it can't be screenshotted or scraped.
    const jobSelect = hardened
      ? 'id, job_number, segment, status, job_date, start_time, job_type'
      : `id, job_number, segment, status, job_date, start_time, job_type, service_complaint,
          properties ( street_address, unit, city, state, zip ),
          customers ( display_name )`

    let jobRows = []
    if (jobIds.length > 0) {
      const { data } = await supabase
        .from('jobs')
        .select(jobSelect)
        .eq('org_id', orgId)
        .eq('job_date', date)
        .is('deleted_at', null)
        .in('id', jobIds)
      jobRows = data || []
    }

    const jobItems = jobRows.map((j) => ({ kind: 'job', sortKey: j.start_time || '', data: j }))
    const taskItems = (taskRows || []).map((t) => ({ kind: 'task', sortKey: t.scheduled_at || '', data: t }))
    const all = [...jobItems, ...taskItems].sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || ''))
    setItems(all)

    // Hardened: fetch full detail ONLY for the single active job (the one he's
    // working / heading to). That's the only customer record his device holds.
    if (hardened && jobRows.length > 0) {
      const active = pickActiveJob(jobRows)
      if (active) {
        setActiveId(active.id)
        const { data: full } = await supabase
          .from('jobs')
          .select('id, job_number, segment, status, start_time, job_type, properties ( street_address, unit, city ), customers ( display_name )')
          .eq('id', active.id)
          .single()
        setActiveFull(full || null)
      }
    }

    setLoading(false)
  }

  const dateDisplay = new Date(date + 'T12:00:00').toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const techShort = shortName(profile?.full_name)
  const watermarkLabel = hardened
    ? `${profile?.full_name || 'Field User'} · ${new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} · CONFIDENTIAL`
    : null

  // ---- Clock-in gate: no access to anything until clocked in ----
  const gated = !isSuperAdmin && clockedIn === false
  const checking = !isSuperAdmin && clockedIn === null

  function toggleForceHardened(v) {
    setForceHardened(v)
    try { localStorage.setItem('tech_force_hardened', v ? '1' : '0') } catch { /* ignore */ }
  }

  return (
    <div className="mobile-shell">
      {watermarkLabel && <Watermark label={watermarkLabel} />}
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
            <button className="mobile-header-action-btn" onClick={() => navigate('/tech/settings')}>Settings</button>
            <button className="mobile-header-action-btn" onClick={() => signOutMobile(profile)}>Sign Out</button>
          </div>
        </div>
      </div>

      <div className="mobile-body">
        {gated ? (
          <div style={{ padding: '8px 14px' }}>
            <div style={{ background: '#fff', border: '1px solid #dbe4ee', borderRadius: 14, padding: 20, textAlign: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#0F2A47' }}>You're signed in — now clock in</h2>
              <p style={{ color: '#5b6b7d', fontSize: 14, margin: 0 }}>
                You must be clocked in to view or work any job. Clocking in also confirms you accept the current terms.
              </p>
            </div>
            {effUid && effOrgId && (
              <ClockWidget userId={effUid} orgId={effOrgId} variant="mobile" />
            )}
          </div>
        ) : checking ? (
          <p style={{ color: 'var(--mist)', padding: '10px 14px' }}>Checking your clock status…</p>
        ) : (
          <>
            {effUid && effOrgId && (
              <ClockWidget userId={effUid} orgId={effOrgId} variant="mobile" />
            )}
            {standbyNote && (
              <div style={{ margin: '0 14px 12px', padding: '12px 14px', borderRadius: 12, background: '#EAF2FB', border: '1px solid #BBD5F0', color: '#0F2A47', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span>{standbyNote}</span>
                <button onClick={dismissStandby} style={{ background: 'none', border: 'none', color: '#0F2A47', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 0 }} aria-label="Dismiss">×</button>
              </div>
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
                <div className="preview-banner-row">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <label className="preview-banner-row" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={forceHardened} onChange={(e) => toggleForceHardened(e.target.checked)} />
                  <span>Tech security view (what a field tech sees)</span>
                </label>
              </div>
            )}

            {isFieldAdmin(profile) && !forceHardened && (
              <div className="supervisor-tools">
                <div className="supervisor-tools-label">Supervisor Tools</div>
                <div className="supervisor-tools-row">
                  <button onClick={() => navigate('/tech/schedule')}>Everyone's Schedule</button>
                  <button onClick={() => navigate('/tech/new-job')}>+ New Job</button>
                  <button onClick={() => navigate('/tech/new-service-estimate')}>+ Service Estimate</button>
                  <button onClick={() => navigate('/tech/new-system-estimate')}>+ System Estimate</button>
                  <button onClick={() => navigate('/tech/apollo')}>Chat with Quincy</button>
                </div>
              </div>
            )}

            {loading ? (
              <p style={{ color: 'var(--mist)', padding: '4px 2px' }}>Loading…</p>
            ) : items.length === 0 ? (
              <p style={{ color: 'var(--mist)', padding: '4px 2px' }}>
                {isFieldAdmin(profile) && !forceHardened
                  ? "You have nothing of your own today — use Supervisor Tools above to check the team's schedule or create a job."
                  : 'Nothing scheduled for this day.'}
              </p>
            ) : hardened ? (
              renderHardened()
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
                    {seeAllTasks && it.data.assigned?.full_name && <> · for {it.data.assigned.full_name}</>}
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
          </>
        )}
      </div>

      <MobileNav profile={profile} />
    </div>
  )

  // ---- Hardened tech list: one active job shown full, the rest collapsed to
  // just job # / time / tech, overlapped so a screenshot captures almost nothing.
  function renderHardened() {
    const jobItem = activeId ? items.find((it) => it.kind === 'job' && it.data.id === activeId) : null
    const others = items.filter((it) => !(jobItem && it.kind === jobItem.kind && it.data.id === jobItem.data.id))
    const jobNo = (d) => `${d.job_number}${d.segment > 1 ? `-${d.segment}` : ''}`

    return (
      <div style={{ position: 'relative', zIndex: 10, padding: '2px 2px 8px' }}>
        {jobItem && (
          <div className="job-card-item" onClick={() => navigate(`/tech/${jobItem.data.id}`)} style={{ position: 'relative', zIndex: 30, marginBottom: 12 }}>
            <div className="job-card-item-top">
              <span className="job-card-number">{jobNo(jobItem.data)}</span>
              <span className="status-pill" style={{ background: '#B00020', color: '#fff' }}>Now</span>
            </div>
            <div className="job-card-customer">{activeFull?.customers?.display_name || 'Current job'}</div>
            <div className="job-card-sub">
              {timeLabel(activeFull?.start_time || jobItem.data.start_time)}
              {' · '}{activeFull?.job_type || jobItem.data.job_type || 'Job'}
            </div>
            {activeFull?.properties?.street_address && (
              <div className="job-card-address">
                {activeFull.properties.street_address}{activeFull.properties.unit ? ` #${activeFull.properties.unit}` : ''}, {activeFull.properties.city}
              </div>
            )}
          </div>
        )}

        {others.length > 0 && (
          <div style={{ position: 'relative' }}>
            {others.map((it, idx) => (
              <div
                key={`${it.kind}-${it.data.id}`}
                onClick={() => navigate(it.kind === 'task' ? `/tech/task/${it.data.id}` : `/tech/${it.data.id}`)}
                style={{
                  position: 'relative',
                  zIndex: 20 - idx,
                  background: '#fff',
                  border: '1px solid #dbe4ee',
                  borderRadius: 12,
                  boxShadow: '0 -3px 8px rgba(15,42,71,0.10)',
                  padding: '12px 16px',
                  marginTop: idx === 0 ? 0 : -10,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 800, color: '#0F2A47', fontSize: 15 }}>
                    {it.kind === 'task' ? 'TASK' : jobNo(it.data)}
                  </span>
                  <span style={{ fontWeight: 700, color: '#0F2A47', fontSize: 14 }}>
                    {timeLabel(it.kind === 'task' ? it.data.scheduled_at : it.data.start_time)}
                  </span>
                </div>
                {techShort && <div style={{ fontSize: 13, color: '#5b6b7d', marginTop: 2 }}>{techShort}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
}
