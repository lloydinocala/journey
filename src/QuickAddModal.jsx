import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

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
