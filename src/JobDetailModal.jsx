export default function JobDetailModal({ job, onClose }) {
  if (!job) return null

  function formatTime(startTime) {
    if (!startTime) return 'No time set'
    const [h, m] = startTime.slice(11, 16).split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{job.job_number}</h3>

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

        <div className="modal-row">
          <span className="label">Service complaint</span>
          {job.service_complaint || 'No complaint noted'}
        </div>

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
