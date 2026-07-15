import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import TripChargePicker from './TripChargePicker'
import CustomerSearchSelect from './CustomerSearchSelect'
import { IconChevronLeft } from './MobileIcons'

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

const MODES = {
  job: { title: 'New Job', submitLabel: 'Create Job', destination: (jobId) => `/tech/${jobId}`, allowNewCustomer: false },
  'service-estimate': { title: 'New Service Estimate', submitLabel: 'Create & Start Estimate', destination: (jobId) => `/tech/estimate/${jobId}`, allowNewCustomer: true },
  'system-estimate': { title: 'New System Estimate', submitLabel: 'Create & Start Estimate', destination: (jobId) => `/tech/system-estimate/${jobId}`, allowNewCustomer: true },
}

export default function TechNewJob({ profile, mode = 'job' }) {
  const navigate = useNavigate()
  const modeConfig = MODES[mode] || MODES.job

  const [jobTypes, setJobTypes] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 'existing' = pick a property already on file. 'new' = create a customer + property
  // on the spot (a supervisor out estimating a lead who isn't in the system yet).
  const [customerMode, setCustomerMode] = useState('existing')

  const [existingCustomerId, setExistingCustomerId] = useState('')
  const [existingCustomerBanned, setExistingCustomerBanned] = useState(false)
  const [customerProperties, setCustomerProperties] = useState([])
  const [propertyId, setPropertyId] = useState('')
  const [existingTenantIds, setExistingTenantIds] = useState([null, null])
  const [tenant1Name, setTenant1Name] = useState('')
  const [tenant1Phone, setTenant1Phone] = useState('')
  const [tenant2Name, setTenant2Name] = useState('')
  const [tenant2Phone, setTenant2Phone] = useState('')

  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [newStreet, setNewStreet] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newState, setNewState] = useState('FL')
  const [newZip, setNewZip] = useState('')

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
      supabase.from('job_types').select('id, name').eq('org_id', profile.org_id).eq('is_active', true).order('sort_order'),
      supabase.from('users').select('id, full_name').eq('org_id', profile.org_id).eq('is_active', true).order('full_name'),
    ]).then(([typesRes, usersRes]) => {
      setJobTypes(typesRes.data || [])
      setUsers(usersRes.data || [])
      if (typesRes.data && typesRes.data.length > 0) setJobType(typesRes.data[0].name)
      setLoading(false)
    })
  }, [profile?.org_id])

  // Once a customer is picked, load just their properties — never the whole org's.
  useEffect(() => {
    if (existingCustomerId) {
      supabase
        .from('properties')
        .select('id, street_address, unit, city')
        .eq('customer_id', existingCustomerId)
        .eq('is_active', true)
        .order('street_address')
        .then(({ data }) => {
          setCustomerProperties(data || [])
          setPropertyId('')
        })
    } else {
      setCustomerProperties([])
      setPropertyId('')
    }
  }, [existingCustomerId])

  // Once a specific property is picked, pull its tenants so the tech sees who's
  // there and can confirm/update a phone number on the spot rather than re-asking
  // the office for info that's already on file.
  useEffect(() => {
    if (propertyId) {
      supabase
        .from('property_tenants')
        .select('id, name, phone')
        .eq('property_id', propertyId)
        .order('created_at')
        .then(({ data }) => {
          const tenants = data || []
          setExistingTenantIds([tenants[0]?.id || null, tenants[1]?.id || null])
          setTenant1Name(tenants[0]?.name || '')
          setTenant1Phone(tenants[0]?.phone || '')
          setTenant2Name(tenants[1]?.name || '')
          setTenant2Phone(tenants[1]?.phone || '')
        })
    } else {
      setExistingTenantIds([null, null])
      setTenant1Name('')
      setTenant1Phone('')
      setTenant2Name('')
      setTenant2Phone('')
    }
  }, [propertyId])

  async function upsertTenant(propId, tenantId, name, phone) {
    if (tenantId) {
      if (name.trim()) {
        await supabase.from('property_tenants').update({ name: name.trim(), phone: phone.trim() || null }).eq('id', tenantId)
      }
    } else if (name.trim()) {
      await supabase.from('property_tenants').insert({
        org_id: profile.org_id,
        property_id: propId,
        name: name.trim(),
        phone: phone.trim() || null,
      })
    }
  }

  async function resolvePropertyAndCustomer() {
    if (customerMode === 'existing') {
      if (!existingCustomerId) {
        setError('Select a customer.')
        return null
      }
      if (existingCustomerBanned) {
        setError('This customer is flagged Do Not Service. Contact the office before scheduling.')
        return null
      }
      if (!propertyId) {
        setError('Select a property.')
        return null
      }
      await upsertTenant(propertyId, existingTenantIds[0], tenant1Name, tenant1Phone)
      await upsertTenant(propertyId, existingTenantIds[1], tenant2Name, tenant2Phone)
      return { propertyId, customerId: existingCustomerId }
    }

    // customerMode === 'new'
    if (!newCustomerName.trim() || !newStreet.trim()) {
      setError('Customer name and street address are required.')
      return null
    }
    const { data: newCustomer, error: custError } = await supabase
      .from('customers')
      .insert({
        org_id: profile.org_id,
        display_name: newCustomerName.trim(),
        primary_phone: newCustomerPhone.trim() || null,
        email_1: newCustomerEmail.trim() || null,
      })
      .select()
      .single()
    if (custError) {
      setError(custError.message)
      return null
    }

    const { data: newProperty, error: propError } = await supabase
      .from('properties')
      .insert({
        org_id: profile.org_id,
        customer_id: newCustomer.id,
        street_address: newStreet.trim(),
        unit: newUnit.trim() || null,
        city: newCity.trim() || null,
        state: newState.trim() || null,
        zip: newZip.trim() || null,
      })
      .select()
      .single()
    if (propError) {
      setError(propError.message)
      return null
    }

    return { propertyId: newProperty.id, customerId: newCustomer.id }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!jobDate) {
      setError('Date is required.')
      return
    }

    setSaving(true)

    const resolved = await resolvePropertyAndCustomer()
    if (!resolved) {
      setSaving(false)
      return
    }

    const { count } = await supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('org_id', profile.org_id)
    const jobNumber = `J-${String((count || 0) + 1).padStart(4, '0')}`
    const startTimestamp = startTime ? `${jobDate}T${startTime}:00` : null

    const { data: newJob, error: insertError } = await supabase
      .from('jobs')
      .insert({
        org_id: profile.org_id,
        job_number: jobNumber,
        segment: 1,
        property_id: resolved.propertyId,
        customer_id: resolved.customerId,
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
    navigate(modeConfig.destination(newJob.id))
  }

  return (
    <div className="mobile-shell">
      <div className="mobile-header job-detail-header">
        <button className="mobile-back" onClick={() => navigate(-1)}><IconChevronLeft /></button>
        <div className="job-detail-header-text">
          <div className="job-detail-title">{modeConfig.title}</div>
        </div>
      </div>

      <div className="mobile-body">
        {loading ? (
          <p style={{ color: 'var(--mist)' }}>Loading…</p>
        ) : (
          <form onSubmit={handleSubmit}>
            {modeConfig.allowNewCustomer && (
              <div className="mode-toggle-row">
                <button type="button" className={customerMode === 'existing' ? 'active' : ''} onClick={() => setCustomerMode('existing')}>
                  Existing Customer
                </button>
                <button type="button" className={customerMode === 'new' ? 'active' : ''} onClick={() => setCustomerMode('new')}>
                  New Customer
                </button>
              </div>
            )}

            {customerMode === 'existing' ? (
              <>
                <div className="section-card">
                  <div className="section-card-header"><span>Customer</span></div>
                  <div className="section-card-body">
                    <div className="mobile-field">
                      <label>Customer</label>
                      <CustomerSearchSelect
                        orgId={profile.org_id}
                        value={existingCustomerId}
                        onChange={(id, customer) => {
                          setExistingCustomerId(id)
                          setExistingCustomerBanned(customer?.is_banned || false)
                        }}
                      />
                    </div>
                  </div>
                </div>

                {existingCustomerId && (
                  <div className="section-card">
                    <div className="section-card-header"><span>Property</span></div>
                    <div className="section-card-body">
                      <div className="mobile-field">
                        <label>Property</label>
                        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required>
                          <option value="">
                            {customerProperties.length === 0 ? 'No properties on file for this customer' : 'Select…'}
                          </option>
                          {customerProperties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.street_address}{p.unit ? ` #${p.unit}` : ''}{p.city ? `, ${p.city}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {propertyId && (
                        <>
                          <p style={{ fontSize: 11.5, color: 'var(--mist)', margin: '10px 0 6px' }}>
                            Tenants on file — edit if anything's changed
                          </p>
                          <div className="mobile-field-row">
                            <div className="mobile-field"><label>Tenant 1</label><input type="text" value={tenant1Name} onChange={(e) => setTenant1Name(e.target.value)} /></div>
                            <div className="mobile-field"><label>Phone</label><input type="tel" value={tenant1Phone} onChange={(e) => setTenant1Phone(e.target.value)} /></div>
                          </div>
                          <div className="mobile-field-row">
                            <div className="mobile-field"><label>Tenant 2</label><input type="text" value={tenant2Name} onChange={(e) => setTenant2Name(e.target.value)} /></div>
                            <div className="mobile-field"><label>Phone</label><input type="tel" value={tenant2Phone} onChange={(e) => setTenant2Phone(e.target.value)} /></div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {existingCustomerBanned && (
                  <p style={{ color: '#C0392B', fontSize: 12.5, margin: '0 0 12px' }}>
                    This customer is flagged Do Not Service. Contact the office before scheduling.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="section-card">
                  <div className="section-card-header"><span>New Customer</span></div>
                  <div className="section-card-body">
                    <div className="mobile-field">
                      <label>Customer Name</label>
                      <input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="e.g. Jane Smith" required={customerMode === 'new'} />
                    </div>
                    <div className="mobile-field-row">
                      <div className="mobile-field"><label>Phone</label><input type="tel" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} /></div>
                      <div className="mobile-field"><label>Email</label><input type="email" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} /></div>
                    </div>
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-card-header"><span>New Property</span></div>
                  <div className="section-card-body">
                    <div className="mobile-field">
                      <label>Street Address</label>
                      <input type="text" value={newStreet} onChange={(e) => setNewStreet(e.target.value)} required={customerMode === 'new'} />
                    </div>
                    <div className="mobile-field-row">
                      <div className="mobile-field"><label>Unit</label><input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} /></div>
                      <div className="mobile-field"><label>City</label><input type="text" value={newCity} onChange={(e) => setNewCity(e.target.value)} /></div>
                    </div>
                    <div className="mobile-field-row">
                      <div className="mobile-field"><label>State</label><input type="text" value={newState} onChange={(e) => setNewState(e.target.value)} /></div>
                      <div className="mobile-field"><label>Zip</label><input type="text" value={newZip} onChange={(e) => setNewZip(e.target.value)} /></div>
                    </div>
                  </div>
                </div>
              </>
            )}

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
              {saving ? 'Creating…' : modeConfig.submitLabel}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
