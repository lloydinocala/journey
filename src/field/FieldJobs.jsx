import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import FieldShell, { todayISO, shiftISO, fmtDayLong, isLate } from './FieldShell'
import useDayJobs, { techNames } from './useDayJobs'
import { formatTimeInZone } from '../utils/tz'

// JOBS & JOB CARDS — every job (and task) for the day, today first. Green bar = complete,
// red = not complete yet, amber card = running late. Tap a card for its Jobs Data.
export default function FieldJobs({ profile }) {
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const date = sp.get('date') || todayISO()
  const setDate = (d) => setSp(d === todayISO() ? {} : { date: d }, { replace: true })
  const { loading, jobs, tasks, techs } = useDayJobs(profile?.org_id, date)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])

  const items = [
    ...jobs.map((j) => ({ kind: 'job', t: j.start_time || '', d: j })),
    ...tasks.map((t) => ({ kind: 'task', t: t.scheduled_at || '', d: t })),
  ].sort((a, b) => (a.t || '').localeCompare(b.t || ''))

  return (
    <FieldShell profile={profile} title="Jobs & Job Cards" onBack={() => navigate('/tech/field')}>
      <div className="fa-datebar" style={{ marginTop: 0 }}>
        <button type="button" onClick={() => setDate(shiftISO(date, -1))} aria-label="Previous day">&lsaquo;</button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
        <button type="button" onClick={() => setDate(shiftISO(date, 1))} aria-label="Next day">&rsaquo;</button>
        {date !== todayISO() && <button type="button" className="fa-today" onClick={() => setDate(todayISO())}>Today</button>}
      </div>
      <div className="fa-panel">
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{fmtDayLong(date)} · tap a card for its details</div>
        {loading ? <p className="fa-empty">Loading…</p> : items.length === 0 ? <p className="fa-empty">Nothing scheduled for this day.</p> : items.map((it) => {
          if (it.kind === 'task') {
            const t = it.d
            const done = t.status === 'completed'
            return (
              <div key={'t' + t.id} className={`fa-jcard ${done ? 'complete' : ''}`} role="button" tabIndex={0} onClick={() => navigate(`/tech/task/${t.id}`)}>
                <div className="fa-jcard-bar">{done ? 'COMPLETE' : 'INCOMPLETE'}</div>
                <div className="fa-jcard-num">TASK</div>
                <div className="fa-jcard-name">{t.destination_name}</div>
                <div className="fa-jcard-line">{t.scheduled_at ? formatTimeInZone(t.scheduled_at) : ''} - TASK</div>
                <div className="fa-jcard-line">Assigned: {techs[t.assigned_user_id]?.full_name || '—'}</div>
                {t.address && <div className="fa-jcard-line" style={{ fontWeight: 500 }}>{t.address}</div>}
              </div>
            )
          }
          const j = it.d
          const done = j.status === 'completed'
          const late = !done && isLate(j, now)
          const phone = j.customers?.primary_phone
          return (
            <div key={j.id} className={`fa-jcard ${done ? 'complete' : late ? 'late' : ''}`} role="button" tabIndex={0} onClick={() => navigate(`/tech/field/job/${j.id}`)}>
              <div className="fa-jcard-bar">{done ? 'COMPLETE' : late ? 'LATE' : 'INCOMPLETE'}</div>
              <div className="fa-jcard-num">{j.job_number}{j.segment > 1 ? `-${j.segment}` : ''}</div>
              <div className="fa-jcard-name" style={{ paddingRight: 44 }}>{j.customers?.display_name || 'Customer'}</div>
              <div className="fa-jcard-line">{j.start_time ? formatTimeInZone(j.start_time) : 'No time'} - {String(j.job_type || 'Job').toUpperCase()}</div>
              <div className="fa-jcard-line" style={{ paddingRight: 44 }}>Assigned: {techNames(j.techIds, techs) || <span style={{ color: '#B00020' }}>No tech</span>}</div>
              {j.properties?.street_address && <div className="fa-jcard-line" style={{ fontWeight: 500, paddingRight: 44 }}>{j.properties.street_address}{j.properties.unit ? ` #${j.properties.unit}` : ''}{j.properties.city ? `, ${j.properties.city}` : ''}</div>}
              <div className="fa-jcard-icons" onClick={(e) => e.stopPropagation()}>
                {phone && <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`} aria-label="Call customer">📞</a>}
                <button type="button" aria-label="Messages" onClick={() => navigate(`/tech/messages/${j.id}`)}>💬</button>
              </div>
            </div>
          )
        })}
      </div>
    </FieldShell>
  )
}
