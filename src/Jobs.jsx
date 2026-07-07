import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

export default function Jobs({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [properties, setProperties] = useState([])
  const [users, setUsers] = useState([])
  const [jobs, setJobs] = useState([])
  const [jobTypes, setJobTypes] = useState([])
  const [loading, setLoading] = useState(true)

  const [propertyId, setPropertyId] = useState('')
  const [jobDate, setJobDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [durationHours, setDurationHours] = useState('1')
  const [jobType, setJobType] = useState('')
  const [serviceComplaint, setServiceComplaint] = useState('')
  const [technicianId, setTechnicianId] = useState('')
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
        .select('id, job_number, status, job_date, start_time, duration_hours, job_type, service_complaint, property_id, properties(street_address), job_technicians(sort_order, users(full_name))')
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
    setAddTechChoice('')
    loadTechniciansForJob(j.id)
  }

  async function addTechnicianToJob(jobId) {
    if (!addTechChoice) return
    const nextSort = editTechnicians.length > 0 ? Math.max(...editTechnicians.map((t) => t.sort_order)) + 1 : 1
    await supabase.from('job_technicians').insert({
      org_id: selectedOrg,
      job_id: jobId,
      user_id: addTechChoice,
      sort_order: nextSort,
    })
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
      })
      .eq('id', id)
    setEditingId(null)
    loadData(selectedOrg)
  }

  return (
