import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import TripChargePicker from './TripChargePicker'

export default function QuickAddModal({ mode, orgId, profile, onClose, onCreated }) {
  const [customers, setCustomers] = useState([])
  const [customerProperties, setCustomerProperties] = useState([])
  const [users, setUsers] = useState([])
  const [jobTypes, setJobTypes] = useState([])

  const [customerMode, setCustomerMode] = useState('existing')
  const [existingCustomerId, setExistingCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')

  const [propertyMode, setPropertyMode] = useState('existing')
  const [existingPropertyId, setExistingPropertyId] = useState('')
  const [newStreet, setNewStreet] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newState, setNewState] = useState('FL')
  const [newZip, setNewZip] = useState('')
  const [newGateCode, setNewGateCode] = useState('')
  const [newTenantName, setNewTenantName] = useState('')
  const [newTenantPhone, setNewTenantPhone] = useState('')

  const [jobDate, setJobDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [durationHours, setDurationHours] = useState('1')
  const [jobType, setJobType] = useState('')
  const [serviceComplaint, setServiceComplaint] = useState('')
  const [technicianId, setTechnicianId] = useState('')
  const [overrideBan, setOverrideBan] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canOverrideBan = profile.role === 'super_admin' || profile.role === 'org_admin'
  const selectedCustomerIsBanned =
    customerMode === 'existing' ? customers.find((c) => c.id === existingCustomerId)?.is_banned || false : false

  useEffect(() => {
    if (mode === 'property' || mode === 'job') {
      supabase
        .from('customers')
        .select('id, display_name, is_banned')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('display_name')
        .then(({ data }) => setCustomers(data || []))
    }
    if (mode === 'job') {
      supabase.from('users').select('id, full_name').eq('org_id', orgId).order('full_name').then(({ data }) => setUsers(data || []))
      supabase
        .from('job_types')
        .select('id, name')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('sort_order')
        .then(({ data }) => {
          setJobTypes(data || [])
          if (data && data.length > 0) setJobType(data[0].name)
        })
    }
  }, [orgId, mode])

  useEffect(() => {
    if (mode === 'job' && customerMode === 'existing' && existingCustomerId) {
      supabase
        .from('properties')
        .select('id, street_address')
        .eq('customer_id', existingCustomerId)
        .eq('is_active', true)
        .order('street_address')
        .then(({ data }) => {
          setCustomerProperties(data || [])
          setPropertyMode((data || []).length > 0 ? 'existing' : 'new')
        })
    } else {
      setCustomerProperties([])
    }
  }, [existingCustomerId, customerMode, mode])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      let customerId = existingCustomerId
      let customerIsBanned = false
      const needsNewCustomer = mode === 'customer' || customerMode === 'new'

      if (needsNewCustomer) {
        if (!newCustomerName.trim()) throw new Error('Customer name is required.')
      } else {
        if (!existingCustomerId) throw new Error('Please select a customer.')
        customerIsBanned = customers.find((c) => c.id === existingCustomerId)?.is_banned || false
      }

      if (mode === 'job' && customerIsBanned && (!canOverrideBan || !overrideBan)) {
        throw new Error(
          canOverrideBan
            ? 'This customer is flagged Do Not Service. Check the override box to proceed.'
            : 'This customer is flagged Do Not Service. An admin must schedule this job.'
        )
      }

      if (needsNewCustomer) {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({
            org_id: orgId,
            display_name: newCustomerName.trim(),
            primary_phone: newCustomerPhone.trim() || null,
            email_1: newCustomerEmail.trim() || null,
          })
          .select()
          .single()
        if (custErr) throw custErr
        customerId = newCust.id
      }

      if (mode === 'customer') {
        onCreated()
        onClose()
        return
      }

      let propertyId = existingPropertyId
      const needsNewProperty = customerMode === 'new' || propertyMode === 'new'

      if (needsNewProperty) {
        if (!newStreet.trim()) throw new Error('Street address is required.')
        const { data: newProp, error: propErr } = await supabase
          .from('properties')
          .insert({
            org_id: orgId,
            customer_id: customerId,
            street_address: newStreet.trim(),
            unit: newUnit.trim() || null,
            city: newCity.trim() || null,
            state: newState.trim() || null,
            zip: newZip.trim() || null,
            gate_code: newGateCode.trim() || null,
          })
          .select()
          .single()
        if (propErr) throw propErr
        propertyId = newProp.id

        if (newTenantName.trim()) {
          await supabase.from('property_tenants').insert({
            org_id: orgId,
            property_id: propertyId,
            name: newTenantName.trim(),
            phone: newTenantPhone.trim() || null,
          })
        }
      } else {
        if (!existingPropertyId) throw new Error('Please select a property.')
      }

      if (mode === 'property') {
        onCreated()
        onClose()
        return
      }

      if (!jobDate) throw new Error('Job date is required.')

      const { count } = await supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
      const jobNumber = `J-${String((count || 0) + 1).padStart(4, '0')}`
      const startTimestamp = startTime ? `${jobDate}T${startTime}:00` : null

      const { data: newJob, error: jobErr } = await supabase
        .from('jobs')
        .insert({
          org_id: orgId,
          job_number: jobNumber,
          property_id: propertyId,
          customer_id: customerId,
          job_date: jobDate,
          start_time: startTimestamp,
          duration_hours: durationHours ? parseFloat(durationHours) : null,
          job_type: jobType,
          service_complaint: serviceComplaint.trim() || null,
        })
        .select()
        .single()
      if (jobErr) throw jobErr

      if (technicianId) {
        await supabase.from('job_technicians').insert({
          org_id: orgId,
          job_id: newJob.id,
          user_id: technicianId,
          sort_order: 1,
        })
      }

      onCreated()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3>{mode === 'job' ? 'New Job' : mode === 'property' ? 'New Property' : 'New Customer'}</h3>

        <form onSubmit={handleSubmit}>
          {(mode === 'property' || mode === 'job') && (
            <div className="field">
              <label>Customer</label>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <label style={{ fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" checked={customerMode === 'existing'} onChange={() => setCustomerMode('existing')} /> Existing
                </label>
                <label style={{ fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" checked={customerMode === 'new'} onChange={() => setCustomerMode('new')} /> New
                </label>
              </div>
            </div>
          )}

          {(mode === 'property' || mode === 'job') && customerMode === 'existing' && (
            <div className="field">
              <select value={existingCustomerId} onChange={(e) => setExistingCustomerId(e.target.value)} required>
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.is_banned ? '⚠️ DO NOT SERVICE — ' : ''}{c.display_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(mode === 'customer' || ((mode === 'property' || mode === 'job') && customerMode === 'new')) && (
            <>
              <div className="field">
                <label htmlFor="newCustName">Customer name</label>
                <input id="newCustName" type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="e.g. William Gaal" required />
              </div>
              <div className="field">
                <label htmlFor="newCustPhone">Phone</label>
                <input id="newCustPhone" type="tel" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="newCustEmail">Email</label>
                <input id="newCustEmail" type="email" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} />
              </div>
            </>
          )}

          {mode === 'job' && customerMode === 'existing' && customerProperties.length > 0 && (
            <div className="field">
              <label>Property</label>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <label style={{ fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" checked={propertyMode === 'existing'} onChange={() => setPropertyMode('existing')} /> Existing
                </label>
                <label style={{ fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" checked={propertyMode === 'new'} onChange={() => setPropertyMode('new')} /> New
                </label>
              </div>
            </div>
          )}

          {mode === 'job' && customerMode === 'existing' && propertyMode === 'existing' && (
            <div className="field">
              <select value={existingPropertyId} onChange={(e) => setExistingPropertyId(e.target.value)} required>
                <option value="">Select a property…</option>
                {customerProperties.map((p) => (
                  <option key={p.id} value={p.id}>{p.street_address}</option>
                ))}
              </select>
            </div>
          )}

          {(mode === 'property' || mode === 'job') && (customerMode === 'new' || propertyMode === 'new') && (
            <>
              <div className="field">
                <label htmlFor="newStreet">Street address</label>
                <input id="newStreet" type="text" value={newStreet} onChange={(e) => setNewStreet(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newUnit">Unit</label>
                  <input id="newUnit" type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 2 }}>
                  <label htmlFor="newCity">City</label>
                  <input id="newCity" type="text" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newState">State</label>
                  <input id="newState" type="text" value={newState} onChange={(e) => setNewState(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newZip">Zip</label>
                  <input id="newZip" type="text" value={newZip} onChange={(e) => setNewZip(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="newGateCode">Gate code</label>
                <input id="newGateCode" type="text" value={newGateCode} onChange={(e) => setNewGateCode(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newTenantName">Tenant (optional)</label>
                  <input id="newTenantName" type="text" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newTenantPhone">Tenant phone</label>
                  <input id="newTenantPhone" type="tel" value={newTenantPhone} onChange={(e) => setNewTenantPhone(e.target.value)} />
                </div>
              </div>
            </>
          )}
          {mode === 'job' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="jobDate">Date</label>
                  <input id="jobDate" type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)} required />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="startTime">Start time</label>
                  <input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="duration">Duration (hrs)</label>
                  <input id="duration" type="number" step="0.5" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} />
                </div>
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

              {selectedCustomerIsBanned && (
                <div className="auth-error">
                  <strong>This customer is flagged Do Not Service.</strong>
                  {canOverrideBan ? (
                    <label style={{ display: 'block', marginTop: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={overrideBan} onChange={(e) => setOverrideBan(e.target.checked)} style={{ marginRight: 6 }} />
                      I acknowledge this and want to schedule anyway
                    </label>
                  ) : (
                    <p style={{ margin: '8px 0 0' }}>Only an Admin at this company can schedule a job for this customer.</p>
                  )}
                </div>
              )}
            </>
          )}

          {error && <div className="auth-error">{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto', padding: '10px 24px' }}>
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button type="button" className="logout-button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
