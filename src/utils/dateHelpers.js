export function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function toDateString(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isSameDay(a, b) {
  return toDateString(a) === toDateString(b)
}

export function formatDayLabel(date) {
  return new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatMonthLabel(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function formatWeekRangeLabel(weekStart) {
  const weekEnd = addDays(weekStart, 6)
  const startLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

export function getMonthGridDays(date) {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
  const gridStart = startOfWeek(firstOfMonth)
  const days = []
  for (let i = 0; i < 42; i++) {
    days.push(addDays(gridStart, i))
  }
  return days
}

export function timeStringToMinutes(timeStr) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
export const SLOT_HEIGHT_PX = 20

export function timeToPixelY(timeStr, businessStart, businessEnd) {
  const t = timeStringToMinutes(timeStr)
  const bStart = timeStringToMinutes(businessStart)
  const bEnd = timeStringToMinutes(businessEnd)

  if (t <= bStart) {
    return (t / 30) * SLOT_HEIGHT_PX
  }
  const preBusiness = (bStart / 30) * SLOT_HEIGHT_PX
  if (t <= bEnd) {
    return preBusiness + ((t - bStart) / 15) * SLOT_HEIGHT_PX
  }
  const businessSpan = ((bEnd - bStart) / 15) * SLOT_HEIGHT_PX
  const postBusiness = ((t - bEnd) / 30) * SLOT_HEIGHT_PX
  return preBusiness + businessSpan + postBusiness
}

export function getTotalGridHeight(businessStart, businessEnd) {
  return timeToPixelY('24:00', businessStart, businessEnd)
}

export function pixelYToTimeString(pixelY, businessStart, businessEnd) {
  const bStart = timeStringToMinutes(businessStart)
  const bEnd = timeStringToMinutes(businessEnd)
  const preBusiness = (bStart / 30) * SLOT_HEIGHT_PX
  const businessSpan = ((bEnd - bStart) / 15) * SLOT_HEIGHT_PX

  let minutes
  if (pixelY <= preBusiness) {
    minutes = Math.round(((pixelY / SLOT_HEIGHT_PX) * 30) / 30) * 30
  } else if (pixelY <= preBusiness + businessSpan) {
    minutes = bStart + Math.round((((pixelY - preBusiness) / SLOT_HEIGHT_PX) * 15) / 15) * 15
  } else {
    minutes = bEnd + Math.round((((pixelY - preBusiness - businessSpan) / SLOT_HEIGHT_PX) * 30) / 30) * 30
  }
  minutes = Math.max(0, Math.min(1439, minutes))
  return minutesToTimeString(minutes)
}

export function getHourMarkers(businessStart, businessEnd) {
  const markers = []
  for (let h = 0; h < 24; h++) {
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
    const timeStr = `${String(h).padStart(2, '0')}:00`
    markers.push({ hour: h, label, pixelY: timeToPixelY(timeStr, businessStart, businessEnd) })
  }
  return markers
}
