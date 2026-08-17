import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { signOutMobile } from './utils/mobileSessionLog'
import MobileNav from './MobileNav'
import { formatTimeInZone, loadOrgTz } from './utils/tz'

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function ymd(d) {
  const x = new Date(d)
  const off = x.getTimezoneOffset() * 60000
  return new Date(x - off).toISOString().slice(0, 10)
}

export default function MySchedule({ profile }) {
  const navigate = useNavigate()
  const [weekStart, setWeekStart] = useState(startOfDay(new Date()))
  const [jobsByDay, setJobsByDay] = useState({})
  const [onCall, setOnCall] = useState([])
  const [myUid, setMyUid] = useState(null)
  const [loading, setLoading] = useState(true)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  })

  useEffect(() => { load() }, [weekStart, profile?.id])

  async function load() {
    setLoading(true)
    const orgId = profile?.org_id
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    setMyUid(uid)
    if (!orgId || !uid) { setLoading(false); return }
    loadOrgTz(orgId)

    const rangeStart = new Date(weekStart)
    const rangeEnd = new Date(weekStart); rangeEnd.setDate(rangeEnd.getDate() + 7)

    const { data: assigned } = await supabase
      .from('job_technicians').select('job_id').eq('org_id', orgId).eq('user_id', uid)
    const jobIds = [...new Set((assigned || []).map((r) => r.job_id))]

    let jobRows = []
    if (jobIds.length) {
      const { data } = await supabase
        .from('jobs')
        .select('id, job_number, segment, status, job_date, start_time, job_type, properties ( street_address, unit, city ), customers ( display_name )')
        .eq('org_id', orgId)
        .in('id', jobIds)
        .gte('job_date', ymd(rangeStart))
        .lt('job_date', ymd(rangeEnd))
        .is('deleted_at', null)
      jobRows = data || []
    }
    const byDay = {}
    jobRows.forEach((j) => { (byDay[j.job_date] || (byDay[j.job_date] = [])).push(j) })
    Object.values(byDay).forEach((arr) => arr.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')))
    setJobsByDay(byDay)

    const { data: oc } = await supabase
      .from('on_call_schedule')
      .select('period_start, period_end, supervisor_user_id, tech_user_id')
      .eq('org_id', orgId)
      .or(`supervisor_user_id.eq.${uid},tech_user_id.eq.${uid}`)
      .lt('period_start', rangeEnd.toISOString())
      .gt('period_end', rangeStart.toISOString())
    setOnCall(oc || [])
    setLoading(false)
  }

  function onCallForDay(d) {
    const dayStart = startOfDay(d).getTime()
    const dayEnd = dayStart + 86400000
    return onCall.find((p) => new Date(p.period_start).getTime() < dayEnd && new Date(p.period_end).getTime() > dayStart) || null
  }

  function shiftWeek(n) {
    const d = new Date(weekStart); d.setDate(d.getDate() + n * 7); setWeekStart(startOfDay(d))
  }

  const rangeLabel = `${days[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} \u2013 ${days[6].toLocaleDateString([], { month: 'short', day: 'numeric' })}`
  const todayKey = ymd(new Date())

  return (
    <div className="mobile-shell">
      <div className="mobile-header">
        <div className="mobile-header-top-row">
          <div>
            <div className="mobile-header-date">{rangeLabel}</div>
            <div className="mobile-header-title">My Schedule</div>
          </div>
          <div className="mobile-header-actions">
            <button className="mobile-header-action-btn" onClick={() => navigate('/tech')}>Job Cards</button>
            <button className="mobile-header-action-btn" onClick={() => signOutMobile(profile)}>Sign Out</button>
          </div>
        </div>
      </div>

      <div className="mobile-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <button type="button" className="mobile-header-action-btn" onClick={() => shiftWeek(-1)}>&lsaquo; Prev</button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: 'var(--mist)' }}>{rangeLabel}</div>
          <button type="button" className="mobile-header-action-btn" onClick={() => shiftWeek(1)}>Next &rsaquo;</button>
          <button type="button" className="mobile-header-action-btn" onClick={() => setWeekStart(startOfDay(new Date()))}>This week</button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--mist)', padding: '4px 2px' }}>Loading&hellip;</p>
        ) : (
          days.map((d) => {
            const key = ymd(d)
            const dayJobs = jobsByDay[key] || []
            const oc = onCallForDay(d)
            const isToday = key === todayKey
            return (
              <div key={key} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border,#e0e0e0)', paddingBottom: 4, marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, color: isToday ? '#0B6E2E' : undefined }}>
                    {isToday ? '\u25CF ' : ''}{d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                  </div>
                  {oc && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#8a5a00', background: '#fff6e5', border: '1px solid #d9a441', borderRadius: 6, padding: '1px 8px' }}>
                      On call {oc.supervisor_user_id === myUid ? '\u00b7 Supervisor' : '\u00b7 Tech'}
                    </span>
                  )}
                </div>
                {dayJobs.length === 0 ? (
                  <div style={{ color: 'var(--mist)', fontSize: 13, padding: '2px 2px 4px' }}>No jobs scheduled</div>
                ) : dayJobs.map((j) => (
                  <div key={j.id} className="job-card-item" onClick={() => navigate(`/tech/${j.id}`)} style={{ marginBottom: 6 }}>
                    <div className="job-card-item-top">
                      <span className="job-card-number">{j.job_number}{j.segment > 1 ? `-${j.segment}` : ''}</span>
                    </div>
                    <div className="job-card-customer">{j.customers?.display_name || 'Unknown Customer'}</div>
                    <div className="job-card-sub">
                      {formatTimeInZone(j.start_time)}{formatTimeInZone(j.start_time) && ' \u00b7 '}{j.job_type || 'Job'}
                    </div>
                    {j.properties?.street_address && (
                      <div className="job-card-address">
                        {j.properties.street_address}{j.properties.unit ? ` #${j.properties.unit}` : ''}, {j.properties.city}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      <MobileNav profile={profile} />
    </div>
  )
}
