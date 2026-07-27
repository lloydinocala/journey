import { useState, useEffect, Fragment } from 'react'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'
import { fetchAllRows } from './utils/csvImport'

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  on_my_way: 'On My Way',
  in_progress: 'In Progress',
  incomplete: 'Incomplete',
  completed: 'Completed',
  canceled: 'Canceled',
}

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

const blankForm = {
  assigned_user_id: '', destination_name: '', address: '', description: '',
  date: todayISO(), time: '09:00', duration_minutes: '30', parts_order_id: '',
}

function vendorAddr(v) {
  if (!v) return ''
  return [v.street_address, [v.city, v.state].filter(Boolean).join(', '), v.zip].filter(Boolean).join(' ').trim()
}
function mapLink(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
function fmtStamp(t) {
  if (!t) return null
  return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function fmtTime(t) {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function Tasks({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDone, setShowDone] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState(null)
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

  async function loadAll(orgId) {
    if (!orgId) return
    setLoading(true)
    const [taskData, userData, partData] = await Promise.all([
      fetchAllRows(() => supabase.from('field_tasks').select('*').eq('org_id', orgId).is('deleted_at', null).order('scheduled_at', { ascending: false })),
      supabase.from('users').select('id, full_name, role').eq('org_id', orgId).eq('is_active', true).order('full_name'),
      supabase.from('parts_orders').select('id, part_description, part_number, po_number, delivery_verified, jobs ( job_number ), vendors ( name, street_address, city, state, zip )').eq('org_id', orgId).order('created_at', { ascending: false }),
    ])
    setTasks(taskData)
    setUsers(userData.data || [])
    setParts(partData.data || [])
    setLoading(false)
  }

  useEffect(() => { loadAll(selectedOrg) }, [selectedOrg])

  function userName(id) { return users.find((u) => u.id === id)?.full_name || '—' }
  function partById(id) { return parts.find((p) => p.id === id) || null }
  function partLabel(p) { return `J-${p.jobs?.job_number || '?'} · ${p.part_description}${p.vendors?.name ? ' (' + p.vendors.name + ')' : ''}${p.delivery_verified ? ' — verified' : ''}` }

  function resetForm() { setForm(blankForm); setEditingId(null); setError(''); setShowForm(false) }

  function startEdit(t) {
    const d = new Date(t.scheduled_at)
    const pad = (n) => String(n).padStart(2, '0')
    setForm({
      assigned_user_id: t.assigned_user_id || '',
      destination_name: t.destination_name || '',
      address: t.address || '',
      description: t.description || '',
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      duration_minutes: String(t.duration_minutes || 30),
      parts_order_id: t.parts_order_id || '',
    })
    setEditingId(t.id)
    setError('')
    setShowForm(true)
  }

  // Selecting a parts order fills in the pickup destination from its vendor.
  function choosePart(id) {
    if (!id) { setForm((f) => ({ ...f, parts_order_id: '' })); return }
    const p = partById(id)
    setForm((f) => ({
      ...f,
      parts_order_id: id,
      destination_name: p?.vendors?.name ? `${p.vendors.name} — parts pickup` : (f.destination_name || 'Parts pickup'),
      address: vendorAddr(p?.vendors) || f.address,
      description: p ? `Pick up: ${p.part_description}${p.po_number ? ' · PO ' + p.po_number : ''}` : f.description,
    }))
  }

  // A task may not overlap the assigned user's scheduled jobs or their other tasks.
  async function findConflict(userId, startMs, endMs) {
    // Jobs the user is assigned to (via job_technicians), with a real start time.
    const { data: jt } = await supabase.from('job_technicians').select('job_id').eq('org_id', selectedOrg).eq('user_id', userId)
    const jobIds = [...new Set((jt || []).map((r) => r.job_id))]
    if (jobIds.length) {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('job_number, segment, start_time, duration_hours, status')
        .eq('org_id', selectedOrg).is('deleted_at', null).in('id', jobIds)
        .not('start_time', 'is', null)
      for (const j of jobs || []) {
        if (j.status === 'canceled' || j.status === 'completed') continue
        const js = new Date(j.start_time).getTime()
        const je = js + (j.duration_hours ? j.duration_hours * 3600000 : 3600000)
        if (startMs < je && js < endMs) {
          return `job ${j.job_number}${j.segment > 1 ? '-' + j.segment : ''} at ${new Date(js).toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}`
        }
      }
    }
    // The user's other tasks.
    const { data: others } = await supabase
      .from('field_tasks')
      .select('id, destination_name, scheduled_at, duration_minutes, status')
      .eq('org_id', selectedOrg).eq('assigned_user_id', userId).is('deleted_at', null)
      .not('status', 'in', '(completed,canceled)')
    for (const t of others || []) {
      if (t.id === editingId) continue
      const ts = new Date(t.scheduled_at).getTime()
      const te = ts + (t.duration_minutes || 30) * 60000
      if (startMs < te && ts < endMs) {
        return `task "${t.destination_name}" at ${new Date(ts).toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}`
      }
    }
    return null
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (!form.assigned_user_id) { setError('Please choose who this task is assigned to.'); return }
    if (!form.destination_name.trim()) { setError('Destination name is required.'); return }
    if (!form.date || !form.time) { setError('Date and time are required.'); return }

    const scheduled = new Date(`${form.date}T${form.time}:00`)
    if (isNaN(scheduled)) { setError('That date/time is not valid.'); return }
    const dur = parseInt(form.duration_minutes, 10) || 30
    const startMs = scheduled.getTime()
    const endMs = startMs + dur * 60000

    setSaving(true)
    const conflict = await findConflict(form.assigned_user_id, startMs, endMs)
    if (conflict) {
      setSaving(false)
      setError(`${userName(form.assigned_user_id)} already has ${conflict}. Pick a time that doesn't overlap.`)
      return
    }

    const payload = {
      org_id: selectedOrg,
      assigned_user_id: form.assigned_user_id,
      destination_name: form.destination_name.trim(),
      address: form.address.trim() || null,
      description: form.description.trim() || null,
      scheduled_at: scheduled.toISOString(),
      duration_minutes: dur,
      parts_order_id: form.parts_order_id || null,
    }

    let err
    if (editingId) {
      ({ error: err } = await supabase.from('field_tasks').update(payload).eq('id', editingId))
    } else {
      ({ error: err } = await supabase.from('field_tasks').insert({ ...payload, created_by: profile.id }))
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    resetForm()
    loadAll(selectedOrg)
  }

  async function cancelTask(t) {
    if (!window.confirm(`Cancel the task "${t.destination_name}"? It will show as Canceled.`)) return
    await supabase.from('field_tasks').update({ status: 'canceled' }).eq('id', t.id)
    loadAll(selectedOrg)
  }

  async function deleteTask(t) {
    if (!window.confirm(`Remove the task "${t.destination_name}" from the list? This cannot be undone.`)) return
    await supabase.from('field_tasks').update({ deleted_at: new Date().toISOString() }).eq('id', t.id)
    loadAll(selectedOrg)
  }

  const visible = tasks.filter((t) => showDone || !['completed', 'canceled'].includes(t.status))
  const openCount = tasks.filter((t) => !['completed', 'canceled'].includes(t.status)).length
  const openIssues = tasks.filter((t) => t.status === 'incomplete').length

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Tasks</h2>
          <span className="badge">{openCount.toLocaleString()} open</span>
          {openIssues > 0 && <span className="status-pill status-incomplete">{openIssues} incomplete</span>}
        </div>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0, marginBottom: 18 }}>
        Standalone errands assigned to a field user — destination, address, and time only. They appear as a Job Card
        on that user's phone (On My Way → Start → Stop) and can't be scheduled over one of their jobs. If a user marks
        one Incomplete, it turns red here with their reason.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      {showForm && (
        <form className="inline-form" onSubmit={handleSave} style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 180 }}>
            <label>Assigned To</label>
            <select value={form.assigned_user_id} onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })} required>
              <option value="">Select user…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Destination Name</label>
            <input type="text" value={form.destination_name} onChange={(e) => setForm({ ...form, destination_name: e.target.value })} placeholder="e.g. Johnstone Supply — pickup" required />
          </div>
          <div className="field" style={{ minWidth: 240 }}>
            <label>Address</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, City, State ZIP" />
          </div>
          <div className="field" style={{ minWidth: 240 }}>
            <label>Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What needs to happen" />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div className="field">
            <label>Time</label>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
          </div>
          <div className="field" style={{ width: 120 }}>
            <label>Est. Minutes</label>
            <input type="number" min="5" step="5" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
          </div>
          <div className="field" style={{ minWidth: 260 }}>
            <label>Link to Parts Order (optional)</label>
            <select value={form.parts_order_id} onChange={(e) => choosePart(e.target.value)}>
              <option value="">None — standalone task</option>
              {parts.map((p) => <option key={p.id} value={p.id}>{partLabel(p)}</option>)}
            </select>
          </div>
          <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto' }}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add task'}
          </button>
        </form>
      )}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <label className="nav-link" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 14 }}>
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} style={{ marginRight: 6 }} />
        Show completed / canceled
      </label>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 104 }}></th>
              <th>Assigned To</th>
              <th>Destination</th>
              <th>Address</th>
              <th>Date &amp; Time</th>
              <th>Est.</th>
              <th>On My Way</th>
              <th>Started</th>
              <th>Stopped</th>
              <th>Status</th>
              <th>Issue</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => {
              const linkedPart = t.parts_order_id ? partById(t.parts_order_id) : null
              const open = expandedId === t.id
              return (
              <Fragment key={t.id}>
              <tr style={t.status === 'incomplete' ? { background: 'rgba(255, 107, 107, 0.08)' } : undefined}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'stretch' }}>
                    <button className="logout-button" style={{ padding: '4px 8px', textAlign: 'center' }} onClick={() => setExpandedId(open ? null : t.id)}>{open ? 'Hide' : 'Records'}</button>
                    <button className="logout-button" style={{ padding: '4px 8px', textAlign: 'center' }} onClick={() => startEdit(t)}>Edit</button>
                    {!['completed', 'canceled'].includes(t.status) && <button className="logout-button" style={{ padding: '4px 8px', textAlign: 'center' }} onClick={() => cancelTask(t)}>Cancel</button>}
                    <button className="logout-button" style={{ padding: '4px 8px', textAlign: 'center' }} onClick={() => deleteTask(t)}>Delete</button>
                  </div>
                </td>
                <td>{userName(t.assigned_user_id)}</td>
                <td>{t.destination_name}{linkedPart && <span className="status-pill status-scheduled" style={{ marginLeft: 6, fontSize: 10 }}>PARTS</span>}</td>
                <td>{t.address || '—'}</td>
                <td>{new Date(t.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                <td>{t.duration_minutes}m</td>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtTime(t.on_my_way_at)}</td>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtTime(t.started_at)}</td>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtTime(t.stopped_at)}</td>
                <td><span className={`status-pill status-${t.status}`}>{STATUS_LABEL[t.status] || t.status}</span></td>
                <td style={{ maxWidth: 220, fontSize: 12 }}>{t.status === 'incomplete' ? (t.incomplete_reason || 'Reported incomplete') : '—'}</td>
              </tr>
              {open && (
                <tr>
                  <td colSpan="11" style={{ background: 'var(--ink)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--mist)', marginBottom: 8 }}>Button Records</div>
                        {[['On My Way', t.on_my_way_at, t.on_my_way_lat, t.on_my_way_lng],
                          ['Start My Time', t.started_at, t.started_lat, t.started_lng],
                          ['Stop My Time', t.stopped_at, t.stopped_lat, t.stopped_lng]].map(([label, at, lat, lng]) => (
                          <div key={label} style={{ fontSize: 13, margin: '3px 0' }}>
                            <strong>{label}:</strong> {fmtStamp(at) || <span style={{ color: 'var(--mist)' }}>— not yet</span>}
                            {at && lat != null && lng != null && (
                              <> · <a href={mapLink(lat, lng)} target="_blank" rel="noreferrer">location ↗</a></>
                            )}
                            {at && (lat == null || lng == null) && <span style={{ color: 'var(--mist)' }}> · no GPS captured</span>}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--mist)', marginBottom: 8 }}>Parts Link</div>
                        {linkedPart ? (
                          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                            <div>Job {linkedPart.jobs?.job_number || '—'} · {linkedPart.part_description}</div>
                            <div>{linkedPart.vendors?.name || '—'}{linkedPart.po_number ? ` · PO ${linkedPart.po_number}` : ''}</div>
                            <div><span className={`status-pill ${linkedPart.delivery_verified ? 'status-completed' : 'status-scheduled'}`}>{linkedPart.delivery_verified ? 'Delivery Verified' : 'Pickup Pending'}</span></div>
                          </div>
                        ) : <div style={{ fontSize: 13, color: 'var(--mist)' }}>Standalone task — not tied to a job or parts order.</div>}
                        {t.status === 'incomplete' && (
                          <div style={{ marginTop: 10, fontSize: 13 }}><strong style={{ color: '#C0392B' }}>Incomplete:</strong> {t.incomplete_reason || 'Reported incomplete'}</div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
              )
            })}
            {visible.length === 0 && (
              <tr><td colSpan="11" style={{ color: 'var(--mist)' }}>No tasks{showDone ? '' : ' open'} right now.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
