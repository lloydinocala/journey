import { formatDayLabel, isSameDay, timeToPixelY, getTotalGridHeight, getHourMarkers } from './utils/dateHelpers'

export default function CalendarGrid({ days, jobs, businessStart, businessEnd, onJobClick }) {
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
    const startTime = job.start_time ? job.start_time.slice(11, 16) : '08:00'
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
      backgroundColor: job.technician_1?.calendar_color || '#8A93A6',
    }
  }

  function formatTimeLabel(job) {
    if (!job.start_time) return ''
    const [h, m] = job.start_time.slice(11, 16).split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  return (
