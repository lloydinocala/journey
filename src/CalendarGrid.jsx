import { useState } from 'react'
import { formatDayLabel, isSameDay, timeToPixelY, pixelYToTimeString, getTotalGridHeight, getHourMarkers } from './utils/dateHelpers'
import { utcToZonedInputs } from './utils/tz'

// Convert a stored UTC timestamp to an "HH:MM" string in the browser's LOCAL
// time. Using new Date(...).getHours()/getMinutes() here (rather than
// slicing the raw ISO string) is what actually converts UTC to local — a
// slice reads back whatever digits are literally stored, with no timezone
// awareness at all.
function localTimeString(isoString, fallback) {
  if (!isoString) return fallback
  // Position events by the organization's local wall-clock, not the viewer's device.
  return utcToZonedInputs(isoString).time || fallback
}

export default function CalendarGrid({ days, jobs, businessStart, businessEnd, onJobClick, onJobDrop, onShowMore }) {
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
      backgroundColor: job.date_pending
        ? '#F59E0B'
        : job.status === 'incomplete'
          ? '#DC2626'
          : job.status === 'completed'
          ? '#9CA3AF'
          : job.primary_technician?.calendar_color || '#DC2626',
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

  function minToTime(min) {
    const h = Math.floor(min / 60), m = Math.round(min % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  // Lay overlapping jobs into side-by-side lanes. When more than 3 overlap in a
  // cluster, show the two earliest and collapse the rest into a "+N more" chip
  // (clicking it opens Day view, where they all lay out with room).
  function laneLayout(dayJobs) {
    const items = dayJobs
      .map((j) => {
        const [h, m] = localTimeString(j.start_time, '08:00').split(':').map(Number)
        const start = h * 60 + m
        return { id: j.id, start, end: start + (j.duration_hours || 1) * 60 }
      })
      .sort((a, b) => a.start - b.start || a.end - b.end)
    const out = {}
    const chips = []
    let cluster = [], clusterEnd = -1
    const flush = () => {
      const laneEnds = []
      for (const it of cluster) {
        let lane = laneEnds.findIndex((e) => e <= it.start)
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.end) } else laneEnds[lane] = it.end
        out[it.id] = { lane }
      }
      const lanes = laneEnds.length
      if (lanes > 3) {
        const byStart = [...cluster].sort((a, b) => a.start - b.start || a.end - b.end)
        const visibleIds = new Set(byStart.slice(0, 2).map((x) => x.id))
        byStart.slice(0, 2).forEach((it, i) => { out[it.id] = { lane: i, lanes: 3 } })
        let cs = Infinity, ce = -Infinity, count = 0
        for (const it of cluster) {
          if (visibleIds.has(it.id)) continue
          out[it.id].hidden = true
          cs = Math.min(cs, it.start); ce = Math.max(ce, it.end); count++
        }
        chips.push({ start: cs, end: ce, count })
      } else {
        for (const it of cluster) out[it.id].lanes = lanes
      }
      cluster = []; clusterEnd = -1
    }
    for (const it of items) {
      if (cluster.length && it.start >= clusterEnd) flush()
      cluster.push(it)
      clusterEnd = Math.max(clusterEnd, it.end)
    }
    if (cluster.length) flush()
    return { out, chips }
  }

  function laneStyle(l) {
    if (!l || l.lanes <= 1) return {}
    const lanes = Math.min(l.lanes, 3)
    const w = 100 / lanes
    const lane = Math.min(l.lane, lanes - 1)
    return { left: `calc(${lane * w}% + 2px)`, width: `calc(${w}% - 4px)`, right: 'auto' }
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

          {days.map((day) => {
            const dayJobs = jobsForDay(day)
            const { out: layout, chips } = laneLayout(dayJobs)
            return (
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
             {dayJobs.filter((job) => !layout[job.id]?.hidden).map((job) => (
                <div
                  key={job.id}
                  className={`job-block${job.is_banned ? ' banned' : ''}${draggingId === job.id ? ' dragging' : ''}`}
                  style={{ ...blockStyle(job), ...laneStyle(layout[job.id]) }}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, job)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onJobClick(job)}
                >
                 <div className="job-block-label">
                    {job.date_pending ? '⏳ ' : ''}<strong>{formatTimeLabel(job)}</strong>
                    {job.customer_name}
                  </div>
                  <div className="job-tooltip">
                    <strong>{job.customer_name}</strong>
                    {formatTimeLabel(job)} · {job.job_type}<br />
                    {job.technician_names}<br />
                    {job.date_pending && <span style={{ color: '#F59E0B', fontWeight: 700 }}>⏳ Pending — needs scheduling<br /></span>}
                    <span className={`status-pill status-${job.status}`} style={{ marginTop: 4 }}>{job.status}</span>
                  </div>
                </div>
              ))}
              {chips.map((c, ci) => {
                const top = timeToPixelY(minToTime(c.start), businessStart, businessEnd)
                const bottom = timeToPixelY(minToTime(c.end), businessStart, businessEnd)
                const w = 100 / 3
                return (
                  <div
                    key={'more-' + ci}
                    className="job-block"
                    style={{ top, height: Math.max(bottom - top, 16), left: `calc(${2 * w}% + 2px)`, width: `calc(${w}% - 4px)`, right: 'auto', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    onClick={() => onShowMore && onShowMore(day)}
                    title={c.count + ' more in this slot — open Day view'}
                  >
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', textAlign: 'center' }}>+{c.count} more</span>
                  </div>
                )
              })}
            </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
