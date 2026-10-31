// Outside bookings (estimate apps, customer portal, QR service requests) carry where they came
// from (jobs.booking_source) and when they arrived (jobs.received_at), so dispatch can see who
// has been waiting longest.
export const SOURCE_LABEL = {
  systems_app: 'Systems Estimate App',
  duct_app: 'Duct Cleaning App',
  portal: 'Customer Portal',
  service_request: 'Service Request',
}
export const SOURCE_SHORT = {
  systems_app: 'Systems App',
  duct_app: 'Duct App',
  portal: 'Portal',
  service_request: 'Service Req.',
}

export function fmtReceived(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// "12 min ago", "5 hr ago", "3 days ago"
export function receivedAgo(ts, now = Date.now()) {
  if (!ts) return ''
  const m = Math.max(0, Math.round((now - new Date(ts).getTime()) / 60000))
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} hr ago`
  return `${Math.round(h / 24)} days ago`
}

// An outside booking nobody has put a technician on yet.
export function isNewUnassigned(job) {
  return !!job?.booking_source && !(job.job_technicians || []).length
    && !['cancelled', 'completed', 'incomplete'].includes(job.status)
}
