import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import TripChargePicker from './TripChargePicker'

export default function Jobs({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [properties, setProperties] = useState([])
  const [users, setUsers] = useState([])
  const [jobs, setJobs] = useState([])
  const [jobTypes, setJobTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newItemMode, setNewItemMode] = useState(null)

  const [propertyId, setPropertyId] = useState('')
  const [jobDate, setJobDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [durationHours, setDurationHours] = useState('1')
  const [jobType, setJobType] = useState('')
  const [serviceComplaint, setServiceComplaint] = useState('')
  const [technicianId, setTechnicianId] = useState('')
  const [newTripChargeId, setNewTripChargeId] = useState(null)
  const [overrideBan, setOverrideBan] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editPropertyId, setEditPropertyId] = useState('')
  const [editJobDate, setEditJobDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editJobType, setEditJobType] = useState('')
  const [editComplaint, setEditComplaint] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editTripChargeId, setEditTripChargeId] = useState(null)
  const [editTechnicians, setEditTechnicians] = useState([])
  const [addTechChoice, setAddTechChoice] = useState('')

  const isSuperAdmin = profile.role === 'super_admin'
  const canOverrideBan = profile.role === 'super_admin' || profile.role === 'org_admin'

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
        .select('id, street_address, customer_id, customers!properties_customer_id_fkey(display_name, is_banned)')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('street_address'),
      supabase.from('users').select('id, full_name').eq('org_id', orgId).order('full_name'),
      supabase
        .from('jobs')
        .select('id, job_number, status, job_date, start_time, duration_hours, job_type, service_complaint, property_id, trip_charge_price_id, properties(street_address), job_technicians(sort_order, users(full_name)), trip_charge:trip_charge_price_id(location, access, hours, services(name))')
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

  const selectedProperty = properties.find((p) => p.id === propertyId)
  const isBannedSelected = selectedProperty?.customers?.is_banned

  function techNames(job) {
    const list = (job.job_technicians || []).slice().sort((a, b) => a.sort_order - b.sort_order)
    if (list.length === 0) return 'Unassigned'
    return list.map((t) => t.users?.full_name).join(', ')
  }

  function tripChargeSummary(job) {
    if (!job.trip_charge) return '—'
    const tc = job.trip_charge
    const abbrev = (s) => (s ? s.replace('Standard', 'Std').replace('Difficult', 'Diff').replace('Extended', 'Ext').replace(' Access', '').replace(' Hours', '').replace(' Level', '').replace('Attic or Ceiling', 'Attic').replace('Roof or Sub-Level', 'Roof') : '')
    return `${tc.services?.name || ''} — ${abbrev(tc.location)}/${abbrev(tc.access)}/${abbrev(tc.hours)}`
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!propertyId || !jobDate) return

    if (isBannedSelected && (!canOverrideBan || !overrideBan)) {
      setError(
        canOverrideBan
          ? 'This customer is flagged Do Not Service. Check the override box to proceed.'
          : 'This customer is flagged Do Not Service. An admin must schedule this job.'
      )
      return
    }

    setSaving(true)

    const property = properties.find((p) => p.id === propertyId)

    const { count } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', selectedOrg)

    const jobNumber = `J-${String((count || 0) + 1).padStart(4, '0')}`

    const startTimestamp = startTime ? `${jobDate}T${startTime}:00` : null

    const { data: newJob, error } = await supabase
      .from('jobs')
      .insert({
        org_id: selectedOrg,
        job_number: jobNumber,
        property_id: propertyId,
        customer_id: property.customer_id,
        job_date: jobDate,
        start_time: startTimestamp,
        duration_hours: durationHours ? parseFloat(durationHours) : null,
        job_type: jobType,
        service_complaint: serviceComplaint.trim() || null,
        trip_charge_price_id: newTripChargeId || null,
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    if (technicianId) {
      await supabase.from('job_technicians').insert({
        org_id: selectedOrg,
        job_id: newJob.id,
        user_id: technicianId,
        sort_order: 1,
      })
    }

    setSaving(false)
    setPropertyId('')
    setJobDate('')
    setStartTime('')
    setDurationHours('1')
    setServiceComplaint('')
    setTechnicianId('')
    setNewTripChargeId(null)
    setOverrideBan(false)
    loadData(selectedOrg)
  }

  async function loadTechniciansForJob(jobId) {
    const { data } = await supabase
      .from('job_technicians')
      .select('id, sort_order, user_id, users(full_name)')
      .eq('job_id', jobId)
      .order('sort_order')
    setEditTechnicians(data || [])
  }

  function startEdit(j) {
    setEditingId(j.id)
    setEditPropertyId(j.property_id)
    setEditJobDate(j.job_date || '')
    setEditStartTime(j.start_time ? j.start_time.slice(11, 16) : '')
    setEditDuration(j.duration_hours != null ? String(j.duration_hours) : '')
    setEditJobType(j.job_type || '')
    setEditComplaint(j.service_complaint || '')
    setEditStatus(j.status)
    setEditTripChargeId(j.trip_charge_price_id || null)
    setAddTechChoice('')
    loadTechniciansForJob(j.id)
  }

  async function addTechnicianToJob(jobId) {
    if (!addTechChoice) return
    setError('')
    const nextSort = editTechnicians.length > 0 ? Math.max(...editTechnicians.map((t) => t.sort_order)) + 1 : 1
    const { error } = await supabase.from('job_technicians').insert({
      org_id: selectedOrg,
      job_id: jobId,
      user_id: addTechChoice,
      sort_order: nextSort,
    })
    if (error) {
      setError(error.message)
      return
    }
    setAddTechChoice('')
    loadTechniciansForJob(jobId)
  }

  async function removeTechnicianFromJob(rowId, jobId) {
    await supabase.from('job_technicians').delete().eq('id', rowId)
    loadTechniciansForJob(jobId)
  }

  async function saveEdit(id) {
    const startTimestamp = editStartTime ? `${editJobDate}T${editStartTime}:00` : null
    const editProperty = properties.find((p) => p.id === editPropertyId)
    await supabase
      .from('jobs')
      .update({
        property_id: editPropertyId,
        customer_id: editProperty ? editProperty.customer_id : undefined,
        job_date: editJobDate,
        start_time: startTimestamp,
        duration_hours: editDuration ? parseFloat(editDuration) : null,
        job_type: editJobType,
        service_complaint: editComplaint.trim() || null,
        status: editStatus,
        trip_charge_price_id: editTripChargeId || null,
      })
      .eq('id', id)
    setEditingId(null)
    loadData(selectedOrg)
  }

  return (
<div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Jobs</h2>
        <NewItemDropdown onSelect={setNewItemMode} />
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 20, flexWrap: 'wrap', flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="field">
            <label htmlFor="propPick">Property</label>
            <select id="propPick" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required>
              <option value="">Select…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.customers?.is_banned ? '⚠️ DO NOT SERVICE — ' : ''}{p.street_address} — {p.customers?.display_name}
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
            <input id="complaint" type="text" value={serviceComplaint} onChange={(e)
