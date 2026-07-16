import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import TripChargePicker from './TripChargePicker'
import CustomerSearchSelect from './CustomerSearchSelect'

export default function QuickAddModal({ mode, orgId, profile, onClose, onCreated }) {
  const navigate = useNavigate()
  const [customerProperties, setCustomerProperties] = useState([])
  const [users, setUsers] = useState([])
  const [jobTypes, setJobTypes] = useState([])
  const [allJobs, setAllJobs] = useState([])

  const [customerMode, setCustomerMode] = useState('existing')
  const [existingCustomerId, setExistingCustomerId] = useState('')
  const [existingCustomerBanned, setExistingCustomerBanned] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newSpouseName, setNewSpouseName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerPhone2, setNewCustomerPhone2] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [newCustomerEmail2, setNewCustomerEmail2] = useState('')
  const [newAcquireDate, setNewAcquireDate] = useState('')
  const [newCustomerNotes, setNewCustomerNotes] = useState('')

  const [propertyMode, setPropertyMode] = useState('existing')
  const [existingPropertyId, setExistingPropertyId] = useState('')
  const [existingTenantIds, setExistingTenantIds] = useState([null, null])
  const [newBillToCustomerId, setNewBillToCustomerId] = useState('')
  const [newStreet, setNewStreet] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newCounty, setNewCounty] = useState('')
  const [newState, setNewState] = useState('FL')
  const [newZip, setNewZip] = useState('')
  const [newGateCode, setNewGateCode] = useState('')
  const [newTenantName, setNewTenantName] = useState('')
  const [newTenantPhone, setNewTenantPhone] = useState('')
  const [newTenant2Name, setNewTenant2Name] = useState('')
  const [newTenant2Phone, setNewTenant2Phone] = useState('')
  const [newPropertyNotes, setNewPropertyNotes] = useState('')

  const [jobDate, setJobDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [durationHours, setDurationHours] = useState('1')
  const [jobType, setJobType] = useState('')
  const [serviceComplaint, setServiceComplaint] = useState('')
  const [technicianId, setTechnicianId] = useState('')
  const [technician2Id, setTechnician2Id] = useState('')
  const [technician3Id, setTechnician3Id] = useState('')
  const [technician4Id, setTechnician4Id] = useState('')
  const [tripChargeId, setTripChargeId] = useState(null)
  const [overrideBan, setOverrideBan] = useState(false)

  const [continueSearchText, setContinueSearchText] = useState('')
  const [selectedContinueJob, setSelectedContinueJob] = useState(null)
  const [contJobDate, setContJobDate] = useState('')
  const [contStartTime, setContStartTime] = useState('')
  const [contDuration, setContDuration] = useState('1')
  const [contJobType, setContJobType] = useState('')
  const [contComplaint, setContComplaint] = useState('')
  const [contTechnicianId, setContTechnicianId] = useState('')
  const [contTripChargeId, setContTripChargeId] = useState(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canOverrideBan = profile.role === 'super_admin' || profile.role === 'org_admin'
  const selectedCustomerIsBanned = customerMode === 'existing' ? existingCustomerBanned : false

  useEffect(() => {
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
    if (mode === 'continueJob') {
      supabase.from('users').select('id, full_name').eq('org_id', orgId).order('full_name').then(({ data }) => setUsers(data || []))
      supabase
        .from('job_types')
        .select('id, name')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('sort_order')
        .then(({ data }) => {
          setJobTypes(data || [])
          if (data && data.length > 0) setContJobType(data[0].name)
        })
      supabase
        .from('jobs')
        .select('id, job_number, segment, status, property_id, customer_id, trip_charge_price_id, properties(street_address, customers!properties_customer_id_fkey(display_name))')
        .eq('org_id', orgId)
        .then(({ data }) => setAllJobs(data || []))
    }
    if (mode === 'pickEstimateJob' || mode === 'pickInvoiceJob' || mode === 'pickSystemEstimateJob') {
      supabase
        .from('jobs')
        .select('id, job_number, segment, status, property_id, customer_id, trip_charge_price_id, properties(street_address, customers!properties_customer_id_fkey(display_name))')
        .eq('org_id', orgId)
        .then(({ data }) => setAllJobs(data || []))
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
          setExistingPropertyId('')
        })
    } else {
      setCustomerProperties([])
    }
  }, [existingCustomerId, customerMode, mode])

  // Dependent on the property, not just the customer: once a specific existing
  // property is picked, pull its current tenants so they auto-populate — editable,
  // not just read-only — rather than making the office re-type info that's already
  // on file.
  useEffect(() => {
    if (mode === 'job' && propertyMode === 'existing' && existingPropertyId) {
      supabase
        .from('property_tenants')
        .select('id, name, phone')
        .eq('property_id', existingPropertyId)
        .order('created_at')
        .then(({ data }) => {
          const tenants = data || []
          setExistingTenantIds([tenants[0]?.id || null, tenants[1]?.id || null])
          setNewTenantName(tenants[0]?.name || '')
          setNewTenantPhone(tenants[0]?.phone || '')
          setNewTenant2Name(tenants[1]?.name || '')
          setNewTenant2Phone(tenants[1]?.phone || '')
        })
    } else if (propertyMode !== 'existing') {
      setExistingTenantIds([null, null])
    }
  }, [existingPropertyId, propertyMode, mode])

  function jobNumberDisplay(job) {
    return job.job_number + (job.segment > 1 ? ' · Seg ' + job.segment : '')
  }

  const continueMatches = allJobs.filter((j) => {
    if (!continueSearchText) return false
    const q = continueSearchText.toLowerCase()
    return (
      j.job_number?.toLowerCase().includes(q) ||
      j.properties?.street_address?.toLowerCase().includes(q) ||
      j.properties?.customers?.display_name?.toLowerCase().includes(q)
    )
  }).slice(0, 8)

  function pickContinueJob(job) {
    setSelectedContinueJob(job)
    setContinueSearchText('')
    setContJobDate('')
    setContStartTime('')
    setContDuration('1')
    setContComplaint('')
    setContTechnicianId('')
    setContTripChargeId(job.trip_charge_price_id || null)
  }

  async function handleContinueSubmit(e) {
    e.preventDefault()
    setError('')
    if (!selectedContinueJob || !contJobDate) {
      setError('Please pick a date.')
      return
    }
    setSaving(true)

    const maxSegment = allJobs
      .filter((j) => j.job_number === selectedContinueJob.job_number)
      .reduce((max, j) => Math.max(max, j.segment || 1), 1)

    const startTimestamp = contStartTime ? new Date(`${contJobDate}T${contStartTime}:00`).toISOString() : null

    const { data: newSegmentJob, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        org_id: orgId,
        job_number: selectedContinueJob.job_number,
        segment: maxSegment + 1,
        property_id: selectedContinueJob.property_id,
        customer_id: selectedContinueJob.customer_id,
        job_date: contJobDate,
        start_time: startTimestamp,
        duration_hours: contDuration ? parseFloat(contDuration) : null,
        job_type: contJobType,
        service_complaint: contComplaint.trim() || null,
        trip_charge_price_id: contTripChargeId || null,
        status: 'scheduled',
      })
      .select()
      .single()

    if (jobErr) {
      setError(jobErr.message)
      setSaving(false)
      return
    }

    if (contTechnicianId) {
      await supabase.from('job_technicians').insert({
        org_id: orgId,
        job_id: newSegmentJob.id,
        user_id: contTechnicianId,
        sort_order: 1,
      })
    }

    setSaving(false)
    onCreated()
    onClose()
  }

  async function upsertTenant(propertyId, tenantId, name, phone) {
    if (tenantId) {
      if (name.trim()) {
        await supabase.from('property_tenants').update({ name: name.trim(), phone: phone.trim() || null }).eq('id', tenantId)
      }
    } else if (name.trim()) {
      await supabase.from('property_tenants').insert({
        org_id: orgId,
        property_id: propertyId,
        name: name.trim(),
        phone: phone.trim() || null,
      })
    }
  }

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
        customerIsBanned = existingCustomerBanned
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
            company: newCompany.trim() || null,
            first_name: newFirstName.trim() || null,
            last_name: newLastName.trim() || null,
            spouse_name: newSpouseName.trim() || null,
            primary_phone: newCustomerPhone.trim() || null,
            secondary_phone: newCustomerPhone2.trim() || null,
            email_1: newCustomerEmail.trim() || null,
            email_2: newCustomerEmail2.trim() || null,
            acquire_date: newAcquireDate || null,
            notes: newCustomerNotes.trim() || null,
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
            bill_to_customer_id: newBillToCustomerId || null,
            street_address: newStreet.trim(),
            unit: newUnit.trim() || null,
            city: newCity.trim() || null,
            county: newCounty.trim() || null,
            state: newState.trim() || null,
            zip: newZip.trim() || null,
            gate_code: newGateCode.trim() || null,
            notes: newPropertyNotes.trim() || null,
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
        if (newTenant2Name.trim()) {
          await supabase.from('property_tenants').insert({
            org_id: orgId,
            property_id: propertyId,
            name: newTenant2Name.trim(),
            phone: newTenant2Phone.trim() || null,
          })
        }
      } else {
        if (!existingPropertyId) throw new Error('Please select a property.')
        // Persist any tenant edits made against the existing property (or add
        // tenants that weren't on file before) rather than silently discarding them.
        await upsertTenant(propertyId, existingTenantIds[0], newTenantName, newTenantPhone)
        await upsertTenant(propertyId, existingTenantIds[1], newTenant2Name, newTenant2Phone)
      }

      if (mode === 'property') {
        onCreated()
        onClose()
        return
      }

      if (!jobDate) throw new Error('Job date is required.')

      const { count } = await supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
      const jobNumber = `J-${String((count || 0) + 1).padStart(4, '0')}`
      const startTimestamp = startTime ? new Date(`${jobDate}T${startTime}:00`).toISOString() : null

      const { data: newJob, error: jobErr } = await supabase
        .from('jobs')
        .insert({
          org_id: orgId,
          job_number: jobNumber,
          segment: 1,
          property_id: propertyId,
          customer_id: customerId,
          job_date: jobDate,
          start_time: startTimestamp,
          duration_hours: durationHours ? parseFloat(durationHours) : null,
          job_type: jobType,
          service_complaint: serviceComplaint.trim() || null,
          trip_charge_price_id: tripChargeId || null,
        })
        .select()
        .single()
      if (jobErr) throw jobErr

      const techIds = [technicianId, technician2Id, technician3Id, technician4Id].filter(Boolean)
      if (techIds.length > 0) {
        await supabase.from('job_technicians').insert(
          techIds.map((userId, idx) => ({
            org_id: orgId,
            job_id: newJob.id,
            user_id: userId,
            sort_order: idx + 1,
          }))
        )
      }

      onCreated()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (mode === 'pickEstimateJob' || mode === 'pickInvoiceJob' || mode === 'pickSystemEstimateJob') {
    const target = mode === 'pickEstimateJob' ? 'estimate' : mode === 'pickSystemEstimateJob' ? 'system-estimate' : 'invoice'
    const label = mode === 'pickEstimateJob' ? 'New Estimate' : mode === 'pickSystemEstimateJob' ? 'New System Estimate' : 'New Invoice'
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
          <h3>{label} — Pick a Job</h3>
          <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
            Search for the job this {target} is for.
          </p>
          <input
            type="text"
            value={continueSearchText}
            onChange={(e) => setContinueSearchText(e.target.value)}
            placeholder="Search by Job #, address, or customer…"
            style={{ width: '100%', padding: '8px 10px', background: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--paper)', boxSizing: 'border-box', marginBottom: 8 }}
          />
          {continueMatches.map((j) => (
            <div
              key={j.id}
              onClick={() => { navigate(`/${target}/${j.id}`); onClose() }}
              style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 14 }}
            >
              <strong>{jobNumberDisplay(j)}</strong> — {j.properties?.street_address} — <span className={`status-pill status-${j.status}`} style={{ marginLeft: 4 }}>{j.status}</span>
            </div>
          ))}
          {continueSearchText && continueMatches.length === 0 && (
            <p style={{ color: 'var(--mist)', fontSize: 13 }}>No matching jobs found.</p>
          )}
          <div style={{ marginTop: 16 }}>
            <button type="button" className="logout-button" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'continueJob') {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
          <h3>Continue an Existing Job</h3>
          {!selectedContinueJob ? (
            <>
              <input
                type="text"
                value={continueSearchText}
                onChange={(e) => setContinueSearchText(e.target.value)}
                placeholder="Search by Job #, address, or customer…"
                style={{ width: '100%', padding: '8px 10px', background: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--paper)', boxSizing: 'border-box', marginBottom: 8 }}
              />
              {continueMatches.map((j) => (
                <div
                  key={j.id}
                  onClick={() => pickContinueJob(j)}
                  style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 14 }}
                >
                  <strong>{jobNumberDisplay(j)}</strong> — {j.properties?.street_address} — <span className={`status-pill status-${j.status}`} style={{ marginLeft: 4 }}>{j.status}</span>
                </div>
              ))}
              {continueSearchText && continueMatches.length === 0 && (
                <p style={{ color: 'var(--mist)', fontSize: 13 }}>No matching jobs found.</p>
              )}
              <div style={{ marginTop: 16 }}>
                <button type="button" className="logout-button" onClick={onClose}>Cancel</button>
              </div>
            </>
          ) : (
            <form onSubmit={handleContinueSubmit}>
              <p style={{ fontSize: 14, marginBottom: 4 }}>
                Continuing <strong>{selectedContinueJob.job_number}</strong> at {selectedContinueJob.properties?.street_address}
              </p>
              <button
                type="button"
                className="logout-button"
                style={{ marginBottom: 12 }}
                onClick={() => setSelectedContinueJob(null)}
              >
                Choose a different job
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="contDate">Date</label>
                  <input id="contDate" type="date" value={contJobDate} onChange={(e) => setContJobDate(e.target.value)} required />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="contStart">Start time</label>
                  <input id="contStart" type="time" value={contStartTime} onChange={(e) => setContStartTime(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="contDuration">Duration (hrs)</label>
                  <input id="contDuration" type="number" step="0.5" value={contDuration} onChange={(e) => setContDuration(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="contType">Type</label>
                <select id="contType" value={contJobType} onChange={(e) => setContJobType(e.target.value)}>
                  {jobTypes.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="contComplaint">What's happening this visit</label>
                <input id="contComplaint" type="text" value={contComplaint} onChange={(e) => setContComplaint(e.target.value)} placeholder="e.g. Install ordered part" />
              </div>
              <div className="field">
                <label htmlFor="contTech">Technician</label>
                <select id="contTech" value={contTechnicianId} onChange={(e) => setContTechnicianId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Trip charge for this visit</label>
                <TripChargePicker orgId={orgId} value={contTripChargeId} onChange={setContTripChargeId} />
              </div>

              {error && <div className="auth-error">{error}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto', padding: '10px 24px' }}>
                  {saving ? 'Creating…' : 'Add Segment'}
                </button>
                <button type="button" className="logout-button" onClick={onClose}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>
    )
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
              <label>Select a customer</label>
              <CustomerSearchSelect
                orgId={orgId}
                value={existingCustomerId}
                onChange={(id, customer) => {
                  setExistingCustomerId(id)
                  setExistingCustomerBanned(customer?.is_banned || false)
                }}
              />
            </div>
          )}

          {(mode === 'customer' || ((mode === 'property' || mode === 'job') && customerMode === 'new')) && (
            <>
              <div className="field">
                <label htmlFor="newCustName">Display Name</label>
                <input id="newCustName" type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="e.g. William Gaal" required />
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button
                    type="button"
                    className="logout-button"
                    style={{ fontSize: 12, padding: '2px 8px' }}
                    onClick={() => setNewCustomerName((newFirstName + ' ' + newLastName).trim())}
                    disabled={!newFirstName.trim() && !newLastName.trim()}
                  >
                    Use First + Last
                  </button>
                  <button
                    type="button"
                    className="logout-button"
                    style={{ fontSize: 12, padding: '2px 8px' }}
                    onClick={() => setNewCustomerName(newCompany.trim())}
                    disabled={!newCompany.trim()}
                  >
                    Use Company
                  </button>
                </div>
              </div>
              <div className="field">
                <label htmlFor="newCustCompany">Company</label>
                <input id="newCustCompany" type="text" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="optional" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newFirstName">First Name</label>
                  <input id="newFirstName" type="text" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="optional" />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newLastName">Last Name</label>
                  <input id="newLastName" type="text" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="optional" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="newSpouseName">Spouse Name</label>
                <input id="newSpouseName" type="text" value={newSpouseName} onChange={(e) => setNewSpouseName(e.target.value)} placeholder="optional" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newCustPhone">Phone</label>
                  <input id="newCustPhone" type="tel" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newCustPhone2">Phone 2</label>
                  <input id="newCustPhone2" type="tel" value={newCustomerPhone2} onChange={(e) => setNewCustomerPhone2(e.target.value)} placeholder="optional" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newCustEmail">Email</label>
                  <input id="newCustEmail" type="email" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newCustEmail2">Email 2</label>
                  <input id="newCustEmail2" type="email" value={newCustomerEmail2} onChange={(e) => setNewCustomerEmail2(e.target.value)} placeholder="optional" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="newAcquireDate">Acquire Date</label>
                <input id="newAcquireDate" type="date" value={newAcquireDate} onChange={(e) => setNewAcquireDate(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="newCustNotes">Notes</label>
                <input id="newCustNotes" type="text" value={newCustomerNotes} onChange={(e) => setNewCustomerNotes(e.target.value)} placeholder="optional" />
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

          {mode === 'job' && customerMode === 'existing' && propertyMode === 'existing' && existingPropertyId && (
            <>
              <p style={{ fontSize: 12, color: 'var(--mist)', margin: '4px 0' }}>
                Tenants on file at this property — edit if anything's changed, or fill in if blank
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="existTenant1Name">Tenant 1</label>
                  <input id="existTenant1Name" type="text" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="existTenant1Phone">Tenant 1 phone</label>
                  <input id="existTenant1Phone" type="tel" value={newTenantPhone} onChange={(e) => setNewTenantPhone(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="existTenant2Name">Tenant 2</label>
                  <input id="existTenant2Name" type="text" value={newTenant2Name} onChange={(e) => setNewTenant2Name(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="existTenant2Phone">Tenant 2 phone</label>
                  <input id="existTenant2Phone" type="tel" value={newTenant2Phone} onChange={(e) => setNewTenant2Phone(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {(mode === 'property' || mode === 'job') && (customerMode === 'new' || propertyMode === 'new') && (
            <>
              <div className="field">
                <label htmlFor="newBillTo">Bill To Customer</label>
                <CustomerSearchSelect
                  orgId={orgId}
                  value={newBillToCustomerId}
                  onChange={(id) => setNewBillToCustomerId(id)}
                  placeholder="Same as Customer — type to override"
                />
                {newBillToCustomerId && (
                  <button
                    type="button"
                    className="logout-button"
                    style={{ fontSize: 11, padding: '2px 8px', marginTop: 4 }}
                    onClick={() => setNewBillToCustomerId('')}
                  >
                    Clear (use same as Customer)
                  </button>
                )}
              </div>
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
                <label htmlFor="newCounty">County</label>
                <input id="newCounty" type="text" value={newCounty} onChange={(e) => setNewCounty(e.target.value)} placeholder="optional" />
              </div>
              <div className="field">
                <label htmlFor="newGateCode">Gate code</label>
                <input id="newGateCode" type="text" value={newGateCode} onChange={(e) => setNewGateCode(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newTenantName">Tenant 1 (optional)</label>
                  <input id="newTenantName" type="text" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newTenantPhone">Tenant 1 phone</label>
                  <input id="newTenantPhone" type="tel" value={newTenantPhone} onChange={(e) => setNewTenantPhone(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newTenant2Name">Tenant 2 (optional)</label>
                  <input id="newTenant2Name" type="text" value={newTenant2Name} onChange={(e) => setNewTenant2Name(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="newTenant2Phone">Tenant 2 phone</label>
                  <input id="newTenant2Phone" type="tel" value={newTenant2Phone} onChange={(e) => setNewTenant2Phone(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="newPropNotes">Notes</label>
                <input id="newPropNotes" type="text" value={newPropertyNotes} onChange={(e) => setNewPropertyNotes(e.target.value)} placeholder="optional" />
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
                <label htmlFor="complaint">Issue</label>
                <input id="complaint" type="text" value={serviceComplaint} onChange={(e) => setServiceComplaint(e.target.value)} placeholder="e.g. No cooling, or notes for a System Estimate visit" />
              </div>
              {[
                { label: 'Technician 1', value: technicianId, set: setTechnicianId },
                { label: 'Technician 2', value: technician2Id, set: setTechnician2Id },
                { label: 'Technician 3', value: technician3Id, set: setTechnician3Id },
                { label: 'Technician 4', value: technician4Id, set: setTechnician4Id },
              ].map((slot, idx) => {
                const chosen = [technicianId, technician2Id, technician3Id, technician4Id].filter(Boolean)
                const availableUsers = users.filter((u) => u.id === slot.value || !chosen.includes(u.id))
                return (
                  <div className="field" key={slot.label}>
                    <label htmlFor={`tech${idx + 1}`}>{slot.label}</label>
                    <select id={`tech${idx + 1}`} value={slot.value} onChange={(e) => slot.set(e.target.value)}>
                      <option value="">Unassigned</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
              <div className="field">
                <label>Trip charge (sets Location/Access/Time for this job)</label>
                <TripChargePicker orgId={orgId} value={tripChargeId} onChange={setTripChargeId} />
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
