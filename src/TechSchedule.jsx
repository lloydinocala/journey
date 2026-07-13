import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import MobileNav, { isFieldAdmin } from './MobileNav'

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

function timeLabel(startTime) {
  if (!startTime) return ''
  const d = new Date(startTime)
  if (isNaN(d)) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function TechSchedule({ profile }) {
  const navigate = useNavigate()
  const [date, setDate] = useState(todayISO())
  const [techFilter, setTechFilter] = useState('all')
  const [users, setUsers] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

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

  async function loadJobs() {
    if (!profile?.org_id) { setJobs([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select(`
        id, job_number, segment, status, job_date, start_time, job_type, service_complaint,
        technician_1_id, technician_2_id,
        properties ( street_address, unit, city, state, zip ),
        customers ( display_name ),
        job_technicians ( user_id, users ( full_name ) )
      `)
      .eq('org_id', profile.org_id)
      .eq('job_date', date)
      .order('start_time', { ascending: true })
    setJobs(data || [])
    setLoading(false)
  }

  function techNamesFor(job) {
    const names = (job.job_technicians || []).map((jt) => jt.users?.full_name).filter(Boolean)
    return names.length > 0 ? names.join(', ') : 'Unassigned'
  }

  function jobMatchesFilter(job) {
    if (techFilter === 'all') return true
    if (job.technician_1_id === techFilter || job.technician_2_id === techFilter) return true
    return (job.job_technicians || []).some((jt) => jt.user_id === techFilter)
  }

  const filteredJobs = jobs.filter(jobMatchesFilter)

  const dateDisplay = new Date(date + 'T12:00:00').toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="mobile-shell">
      <div className="mobile-header">
        <div className="mobile-header-top-row">
          <div>
            <div className="mobile-header-date">{dateDisplay}</div>
            <div className="mobile-header-title">Schedule</div>
          </div>
          <div className="mobile-header-actions">
            {isFieldAdmin(profile) && (
              <button className="mobile-header-action-btn" onClick={() => navigate('/')}>Desktop</button>
            )}
            <button className="mobile-header-action-btn" onClick={() => supabase.auth.signOut()}>Sign Out</button>
          </div>
        </div>
      </div>

      <div className="mobile-body">
        <div className="schedule-filters">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)}>
            <option value="all">All Technicians</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>

        {loading ? (
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
