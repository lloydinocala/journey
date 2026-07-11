import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'
import TripChargePicker from './TripChargePicker'
import { exportToCSV } from './utils/csvExport'

const COLUMNS = [
  { key: 'job_number', label: 'Job #', required: true },
  { key: 'job_date', label: 'Date' },
  { key: 'address', label: 'Address' },
  { key: 'trip_charge', label: 'Trip Charge' },
  { key: 'job_type', label: 'Type' },
  { key: 'service_complaint', label: 'Complaint' },
  { key: 'technicians', label: 'Technicians' },
  { key: 'status', label: 'Status' },
]

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'on_my_way', label: 'On my way' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'incomplete', label: 'Incomplete — needs another visit' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
]

export default function Jobs({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [properties, setProperties] = useState([])
  const [users, setUsers] = useState([])
  const [jobs, setJobs] = useState([])
  const [jobTypes, setJobTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newItemMode, setNewItemMode] = useState(null)

  const [addMode, setAddMode] = useState('new')

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

  const [continueSearchText, setContinueSearchText] = useState('')
  const [selectedContinueJob, setSelectedContinueJob] = useState(null)
  const [contJobDate, setContJobDate] = useState('')
  const [contStartTime, setContStartTime] = useState('')
  const [contDuration, setContDuration] = useState('1')
  const [contJobType, setContJobType] = useState('')
  const [contComplaint, setContComplaint] = useState('')
  const [contTechnicianId, setContTechnicianId] = useState('')
  const [contTripChargeId, setContTripChargeId] = useState(null)

  const [statusFilter, setStatusFilter] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('job_date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('jobs_visible_columns')
    return saved ? JSON.parse(saved) : COLUMNS.map((c) => c.key)
  })

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
        .select('id, job_number, segment, status, job_date, start_time, duration_hours, job_type, service_complaint, property_id, customer_id, trip_charge_price_id, properties(street_address), job_technicians(sort_order, users(full_name)), trip_charge:trip_charge_price_id(location, access, hours, services(name))')
        .eq('org_id', orgId)
        .order('job_date', { ascending: false }),
      supabase.from('job_types').select('id, name').eq('org_id', orgId).eq('is_active', true).order('sort_order'),
    ])
    setProperties(propsRes.data || [])
    setUsers(usersRes.data || [])
    setJobs(jobsRes.data || [])
    setJobTypes(jobTypesRes.data || [])
    if (jobTypesRes.data && jobTypesRes.data.length > 0) {
      setJobType(jobTypesRes.data[0].name)
      setContJobType(jobTypesRes.data[0].name)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData(selectedOrg)
  }, [selectedOrg])

  useEffect(() => {
    localStorage.setItem('jobs_visible_columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  function toggleColumn(key) {
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function toggleSort(field) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  function sortArrow(field) {
    if (sortField !== field) return ''
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
  }

  const selectedProperty = properties.find((p) => p.id === propertyId)
  const isBannedSelected = selectedProperty?.customers?.is_banned

  function techNames(job) {
    const list = (job.job_technicians || []).slice().sort((a, b) => a.sort_order - b.sort_order)
    if (list.length === 0) return 'Unassigned'
    return list.map((t) => t.users?.full_name).join(', ')
  }

  function jobNumberDisplay(job) {
    return job.job_number + (job.segment > 1 ? ' · Seg ' + job.segment : '')
  }

  function tripChargeSummary(job) {
    if (!job.trip_charge) return ''
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
        segment: 1,
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

  const continueMatches = jobs.filter((j) => {
    if (!continueSearchText) return false
    const q = continueSearchText.toLowerCase()
    return (
      j.job_number?.toLowerCase().includes(q) ||
      j.properties?.street_address?.toLowerCase().includes(q) ||
      properties.find((p) => p.id === j.property_id)?.customers?.display_name?.toLowerCase().includes(q)
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

  async function handleContinueJob(e) {
    e.preventDefault()
    setError('')
    if (!selectedContinueJob || !contJobDate) return

    setSaving(true)

    const maxSegment = jobs
      .filter((j) => j.job_number === selectedContinueJob.job_number)
      .reduce((max, j) => Math.max(max, j.segment || 1), 1)

    const startTimestamp = contStartTime ? `${contJobDate}T${contStartTime}:00` : null

    const { data: newSegmentJob, error } = await supabase
      .from('jobs')
      .insert({
        org_id: selectedOrg,
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

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    if (contTechnicianId) {
      await supabase.from('job_technicians').insert({
        org_id: selectedOrg,
        job_id: newSegmentJob.id,
        user_id: contTechnicianId,
        sort_order: 1,
      })
    }

    setSaving(false)
    setSelectedContinueJob(null)
    setContJobDate('')
    setContStartTime('')
    setContDuration('1')
    setContComplaint('')
    setContTechnicianId('')
    setContTripChargeId(null)
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

  const filtered = jobs.filter((j) => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return (
      j.job_number?.toLowerCase().includes(q) ||
      j.properties?.street_address?.toLowerCase().includes(q) ||
      j.service_complaint?.toLowerCase().includes(q) ||
      techNames(j).toLowerCase().includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal
    if (sortField === 'address') {
      aVal = a.properties?.street_address || ''
      bVal = b.properties?.street_address || ''
    } else {
      aVal = a[sortField] || ''
      bVal = b[sortField] || ''
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  function handleExport() {
    exportToCSV(
      sorted,
      [
        { label: 'Job #', value: jobNumberDisplay },
        { key: 'job_date', label: 'Date' },
        { label: 'Address', value: (j) => j.properties?.street_address || '' },
        { label: 'Trip Charge', value: tripChargeSummary },
        { key: 'job_type', label: 'Type' },
        { key: 'service_complaint', label: 'Complaint' },
        { label: 'Technicians', value: techNames },
        { key: 'status', label: 'Status' },
      ],
      'jobs-' + new Date().toISOString().slice(0, 10) + '.csv'
    )
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={addMode === 'new' ? 'auth-button' : 'logout-button'}
          style={{ width: 'auto', padding: '8px 20px' }}
          onClick={() => { setAddMode('new'); setSelectedContinueJob(null) }}
        >
          New Job
        </button>
        <button
          className={addMode === 'continue' ? 'auth-button' : 'logout-button'}
          style={{ width: 'auto', padding: '8px 20px' }}
          onClick={() => setAddMode('continue')}
        >
          Continue an Existing Job
        </button>
      </div>

      {addMode === 'new' ? (
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
          </div>

          <div style={{ marginTop: 4 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Trip charge (sets Location/Access/Time for this job)</label>
            <TripChargePicker orgId={selectedOrg} value={newTripChargeId} onChange={setNewTripChargeId} />
          </div>

          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto', alignSelf: 'flex-start' }}>
            {saving ? 'Adding…' : 'Add job'}
          </button>
        </form>
      ) : (
        <div className="auth-card" style={{ maxWidth: 600, marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Find the job to continue</h3>
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
            </>
          ) : (
            <form onSubmit={handleContinueJob}>
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
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="field">
                  <label htmlFor="contDate">Date</label>
                  <input id="contDate" type="date" value={contJobDate} onChange={(e) => setContJobDate(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="contStart">Start time</label>
                  <input id="contStart" type="time" value={contStartTime} onChange={(e) => setContStartTime(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="contDuration">Duration (hrs)</label>
                  <input id="contDuration" type="number" step="0.5" value={contDuration} onChange={(e) => setContDuration(e.target.value)} style={{ width: 80 }} />
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
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Trip charge for this visit</label>
                <TripChargePicker orgId={selectedOrg} value={contTripChargeId} onChange={setContTripChargeId} />
              </div>
              <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto', marginTop: 12 }}>
                {saving ? 'Adding…' : 'Add Segment'}
              </button>
            </form>
          )}
        </div>
      )}

      {isBannedSelected && addMode === 'new' && (
        <div className="auth-error" style={{ marginBottom: 20 }}>
          <strong>This customer is flagged Do Not Service.</strong>
          {canOverrideBan ? (
            <label style={{ display: 'block', marginTop: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={overrideBan}
                onChange={(e) => setOverrideBan(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              I acknowledge this and want to schedule anyway
            </label>
          ) : (
            <p style={{ margin: '8px 0 0' }}>Only an Admin at this company can schedule a job for this customer.</p>
          )}
        </div>
      )}

      {error && <div className="auth-error">{error}</div>}
<div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
          <label htmlFor="statusFilter">Status</label>
          <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label htmlFor="searchBox">Search</label>
          <input
            id="searchBox"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Job #, address, complaint, tech…"
          />
        </div>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <button className="logout-button" onClick={() => setShowColumnPicker(!showColumnPicker)}>
            Columns ▾
          </button>
          {showColumnPicker && (
            <div className="org-picker-list" style={{ right: 0, left: 'auto', minWidth: 180 }}>
              {COLUMNS.filter((c) => !c.required).map((col) => (
                <label key={col.key} className="org-picker-item" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <button className="logout-button" style={{ marginBottom: 10 }} onClick={handleExport}>
          Export CSV
        </button>
        <p style={{ color: 'var(--mist)', fontSize: 14, margin: '0 0 12px' }}>
          {sorted.length} job{sorted.length !== 1 ? 's' : ''}
        </p>
      </div>
{loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div className="grid-table" style={{ gridTemplateColumns: '0.9fr 1fr 1.3fr 1.5fr 1fr 1.3fr 1.4fr 1fr 1.2fr' }}>
          <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('job_number')}>Job #{sortArrow('job_number')}</div>
          {visibleColumns.includes('job_date') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('job_date')}>Date{sortArrow('job_date')}</div>
          )}
          {visibleColumns.includes('address') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('address')}>Address{sortArrow('address')}</div>
          )}
          {visibleColumns.includes('trip_charge') && <div className="grid-cell grid-head">Trip Charge</div>}
          {visibleColumns.includes('job_type') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('job_type')}>Type{sortArrow('job_type')}</div>
          )}
          {visibleColumns.includes('service_complaint') && <div className="grid-cell grid-head">Complaint</div>}
          {visibleColumns.includes('technicians') && <div className="grid-cell grid-head">Technicians</div>}
          {visibleColumns.includes('status') && (
            <div className="grid-cell grid-head" style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>Status{sortArrow('status')}</div>
          )}
          <div className="grid-cell grid-head"></div>

          {sorted.map((j) =>
            editingId === j.id ? (
              <>
                <div className="grid-cell">{jobNumberDisplay(j)}</div>
                {visibleColumns.includes('job_date') && (
                  <div className="grid-cell">
                    <input type="date" value={editJobDate} onChange={(e) => setEditJobDate(e.target.value)} />
                    <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
                  </div>
                )}
                {visibleColumns.includes('address') && (
                  <div className="grid-cell">
                    <select value={editPropertyId} onChange={(e) => setEditPropertyId(e.target.value)}>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.customers?.is_banned ? '⚠️ ' : ''}{p.street_address} — {p.customers?.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {visibleColumns.includes('trip_charge') && (
                  <div className="grid-cell">
                    <TripChargePicker orgId={selectedOrg} value={editTripChargeId} onChange={setEditTripChargeId} />
                  </div>
                )}
                {visibleColumns.includes('job_type') && (
                  <div className="grid-cell">
                    <select value={editJobType} onChange={(e) => setEditJobType(e.target.value)}>
                      {jobTypes.map((t) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {visibleColumns.includes('service_complaint') && (
                  <div className="grid-cell">
                    <input type="text" value={editComplaint} onChange={(e) => setEditComplaint(e.target.value)} />
                  </div>
                )}
                {visibleColumns.includes('technicians') && (
                  <div className="grid-cell">
                    {editTechnicians.map((t, idx) => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span>{idx === 0 ? '★ ' : ''}{t.users?.full_name}</span>
                        <button
                          type="button"
                          onClick={() => removeTechnicianFromJob(t.id, j.id)}
                          style={{ background: 'none', border: 'none', color: '#C0392B', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 4px' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  <select
                      value=""
                      onChange={(e) => { if (e.target.value) addTechnicianToJob(j.id, e.target.value) }}
                      style={{ width: '100%', fontSize: 12, marginTop: 4 }}
                    >
                      <option value="">+ Add a technician…</option>
                      {users
                        .filter((u) => !editTechnicians.some((t) => t.user_id === u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                    </select>
                  </div>
                )}
                {visibleColumns.includes('status') && (
                  <div className="grid-cell">
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid-cell grid-actions">
                  <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(j.id)}>Save</button>
                  <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="grid-cell">{jobNumberDisplay(j)}</div>
                {visibleColumns.includes('job_date') && <div className="grid-cell">{j.job_date}</div>}
                {visibleColumns.includes('address') && <div className="grid-cell">{j.properties?.street_address || '—'}</div>}
                {visibleColumns.includes('trip_charge') && <div className="grid-cell" style={{ fontSize: 12 }}>{tripChargeSummary(j)}</div>}
                {visibleColumns.includes('job_type') && <div className="grid-cell">{j.job_type}</div>}
                {visibleColumns.includes('service_complaint') && <div className="grid-cell">{j.service_complaint || '—'}</div>}
                {visibleColumns.includes('technicians') && <div className="grid-cell">{techNames(j)}</div>}
                {visibleColumns.includes('status') && (
                  <div className="grid-cell"><span className={`status-pill status-${j.status}`}>{j.status}</span></div>
                )}
                <div className="grid-cell grid-actions">
                  <button className="logout-button" onClick={() => startEdit(j)}>Edit</button>
                  <Link to={`/invoice/${j.id}`} className="logout-button" style={{ textDecoration: 'none', display: 'inline-block' }}>Invoice</Link>
                  <Link to={`/estimate/${j.id}`} className="logout-button" style={{ textDecoration: 'none', display: 'inline-block' }}>Estimate</Link>
                </div>
              </>
            )
          )}
          {sorted.length === 0 && (
            <div className="grid-cell" style={{ gridColumn: '1 / -1', color: 'var(--mist)' }}>No jobs yet.</div>
          )}
        </div>
      )}

      {newItemMode && (
        <QuickAddModal
          mode={newItemMode}
          orgId={selectedOrg}
          profile={profile}
          onClose={() => setNewItemMode(null)}
          onCreated={() => loadData(selectedOrg)}
        />
      )}
    </div>
  )
}
