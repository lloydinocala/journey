import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import TripChargePicker from './TripChargePicker'
import { IconChevronLeft } from './MobileIcons'

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

export default function TechNewJob({ profile }) {
  const navigate = useNavigate()

  const [properties, setProperties] = useState([])
  const [jobTypes, setJobTypes] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [propertyId, setPropertyId] = useState('')
  const [jobDate, setJobDate] = useState(todayISO())
  const [startTime, setStartTime] = useState('')
  const [durationHours, setDurationHours] = useState('1')
  const [jobType, setJobType] = useState('')
  const [serviceComplaint, setServiceComplaint] = useState('')
  const [technicianId, setTechnicianId] = useState('')
  const [tripChargeId, setTripChargeId] = useState(null)

  useEffect(() => {
    if (!profile?.org_id) return
    setLoading(true)
    Promise.all([
      supabase
        .from('properties')
        .select('id, street_address, unit, city, customer_id, customers!properties_customer_id_fkey(display_name, is_banned)')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .order('street_address'),
      supabase.from('job_types').select('id, name').eq('org_id', profile.org_id).eq('is_active', true).order('sort_order'),
      supabase.from('users').select('id, full_name').eq('org_id', profile.org_id).eq('is_active', true).order('full_name'),
    ]).then(([propsRes, typesRes, usersRes]) => {
      setProperties(propsRes.data || [])
      setJobTypes(typesRes.data || [])
      setUsers(usersRes.data || [])
      if (typesRes.data && typesRes.data.length > 0) setJobType(typesRes.data[0].name)
      setLoading(false)
    })
  }, [profile?.org_id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!propertyId || !jobDate) {
      setError('Property and date are required.')
      return
    }
    const property = properties.find((p) => p.id === propertyId)
    if (property?.customers?.is_banned) {
      setError('This customer is flagged Do Not Service. Contact the office before scheduling.')
      return
    }

    setSaving(true)
    const { count } = await supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('org_id', profile.org_id)
    const jobNumber = `J-${String((count || 0) + 1).padStart(4, '0')}`
    const startTimestamp = startTime ? `${jobDate}T${startTime}:00` : null

    const { data: newJob, error: insertError } = await supabase
      .from('jobs')
      .insert({
        org_id: profile.org_id,
        job_number: jobNumber,
        segment: 1,
        property_id: propertyId,
        customer_id: property.customer_id,
        job_date: jobDate,
        start_time: startTimestamp,
        duration_hours: durationHours ? parseFloat(durationHours) : null,
        job_type: jobType,
        service_complaint: serviceComplaint.trim() || null,
        trip_charge_price_id: tripChargeId || null,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    if (technicianId) {
      await supabase.from('job_technicians').insert({
        org_id: profile.org_id,
        job_id: newJob.id,
        user_id: technicianId,
        sort_order: 1,
      })
    }

    setSaving(false)
    navigate(`/tech/${newJob.id}`)
  }

  return (
    <div className="mobile-shell">
      <div className="mobile-header job-detail-header">
        <button className="mobile-back" onClick={() => navigate(-1)}><IconChevronLeft /></button>
        <div className="job-detail-header-text">
          <div className="job-detail-title">New Job</div>
        </div>
      </div>

      <div className="mobile-body">
        {loading ? (
          <p style={{ color: 'var(--mist)' }}>Loading…</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="section-card">
              <div className="section-card-header"><span>Property</span></div>
              <div className="section-card-body">
                <div className="mobile-field">
                  <label>Property</label>
                  <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required>
                    <option value="">Select…</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.customers?.is_banned ? '⚠️ DO NOT SERVICE — ' : ''}{p.street_address}{p.unit ? ` #${p.unit}` : ''} — {p.customers?.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-card-header"><span>Schedule</span></div>
              <div className="section-card-body">
                <div className="mobile-field-row">
                  <div className="mobile-field"><label>Date</label><input type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)} required /></div>
                  <div className="mobile-field"><label>Start Time</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                </div>
                <div className="mobile-field-row">
                  <div className="mobile-field"><label>Duration (hrs)</label><input type="number" step="0.5" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} /></div>
                  <div className="mobile-field">
                    <label>Job Type</label>
                    <select value={jobType} onChange={(e) => setJobType(e.target.value)}>
                      {jobTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mobile-field">
                  <label>Issue / Notes</label>
                  <input type="text" value={serviceComplaint} onChange={(e) => setServiceComplaint(e.target.value)} placeholder="e.g. No cooling" />
                </div>
                <div className="mobile-field">
                  <label>Technician</label>
                  <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-card-header"><span>Trip Charge</span></div>
              <div className="section-card-body">
                <TripChargePicker orgId={profile.org_id} value={tripChargeId} onChange={setTripChargeId} />
              </div>
            </div>

            {error && <p style={{ color: '#C0392B', fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <button className="action-btn primary" style={{ width: '100%', padding: '13px 0', fontSize: 14 }} type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create Job'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
