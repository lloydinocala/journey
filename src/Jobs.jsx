import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import NewItemDropdown from './NewItemDropdown'
import QuickAddModal from './QuickAddModal'

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

      <form className="inline-form" onSubmit={handleAdd} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
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
        <button className="auth-button" type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add job'}
        </button>
      </form>

      {isBannedSelected && (
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

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div className="grid-table" style={{ gridTemplateColumns: '0.8fr 1fr 1.3fr 1fr 1.3fr 1.4fr 0.9fr 1.2fr' }}>
          <div className="grid-cell grid-head">Job #</div>
          <div className="grid-cell grid-head">Date</div>
          <div className="grid-cell grid-head">Address</div>
          <div className="grid-cell grid-head">Type</div>
          <div className="grid-cell grid-head">Complaint</div>
          <div className="grid-cell grid-head">Technicians</div>
          <div className="grid-cell grid-head">Status</div>
          <div className="grid-cell grid-head"></div>

          {jobs.map((j) =>
            editingId === j.id ? (
              <>
                <div className="grid-cell">{j.job_number}</div>
                <div className="grid-cell">
                  <input type="date" value={editJobDate} onChange={(e) => setEditJobDate(e.target.value)} />
                  <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
                </div>
                <div className="grid-cell">
                  <select value={editPropertyId} onChange={(e) => setEditPropertyId(e.target.value)}>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.customers?.is_banned ? '⚠️ ' : ''}{p.street_address} — {p.customers?.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid-cell">
                  <select value={editJobType} onChange={(e) => setEditJobType(e.target.value)}>
                    {jobTypes.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid-cell">
                  <input type="text" value={editComplaint} onChange={(e) => setEditComplaint(e.target.value)} />
                </div>
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
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <select value={addTechChoice} onChange={(e) => setAddTechChoice(e.target.value)} style={{ flex: 1, fontSize: 12 }}>
                      <option value="">Add…</option>
                      {users
                        .filter((u) => !editTechnicians.some((t) => t.user_id === u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="logout-button"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => addTechnicianToJob(j.id)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="grid-cell">
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                    <option value="scheduled">Scheduled</option>
                    <option value="on_my_way">On my way</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>
                <div className="grid-cell grid-actions">
                  <button className="auth-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => saveEdit(j.id)}>Save</button>
                  <button className="logout-button" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="grid-cell">{j.job_number}</div>
                <div className="grid-cell">{j.job_date}</div>
                <div className="grid-cell">{j.properties?.street_address || '—'}</div>
                <div className="grid-cell">{j.job_type}</div>
                <div className="grid-cell">{j.service_complaint || '—'}</div>
                <div className="grid-cell">{techNames(j)}</div>
                <div className="grid-cell"><span className={`status-pill status-${j.status}`}>{j.status}</span></div>
                <div className="grid-cell grid-actions">
                  <button className="logout-button" onClick={() => startEdit(j)}>Edit</button>
                </div>
              </>
            )
          )}
          {jobs.length === 0 && (
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
