import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import FieldShell, { todayISO, shiftISO, fmtDayLong, isLate } from './FieldShell'
import useDayJobs, { techNames } from './useDayJobs'
import { utcToZonedInputs, formatTimeInZone } from '../utils/tz'

// CALENDAR — the day's schedule by hour, each job colored by its technician's calendar color.
// Jobs running late (arrival time reached, tech not there) are outlined in red on amber.
// Tap a job for its Jobs Data.
const HOUR_PX = 64
const DEFAULT_COLOR = '#1676B8'
const hoursOf = (ts) => { const z = utcToZonedInputs(ts); if (!z?.time) return null; const [h, m] = z.time.split(':').map(Number); return h + m / 60 }
const label = (h) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`)

export default function FieldCalendar({ profile }) {
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const date = sp.get('date') || todayISO()
  const setDate = (d) => setSp(d === todayISO() ? {} : { date: d }, { replace: true })
  const { loading, jobs, techs } = useDayJobs(profile?.org_id, date)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])

  const timed = jobs.filter((j) => j.start_time).map((j) => {
    const start = hoursOf(j.start_time)
    const dur = Math.max(0.5, Number(j.duration_hours) || 1)
    return { j, start, end: start + dur }
  }).filter((x) => x.start != null)
  const untimed = jobs.filter((j) => !j.start_time)

  // Day range: 7 AM – 6 PM, stretched to fit anything earlier or later.
  const first = Math.min(7, ...timed.map((x) => Math.floor(x.start)))
  const last = Math.max(18, ...timed.map((x) => Math.ceil(x.end)))
  const hours = Array.from({ length: last - first }, (_, i) => first + i)

  // Side-by-side lanes for jobs that overlap.
  const lanes = []
  for (const x of [...timed].sort((a, b) => a.start - b.start)) {
    let lane = lanes.findIndex((end) => end <= x.start + 1e-6)
    if (lane === -1) { lane = lanes.length; lanes.push(0) }
    lanes[lane] = x.end; x.lane = lane
  }
  const laneCount = Math.max(1, lanes.length)
  const usedTechs = [...new Set(jobs.flatMap((j) => j.techIds))].map((id) => techs[id]).filter(Boolean)

  return (
    <FieldShell profile={profile} title="Calendar" onBack={() => navigate('/tech/field')}>
      <div className="fa-cal">
        <div className="fa-cal-head">
          <button type="button" onClick={() => setDate(shiftISO(date, -1))} aria-label="Previous day">‹</button>
          <span onClick={() => setDate(todayISO())} style={{ cursor: 'pointer' }}>{fmtDayLong(date)}</span>
          <button type="button" onClick={() => setDate(shiftISO(date, 1))} aria-label="Next day">›</button>
        </div>
        {loading ? <p className="fa-empty">Loading…</p> : (
          <div className="fa-cal-grid">
            {hours.map((h) => (
              <div key={h} className="fa-cal-hour"><div className="fa-cal-label">{label(h)}</div><div className="fa-cal-slot" /></div>
            ))}
            {timed.map(({ j, start, end, lane }) => {
              const color = techs[j.techIds[0]]?.calendar_color || DEFAULT_COLOR
              const done = j.status === 'completed'
              const late = !done && isLate(j, now)
              const width = `calc((100% - 66px) / ${laneCount} - 4px)`
              return (
                <div key={j.id} className={`fa-cal-ev${late ? ' late' : ''}${done ? ' done' : ''}`} role="button" tabIndex={0}
                  onClick={() => navigate(`/tech/field/job/${j.id}`)}
                  style={{ top: (start - first) * HOUR_PX + 2, height: Math.max(26, (end - start) * HOUR_PX - 4), left: `calc(62px + (100% - 66px) / ${laneCount} * ${lane})`, width, background: color }}>
                  {late ? 'LATE · ' : ''}{formatTimeInZone(j.start_time)} {j.customers?.display_name || ''}
                  <div style={{ fontWeight: 600, opacity: 0.9 }}>{j.job_type}{j.techIds.length ? ` · ${techNames(j.techIds, techs)}` : ' · no tech'}</div>
                </div>
              )
            })}
          </div>
        )}
        {!loading && untimed.length > 0 && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid #E1E8EE' }}>
            <div className="fa-muted" style={{ fontWeight: 700, marginBottom: 4 }}>No time set</div>
            {untimed.map((j) => (
              <div key={j.id} role="button" tabIndex={0} onClick={() => navigate(`/tech/field/job/${j.id}`)} style={{ fontSize: 14, fontWeight: 600, padding: '4px 0', cursor: 'pointer' }}>
                {j.job_number} · {j.customers?.display_name} · {j.job_type}
              </div>
            ))}
          </div>
        )}
        {usedTechs.length > 0 && (
          <div className="fa-cal-legend">
            {usedTechs.map((u) => <span key={u.id}><i style={{ background: u.calendar_color || DEFAULT_COLOR }} />{u.full_name}</span>)}
          </div>
        )}
      </div>
    </FieldShell>
  )
}
