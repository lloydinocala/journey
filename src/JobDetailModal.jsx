export default function JobDetailModal({ job, onClose }) {
  if (!job) return null

  const isEstimate = job.job_type === 'System Estimate'

  function formatTime(startTime) {
    if (!startTime) return 'No time set'
    // Show the stored UTC instant in the viewer's local time so this matches the
    // Jobs list and calendar (raw-slicing the string would show UTC and disagree).
    const d = new Date(startTime)
    if (isNaN(d)) return 'No time set'
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{isEstimate ? 'Estimate ' : ''}{job.job_number}</h3>

        <div className="modal-row">
          <span className="label">Customer</span>
          {job.customer_name}
          {job.is_banned && (
            <span className="status-pill status-past_due" style={{ marginLeft: 8 }}>Do Not Service</span>
          )}
        </div>

        <div className="modal-row">
          <span className="label">Address</span>
          {job.full_address || job.address || '—'}
        </div>

        <div className="modal-row">
          <span className="label">Date &amp; time</span>
          {job.job_date} at {formatTime(job.start_time)} ({job.duration_hours || 1} hr{job.duration_hours !== 1 ? 's' : ''})
        </div>

        <div className="modal-row">
          <span className="label">Type</span>
          {job.job_type}
        </div>

        {!isEstimate && (
          <div className="modal-row">
            <span className="label">Issue</span>
            {job.service_complaint || 'No issue noted'}
          </div>
        )}

        {isEstimate && (
          <div className="modal-row">
            <span className="label">Notes</span>
            {job.service_complaint || 'No notes'}
          </div>
        )}

        <div className="modal-row">
          <span className="label">Technicians</span>
          {job.technician_names}
        </div>

        <div className="modal-row">
          <span className="label">Status</span>
          <span className={`status-pill status-${job.status}`}>{job.status}</span>
        </div>

        <button className="logout-button" onClick={onClose} style={{ marginTop: 16 }}>Close</button>
      </div>
    </div>
  )
}
