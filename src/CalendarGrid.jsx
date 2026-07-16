import { useState } from 'react'
import { formatDayLabel, isSameDay, timeToPixelY, pixelYToTimeString, getTotalGridHeight, getHourMarkers } from './utils/dateHelpers'

// Convert a stored UTC timestamp to an "HH:MM" string in the browser's LOCAL
// time. Using new Date(...).getHours()/getMinutes() here (rather than
// slicing the raw ISO string) is what actually converts UTC to local — a
// slice reads back whatever digits are literally stored, with no timezone
// awareness at all.
function localTimeString(isoString, fallback) {
  if (!isoString) return fallback
  const d = new Date(isoString)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function CalendarGrid({ days, jobs, businessStart, businessEnd, onJobClick, onJobDrop }) {
  const [draggingId, setDraggingId] = useState(null)
  const totalHeight = getTotalGridHeight(businessStart, businessEnd)
  const hourMarkers = getHourMarkers(businessStart, businessEnd)
  const today = new Date()

  function jobsForDay(day) {
    return jobs.filter((j) => j.job_date === toLocalDateStr(day))
  }

  function toLocalDateStr(d) {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const date = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${date}`
  }

  function blockStyle(job) {
    const startTime = localTimeString(job.start_time, '08:00')
    const top = timeToPixelY(startTime, businessStart, businessEnd)
    const [h, m] = startTime.split(':').map(Number)
    const endMinutes = h * 60 + m + (job.duration_hours || 1) * 60
    const endH = Math.floor(endMinutes / 60)
    const endM = endMinutes % 60
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
    const bottom = timeToPixelY(endTime, businessStart, businessEnd)
    const height = Math.max(bottom - top, 16)
    return {
      top,
      height,
      backgroundColor: job.status === 'completed' ? '#9CA3AF' : job.primary_technician?.calendar_color || '#8A93A6',
    }
  }

  function formatTimeLabel(job) {
    if (!job.start_time) return ''
    const [h, m] = localTimeString(job.start_time, '08:00').split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  function handleDragStart(e, job) {
    e.dataTransfer.setData('text/plain', job.id)
    setDraggingId(job.id)
  }

  function handleDragEnd() {
    setDraggingId(null)
  }

  function handleDrop(e, day) {
    e.preventDefault()
    const jobId = e.dataTransfer.getData('text/plain')
    if (!jobId || !onJobDrop) return
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const newTime = pixelYToTimeString(offsetY, businessStart, businessEnd)
    onJobDrop(jobId, toLocalDateStr(day), newTime)
    setDraggingId(null)
  }

  return (
    <div className="calendar-grid-wrap">
      <div className="calendar-grid" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
        <div
          className="calendar-header-row"
          style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)`, gridColumn: '1 / -1' }}
        >
          <div className="calendar-header-cell"></div>
          {days.map((day) => (
            <div key={toLocalDateStr(day)} className="calendar-header-cell">
              {formatDayLabel(day)}
            </div>
          ))}
        </div>

        <div
          className="calendar-body-row"
          style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)`, gridColumn: '1 / -1', height: totalHeight }}
        >
          <div className="calendar-time-col" style={{ height: totalHeight }}>
            {hourMarkers.map((m) => (
              <div key={m.hour} className="calendar-hour-label" style={{ top: m.pixelY }}>
                {m.label}
              </div>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={toLocalDateStr(day)}
              className="calendar-day-col"
              style={{ height: totalHeight }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, day)}
            >
              {hourMarkers.map((m) => (
                <div key={m.hour} className="calendar-hour-line" style={{ top: m.pixelY }} />
              ))}
              {isSameDay(day, today) && (
                <div
                  className="calendar-now-line"
                  style={{
                    top: timeToPixelY(
                      `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`,
                      businessStart,
                      businessEnd
                    ),
                  }}
                />
              )}
             {jobsForDay(day).map((job) => (
                <div
                  key={job.id}
                  className={`job-block${job.is_banned ? ' banned' : ''}${draggingId === job.id ? ' dragging' : ''}`}
                  style={blockStyle(job)}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, job)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onJobClick(job)}
                >
                 <div className="job-block-label">
                    <strong>{formatTimeLabel(job)}</strong>
                    {job.customer_name}
                  </div>
                  <div className="job-tooltip">
                    <strong>{job.customer_name}</strong>
                    {formatTimeLabel(job)} · {job.job_type}<br />
                    {job.technician_names}<br />
                    <span className={`status-pill status-${job.status}`} style={{ marginTop: 4 }}>{job.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
