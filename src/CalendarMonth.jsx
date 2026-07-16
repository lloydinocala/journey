import { useState } from 'react'
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function toLocalDateStr(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}
export default function CalendarMonth({ monthDate, gridDays, jobs, onJobClick, onDayClick, onJobDrop }) {
  const [draggingId, setDraggingId] = useState(null)
  const today = new Date()
  const currentMonth = monthDate.getMonth()
  function jobsForDay(day) {
    return jobs.filter((j) => j.job_date === toLocalDateStr(day))
  }
  function formatJobTime(job) {
    if (!job.start_time) return ''
    const d = new Date(job.start_time)
    const h = d.getHours()
    const m = d.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(m).padStart(2, '0')}`
  }
  function handleDragStart(e, job) {
    e.dataTransfer.setData('text/plain', job.id)
    setDraggingId(job.id)
  }
  function handleDrop(e, day) {
    e.preventDefault()
    const jobId = e.dataTransfer.getData('text/plain')
    if (!jobId || !onJobDrop) return
    onJobDrop(jobId, toLocalDateStr(day))
    setDraggingId(null)
  }
  return (
    <div className="calendar-month-grid">
      {WEEKDAY_LABELS.map((label) => (
        <div key={label} className="calendar-month-weekday">{label}</div>
      ))}
      {gridDays.map((day) => {
        const dayJobs = jobsForDay(day)
        const isOutside = day.getMonth() !== currentMonth
        const isToday = toLocalDateStr(day) === toLocalDateStr(today)
        const visibleJobs = dayJobs.slice(0, 3)
        const extraCount = dayJobs.length - visibleJobs.length
        return (
          <div
            key={toLocalDateStr(day)}
            className={`calendar-month-cell${isOutside ? ' outside-month' : ''}${isToday ? ' is-today' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, day)}
          >
            <div className="calendar-month-day-number" style={{ cursor: 'pointer' }} onClick={() => onDayClick(day)}>
              {day.getDate()}
            </div>
            {visibleJobs.map((job) => (
              <div
                key={job.id}
                className="calendar-month-job-pill"
                style={{
                  backgroundColor: job.status === 'completed' ? '#9CA3AF' : job.primary_technician?.calendar_color || '#8A93A6',
                  opacity: draggingId === job.id ? 0.5 : 1,
                }}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, job)}
                onDragEnd={() => setDraggingId(null)}
                onClick={() => onJobClick(job)}
              >
                {formatJobTime(job)} {job.customer_name}
              </div>
            ))}
            {extraCount > 0 && (
              <div
                className="calendar-month-job-pill"
                style={{ backgroundColor: 'var(--mist)', cursor: 'pointer' }}
                onClick={() => onDayClick(day)}
              >
                +{extraCount} more
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
