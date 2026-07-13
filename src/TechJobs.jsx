import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import MobileNav from './MobileNav'

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

export default function TechJobs({ profile }) {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayISO())

  useEffect(() => {
    loadJobs()
  }, [date])

  async function loadJobs() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    if (!uid || !profile?.org_id) {
      setJobs([])
      setLoading(false)
      return
    }

    // A tech can be assigned via technician_1_id/technician_2_id, or via job_technicians
    // for jobs with more than two techs — check both to be safe.
    const [directRes, viaJoinRes] = await Promise.all([
      supabase
        .from('jobs')
        .select(`
          id, job_number, segment, status, job_date, start_time, job_type, service_complaint,
          properties ( street_address, unit, city, state, zip ),
          customers ( display_name )
        `)
        .eq('org_id', profile.org_id)
        .eq('job_date', date)
        .or(`technician_1_id.eq.${uid},technician_2_id.eq.${uid}`),
      supabase
        .from('job_technicians')
        .select('job_id')
        .eq('org_id', profile.org_id)
        .eq('user_id', uid),
    ])

    const direct = directRes.data || []
    const joinJobIds = (viaJoinRes.data || []).map((r) => r.job_id)
    const haveIds = new Set(direct.map((j) => j.id))
    const extraIds = joinJobIds.filter((id) => !haveIds.has(id))

    let extra = []
    if (extraIds.length > 0) {
      const { data } = await supabase
        .from('jobs')
        .select(`
          id, job_number, segment, status, job_date, start_time, job_type, service_complaint,
          properties ( street_address, unit, city, state, zip ),
          customers ( display_name )
        `)
        .eq('org_id', profile.org_id)
        .eq('job_date', date)
        .in('id', extraIds)
      extra = data || []
    }

    const all = [...direct, ...extra].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    setJobs(all)
    setLoading(false)
  }

  const dateDisplay = new Date(date + 'T12:00:00').toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="mobile-shell">
      <div className="mobile-header">
        <div className="mobile-header-date">{dateDisplay}</div>
        <div className="mobile-header-title">My Job Cards</div>
      </div>

      <div className="mobile-body">
        {loading ? (
          <p style={{ color: 'var(--mist)', padding: '4px 2px' }}>Loading…</p>
        ) : jobs.length === 0 ? (
          <p style={{ color: 'var(--mist)', padding: '4px 2px' }}>No jobs scheduled for this day.</p>
        ) : (
          jobs.map((j) => (
            <div key={j.id} className="job-card-item" onClick={() => navigate(`/tech/${j.id}`)}>
              <div className="job-card-item-top">
                <span className="job-card-number">{j.job_number}{j.segment > 1 ? `-${j.segment}` : ''}</span>
                <span className={`status-pill status-${j.status}`}>{STATUS_LABEL[j.status] || j.status}</span>
              </div>
              <div className="job-card-customer">{j.customers?.display_name || 'Unknown Customer'}</div>
              <div className="job-card-sub">
                {timeLabel(j.start_time)}{timeLabel(j.start_time) && ' · '}{j.job_type || 'Job'}
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

      <MobileNav />
    </div>
  )
}
