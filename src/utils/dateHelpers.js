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
