import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { signOutMobile } from './utils/mobileSessionLog'
import MobileNav, { isFieldAdmin } from './MobileNav'

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  on_my_way: 'On My Way',
  in_progress: 'In Progress',
  incomplete: 'Incomplete',
  completed: 'Completed',
  canceled: 'Canceled',
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

function timeLabel(startTime) {
  if (!startTime) return ''
  const d = new Date(startTime)
  if (isNaN(d)) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Local-date-safe helpers — avoid UTC drift from new Date('YYYY-MM-DD') parsing.
function toISO(y, m, d) {
  const mm = String(m + 1).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function buildMonthGrid(anchorISO) {
  const [y, m] = anchorISO.split('-').map(Number)
  const monthIndex = m - 1
  const firstOfMonth = new Date(y, monthIndex, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(y, monthIndex + 1, 0).getDate()
  const daysInPrevMonth = new Date(y, monthIndex, 0).getDate()

  const cells = []
  for (let i = 0; i < startWeekday; i++) {
    const d = daysInPrevMonth - startWeekday + 1 + i
    const pm = monthIndex === 0 ? 11 : monthIndex - 1
    const py = monthIndex === 0 ? y - 1 : y
    cells.push({ iso: toISO(py, pm, d), day: d, inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: toISO(y, monthIndex, d), day: d, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]
    const [ly, lm, ld] = last.iso.split('-').map(Number)
    const next = new Date(ly, lm - 1, ld + 1)
    cells.push({ iso: toISO(next.getFullYear(), next.getMonth(), next.getDate()), day: next.getDate(), inMonth: false })
  }

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function shiftMonth(anchorISO, delta) {
  const [y, m, d] = anchorISO.split('-').map(Number)
  const next = new Date(y, m - 1 + delta, 1)
  return toISO(next.getFullYear(), next.getMonth(), Math.min(d, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
}

export default function TechSchedule({ profile }) {
  const navigate = useNavigate()
  const [date, setDate] = useState(todayISO())
  const [viewMode, setViewMode] = useState('list')
  const [techFilter, setTechFilter] = useState('all')
  const [users, setUsers] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthJobs, setMonthJobs] = useState([])
  const [monthLoading, setMonthLoading] = useState(true)

  useEffect(() => {
    if (!profile?.org_id) return
    supabase
      .from('users')
      .select('id, full_name')
      .eq('org_id', profile.org_id)
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setUsers(data || []))
  }, [profile?.org_id])

  useEffect(() => {
    loadJobs()
  }, [date, profile?.org_id])

  useEffect(() => {
    if (viewMode === 'calendar') loadMonthJobs()
  }, [viewMode, date, profile?.org_id])

  async function loadJobs() {
    if (!profile?.org_id) { setJobs([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select(`
        id, job_number, segment, status, job_date, start_time, job_type, service_complaint,
        properties ( street_address, unit, city, state, zip ),
        customers ( display_name ),
        job_technicians ( user_id, users ( full_name ) )
      `)
      .eq('org_id', profile.org_id)
      .eq('job_date', date)
      .is('deleted_at', null)
      .order('start_time', { ascending: true })
    setJobs(data || [])
    setLoading(false)
  }

  async function loadMonthJobs() {
    if (!profile?.org_id) { setMonthJobs([]); setMonthLoading(false); return }
    setMonthLoading(true)
    const [y, m] = date.split('-').map(Number)
    const rangeStart = toISO(y, m - 1, 1)
    const rangeEnd = toISO(y, m, 0) // last day of month (day 0 of next month)
    const { data } = await supabase
      .from('jobs')
      .select('id, job_date, status, job_technicians ( user_id )')
      .eq('org_id', profile.org_id)
      .is('deleted_at', null)
      .gte('job_date', rangeStart)
      .lte('job_date', rangeEnd)
    setMonthJobs(data || [])
    setMonthLoading(false)
  }

  function techNamesFor(job) {
    const names = (job.job_technicians || []).map((jt) => jt.users?.full_name).filter(Boolean)
    return names.length > 0 ? names.join(', ') : 'Unassigned'
  }

  function jobMatchesFilter(job) {
    if (techFilter === 'all') return true
    return (job.job_technicians || []).some((jt) => jt.user_id === techFilter)
  }

  const filteredJobs = jobs.filter(jobMatchesFilter)

  const monthCounts = useMemo(() => {
    const counts = {}
    for (const j of monthJobs) {
      if (!jobMatchesFilter(j)) continue
      counts[j.job_date] = (counts[j.job_date] || 0) + 1
    }
    return counts
  }, [monthJobs, techFilter])

  const weeks = useMemo(() => buildMonthGrid(date), [date])
  const monthLabel = useMemo(() => {
    const [y, m] = date.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' })
  }, [date])

  const dateDisplay = new Date(date + 'T12:00:00').toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  function goToDay(iso) {
    setDate(iso)
    setViewMode('list')
  }

  return (
    <div className="mobile-shell">
      <div className="mobile-header">
        <div className="mobile-header-top-row">
          <div>
            <div className="mobile-header-date">{viewMode === 'calendar' ? monthLabel : dateDisplay}</div>
            <div className="mobile-header-title">Schedule</div>
          </div>
          <div className="mobile-header-actions">
            {isFieldAdmin(profile) && (
              <button className="mobile-header-action-btn" onClick={() => navigate('/')}>Desktop</button>
            )}
            <button className="mobile-header-action-btn" onClick={() => signOutMobile(profile)}>Sign Out</button>
          </div>
        </div>
      </div>

      <div className="mobile-body">
        <div className="view-toggle-row">
          <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>List</button>
          <button className={viewMode === 'calendar' ? 'active' : ''} onClick={() => setViewMode('calendar')}>Calendar</button>
        </div>

        <div className="schedule-filters">
          {viewMode === 'list' && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)} style={{ flex: viewMode === 'calendar' ? 1 : undefined }}>
            <option value="all">All Technicians</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>

        {viewMode === 'calendar' ? (
          <>
            <div className="calendar-nav-row">
              <button onClick={() => setDate(shiftMonth(date, -1))}>‹</button>
              <button onClick={() => setDate(todayISO())}>Today</button>
              <button onClick={() => setDate(shiftMonth(date, 1))}>›</button>
            </div>
            <div className="calendar-grid">
              {WEEKDAY_LABELS.map((w, i) => <div key={i} className="calendar-weekday">{w}</div>)}
              {weeks.map((week, wi) =>
                week.map((cell) => {
                  const count = monthCounts[cell.iso] || 0
                  const isToday = cell.iso === todayISO()
                  return (
                    <button
                      key={cell.iso}
                      className={
                        'calendar-cell' +
                        (cell.inMonth ? '' : ' calendar-cell-outside') +
                        (isToday ? ' calendar-cell-today' : '') +
                        (cell.iso === date ? ' calendar-cell-selected' : '')
                      }
                      onClick={() => goToDay(cell.iso)}
                    >
                      <span className="calendar-cell-day">{cell.day}</span>
                      {count > 0 && <span className="calendar-cell-count">{count}</span>}
                    </button>
                  )
                })
              )}
            </div>
            {monthLoading && <p style={{ color: 'var(--mist)', textAlign: 'center', marginTop: 10 }}>Loading month…</p>}
          </>
        ) : loading ? (
          <p style={{ color: 'var(--mist)', padding: '4px 2px' }}>Loading…</p>
        ) : filteredJobs.length === 0 ? (
          <p style={{ color: 'var(--mist)', padding: '4px 2px' }}>No jobs match this day/filter.</p>
        ) : (
          filteredJobs.map((j) => (
            <div key={j.id} className="job-card-item" onClick={() => navigate(`/tech/${j.id}`)}>
              <div className="job-card-item-top">
                <span className="job-card-number">{j.job_number}{j.segment > 1 ? `-${j.segment}` : ''}</span>
                <span className={`status-pill status-${j.status}`}>{STATUS_LABEL[j.status] || j.status}</span>
              </div>
              <div className="job-card-customer">{j.customers?.display_name || 'Unknown Customer'}</div>
              <div className="job-card-sub">
                {timeLabel(j.start_time)}{timeLabel(j.start_time) && ' · '}{j.job_type || 'Job'} · {techNamesFor(j)}
              </div>
              {j.properties?.street_address && (
                <div className="job-card-address">
                  {j.properties.street_address}{j.properties.unit ? ` #${j.properties.unit}` : ''}, {j.properties.city}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <MobileNav profile={profile} />
    </div>
  )
}
