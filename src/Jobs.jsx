import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

export default function Jobs({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [properties, setProperties] = useState([])
  const [users, setUsers] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  const [propertyId, setPropertyId] = useState('')
  const [jobDate, setJobDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [durationHours, setDurationHours] = useState('1')
const [jobType, setJobType] = useState('')
  const [jobTypes, setJobTypes] = useState([])
  const [serviceComplaint, setServiceComplaint] = useState('')
  const [technicianId, setTechnicianId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isSuperAdmin = profile.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length > 0) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function loadData(orgId) {
    if (!orgId) return
    setLoading(true)
    const [propsRes, usersRes, jobsRes, jobTypesRes] = await Promise.all([
      supabase
        .from('properties')
        .select('id, street_address, customer_id, customers!properties_customer_id_fkey(display_name)')
        .eq('org_id', orgId)
        .order('street_address'),
      supabase.from('users').select('id, full_name').eq('org_id', orgId).order('full_name'),
      supabase
        .from('jobs')
        .select('id, job_number, status, job_date, start_time, duration_hours, job_type, service_complaint, properties(street_address), technician_1:technician_1_id(full_name)')
        .eq('org_id', orgId)
        .order('job_date', { ascending: false }),
      supabase.from('job_types').select('id, name').eq('org_id', orgId).eq('is_active', true).order('sort_order'),
    ])
    setProperties(propsRes.data || [])
    setUsers(usersRes.data || [])
    setJobs(jobsRes.data || [])
    setJobTypes(jobTypesRes.data || [])
    if (jobTypesRes.data && jobTypesRes.data.length > 0) setJobType(jobTypesRes.data[0].name)
    setLoading(false)
  }

  useEffect(() => {
    loadData(selectedOrg)
  }, [selectedOrg])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!propertyId || !jobDate) return

    setSaving(true)

    const property = properties.find((p) => p.id === propertyId)

    const { count } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', selectedOrg)

    const jobNumber = `J-${String((count || 0) + 1).padStart(4, '0')}`

    const startTimestamp = startTime ? `${jobDate}T${startTime}:00` : null

    const { error } = await supabase.from('jobs').insert({
      org_id: selectedOrg,
      job_number: jobNumber,
      property_id: propertyId,
      customer_id: property.customer_id,
      job_date: jobDate,
      start_time: startTimestamp,
      duration_hours: durationHours ? parseFloat(durationHours) : null,
      job_type: jobType,
      service_complaint: serviceComplaint.trim() || null,
      technician_1_id: technicianId || null,
    })

    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setPropertyId('')
      setJobDate('')
      setStartTime('')
      setDurationHours('1')
      setServiceComplaint('')
      setTechnicianId('')
      loadData(selectedOrg)
    }
  }

  return (
    <div>
      <h2 className="page-title">Jobs</h2>

      {isSuperAdmin && (
        <div className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
          <label htmlFor="orgPicker">Viewing organization</label>
          <select id="orgPicker" value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)}>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
      )}

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 28, flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="propPick">Property</label>
          <select id="propPick" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required>
            <option value="">Select…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.street_address} — {p.customers?.display_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="jobDate">Date</label>
          <input id="jobDate" type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="startTime">Start time</label>
          <input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="duration">Duration (hrs)</label>
          <input id="duration" type="number" step="0.5" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} style={{ width: 80 }} />
        </div>
        <div className="field">
          <label htmlFor="jobType">Type</label>
          <select id="jobType" value={jobType} onChange={(e) => setJobType(e.target.value)}>
            {jobTypes.map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="complaint">Service complaint</label>
          <input id="complaint" type="text" value={serviceComplaint} onChange={(e) => setServiceComplaint(e.target.value)} placeholder="e.g. No cooling" />
        </div>
        <div className="field">
          <label htmlFor="tech">Technician</label>
          <select id="tech" value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
        <button className="auth-button" type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add job'}
        </button>
      </form>

      {error && <div className="auth-error">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Job #</th>
              <th>Date</th>
              <th>Address</th>
              <th>Type</th>
              <th>Complaint</th>
              <th>Technician</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.job_number}</td>
                <td>{j.job_date}</td>
                <td>{j.properties?.street_address || '—'}</td>
                <td>{j.job_type}</td>
                <td>{j.service_complaint || '—'}</td>
                <td>{j.technician_1?.full_name || 'Unassigned'}</td>
                <td><span className={`status-pill status-${j.status}`}>{j.status}</span></td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td colSpan="7" style={{ color: 'var(--mist)' }}>No jobs yet.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
