import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { formatTimeInZone } from './utils/tz'

function money(n) {
  if (n == null || isNaN(n)) return '—'
  return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function JobDetailModal({ job, onClose }) {
  const [materials, setMaterials] = useState(null)   // job-specific purchases

  useEffect(() => {
    if (!job?.id) return
    let cancel = false
    supabase.from('part_expense_lines')
      .select('id, description, quantity, unit_cost, extended_cost, purchased_at, reference, vendors(name)')
      .eq('job_id', job.id).order('purchased_at', { ascending: true })
      .then(({ data }) => { if (!cancel) setMaterials(data || []) })
    return () => { cancel = true }
  }, [job?.id])

  if (!job) return null

  const isEstimate = job.job_type === 'System Estimate'
  const materialTotal = (materials || []).reduce((s, m) => s + (Number(m.extended_cost) || 0), 0)

  function formatTime(startTime) {
    if (!startTime) return 'No time set'
    // Render in the organization's timezone so it matches the Jobs list and calendar.
    return formatTimeInZone(startTime) || 'No time set'
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

        {materials && materials.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid #e2e4e8', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span className="label" style={{ fontWeight: 700, color: '#002060' }}>Materials &amp; Purchases</span>
              <span style={{ fontWeight: 800, color: '#002060' }}>{money(materialTotal)}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} style={{ borderTop: '1px solid #f0f1f4' }}>
                    <td style={{ padding: '5px 6px' }}>
                      {m.description || 'Item'}
                      <div style={{ fontSize: 11, color: 'var(--mist,#777)' }}>
                        {m.vendors?.name || 'Vendor'}{m.reference ? ` · ${m.reference}` : ''}{m.quantity ? ` · qty ${m.quantity}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>{money(m.extended_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: 'var(--mist,#777)', marginTop: 4 }}>
              Job-specific parts &amp; equipment purchased for this job (from vendor invoices).
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link to={`/jobs?job=${job.id}`} onClick={onClose} className="logout-button" style={{ textDecoration: 'none' }}>
            Open in Jobs Table
          </Link>
          <button className="logout-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
