const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toLocalDateStr(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

export default function CalendarMonth({ monthDate, gridDays, jobs, onJobClick, onDayClick }) {
  const today = new Date()
  const currentMonth = monthDate.getMonth()

  function jobsForDay(day) {
    return jobs.filter((j) => j.job_date === toLocalDateStr(day))
  }

  function formatJobTime(job) {
    if (!job.start_time) return ''
    const [h, m] = job.start_time.slice(11, 16).split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(m).padStart(2, '0')}`
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
          >
            <div className="calendar-month-day-number" style={{ cursor: 'pointer' }} onClick={() => onDayClick(day)}>
              {day.getDate()}
            </div>
            {visibleJobs.map((job) => (
              <div
                key={job.id}
                className="calendar-month-job-pill"
                style={{ backgroundColor: job.technician_1?.calendar_color || '#8A93A6' }}
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
