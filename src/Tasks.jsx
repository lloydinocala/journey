import { useState, useEffect, Fragment } from 'react'
import { supabase } from './utils/supabase'
import TimePicker15 from './TimePicker15'
import OrgPicker from './OrgPicker'
import { fetchAllRows } from './utils/csvImport'
import { loadOrgTz, formatTimeInZone, formatDateTimeInZone, zonedToUtcIso, utcToZonedInputs } from './utils/tz'

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
  contact_name: '', contact_title: '', contact_phone: '',
  date: todayISO(), time: '09:00', duration_minutes: '30', parts_order_id: '', return_to: '',
}

function vendorAddr(v) {
  if (!v) return ''
  return [v.street_address, [v.city, v.state].filter(Boolean).join(', '), v.zip].filter(Boolean).join(' ').trim()
}
// Duration: 15-minute increments up to 10 hours (like Jobs).
const DUR_OPTS = Array.from({ length: 32 }, (_, i) => (i + 1) * 15)
function durLabel(min) {
  const h = min / 60
  return `${Number.isInteger(h) ? h.toFixed(1) : h} hr`
}
function mapLink(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
function fmtStamp(t) {
  if (!t) return null
  return formatDateTimeInZone(t, undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function fmtTime(t) {
  if (!t) return '—'
  return formatTimeInZone(t) || '—'
}
// Worked minutes = Start My Time -> Stop My Time.
function workedMinutes(t) {
  if (!t.started_at || !t.stopped_at) return null
  const m = Math.round((new Date(t.stopped_at) - new Date(t.started_at)) / 60000)
  return m >= 0 ? m : null
}
function fmtDur(mins) {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}
function money(n) {
  if (n == null || isNaN(n)) return '—'
  return `$${Number(n).toFixed(2)}`
}

export default function Tasks({ profile }) {
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [parts, setParts] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDone, setShowDone] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [showPay, setShowPay] = useState(false)
  const [payFrom, setPayFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [payTo, setPayTo] = useState(todayISO())

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
    const [taskData, userData, partData, vendorData] = await Promise.all([
      fetchAllRows(() => supabase.from('field_tasks').select('*').eq('org_id', orgId).is('deleted_at', null).order('scheduled_at', { ascending: false })),
      supabase.from('users').select('id, full_name, role, task_hourly_rate, standard_hourly_rate').eq('org_id', orgId).eq('is_active', true).order('full_name'),
      supabase.from('parts_orders').select('id, part_description, part_number, po_number, delivery_verified, jobs ( job_number ), vendors ( name, street_address, city, state, zip )').eq('org_id', orgId).order('created_at', { ascending: false }),
      supabase.from('vendors').select('id, name, street_address, city, state, zip').eq('org_id', orgId).order('name'),
    ])
    setTasks(taskData)
    setUsers(userData.data || [])
    setParts(partData.data || [])
    setVendors(vendorData.data || [])
    setLoading(false)
  }

  useEffect(() => { loadOrgTz(selectedOrg); loadAll(selectedOrg) }, [selectedOrg])

  function userName(id) { return users.find((u) => u.id === id)?.full_name || '—' }
  function userObj(id) { return users.find((u) => u.id === id) || null }
  function taskPay(t) {
    const mins = workedMinutes(t)
    const rate = userObj(t.assigned_user_id)?.task_hourly_rate
    if (mins == null || rate == null) return null
    return (mins / 60) * Number(rate)
  }
  function partById(id) { return parts.find((p) => p.id === id) || null }
  function partLabel(p) { return `J-${p.jobs?.job_number || '?'} · ${p.part_description}${p.vendors?.name ? ' (' + p.vendors.name + ')' : ''}${p.delivery_verified ? ' — verified' : ''}` }

  function resetForm() { setForm(blankForm); setEditingId(null); setError(''); setShowForm(false) }

  function startEdit(t) {
    const zoned = utcToZonedInputs(t.scheduled_at)
    setForm({
      assigned_user_id: t.assigned_user_id || '',
      destination_name: t.destination_name || '',
      address: t.address || '',
      description: t.description || '',
      contact_name: t.contact_name || '',
      contact_title: t.contact_title || '',
      contact_phone: t.contact_phone || '',
      date: zoned.date,
      time: zoned.time,
      duration_minutes: String(t.duration_minutes || 30),
      parts_order_id: t.parts_order_id || '',
      return_to: t.return_to || '',
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

  // Quick-fill the destination from a saved parts house (vendor). Free-text stays editable.
  function chooseVendor(id) {
    if (!id) return
    const v = vendors.find((x) => x.id === id)
    if (!v) return
    setForm((f) => ({ ...f, destination_name: v.name, address: vendorAddr(v) || f.address }))
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

    const scheduledIso = zonedToUtcIso(form.date, form.time)
    const scheduled = scheduledIso ? new Date(scheduledIso) : new Date(NaN)
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
      contact_name: form.contact_name.trim() || null,
      contact_title: form.contact_title.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      scheduled_at: scheduledIso,
      duration_minutes: dur,
      parts_order_id: form.parts_order_id || null,
      return_to: form.return_to || null,
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

  // Per-employee task-pay summary for completed tasks in the chosen period.
  const payRows = (() => {
    const from = new Date(payFrom + 'T00:00:00'), to = new Date(payTo + 'T23:59:59')
    const byUser = {}
    for (const t of tasks) {
      if (t.status !== 'completed' || !t.stopped_at) continue
      const d = new Date(t.stopped_at)
      if (d < from || d > to) continue
      const uid = t.assigned_user_id || 'unknown'
      const mins = workedMinutes(t) || 0
      if (!byUser[uid]) byUser[uid] = { uid, count: 0, mins: 0 }
      byUser[uid].count += 1
      byUser[uid].mins += mins
    }
    return Object.values(byUser).map((r) => {
      const rate = userObj(r.uid)?.task_hourly_rate
      return { ...r, rate, pay: rate != null ? (r.mins / 60) * Number(rate) : null }
    }).sort((a, b) => userName(a.uid).localeCompare(userName(b.uid)))
  })()
  const payTotal = payRows.reduce((s, r) => s + (r.pay || 0), 0)

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
          <div className="field" style={{ minWidth: 190 }}>
            <label>Parts House (quick-fill)</label>
            <select value="" onChange={(e) => chooseVendor(e.target.value)}>
              <option value="">Pick a parts house…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Destination Name</label>
            <input type="text" value={form.destination_name} onChange={(e) => setForm({ ...form, destination_name: e.target.value })} placeholder="Pick a parts house above, or type any destination" required />
          </div>
          <div className="field" style={{ minWidth: 240 }}>
            <label>Address</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, City, State ZIP" />
          </div>
          <div className="field" style={{ minWidth: 170 }}>
            <label>Contact Name</label>
            <input type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Who to ask for" />
          </div>
          <div className="field" style={{ width: 150 }}>
            <label>Contact Title</label>
            <input type="text" value={form.contact_title} onChange={(e) => setForm({ ...form, contact_title: e.target.value })} placeholder="e.g. Counter Mgr" />
          </div>
          <div className="field" style={{ width: 160 }}>
            <label>Contact Phone</label>
            <input type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="Phone" />
          </div>
          <div className="field" style={{ minWidth: 240 }}>
            <label>Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Re: PO # or Job #" />
          </div>
          <div className="field" style={{ minWidth: 200 }}>
            <label>On Completion</label>
            <select value={form.return_to} onChange={(e) => setForm({ ...form, return_to: e.target.value })}>
              <option value="">Done — back to Job Cards</option>
              <option value="shop">Return to Shop</option>
              <option value="job">Return to Job</option>
            </select>
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div className="field">
            <label>Time</label>
            <TimePicker15 value={form.time} onChange={(v) => setForm({ ...form, time: v })} required />
          </div>
          <div className="field" style={{ width: 150 }}>
            <label>Duration</label>
            <select value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}>
              {DUR_OPTS.map((m) => <option key={m} value={m}>{durLabel(m)}</option>)}
            </select>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <label className="nav-link" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} style={{ marginRight: 6 }} />
          Show completed / canceled
        </label>
        <button className="logout-button" onClick={() => setShowPay((v) => !v)}>{showPay ? 'Hide task pay' : 'Task pay summary'}</button>
      </div>

      {showPay && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, margin: '0 0 22px', maxWidth: 720 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Completed Task Pay</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
            <div className="field" style={{ marginBottom: 0 }}><label>From</label><input type="date" value={payFrom} onChange={(e) => setPayFrom(e.target.value)} /></div>
            <div className="field" style={{ marginBottom: 0 }}><label>To</label><input type="date" value={payTo} onChange={(e) => setPayTo(e.target.value)} /></div>
          </div>
          <table className="data-table" style={{ maxWidth: 680 }}>
            <thead>
              <tr><th>Employee</th><th>Tasks</th><th>Worked</th><th>Task rate</th><th>Pay</th></tr>
            </thead>
            <tbody>
              {payRows.length === 0 ? (
                <tr><td colSpan="5" style={{ color: 'var(--mist)' }}>No completed tasks in this period.</td></tr>
              ) : payRows.map((r) => (
                <tr key={r.uid}>
                  <td>{userName(r.uid)}</td>
                  <td>{r.count}</td>
                  <td>{fmtDur(r.mins)}</td>
                  <td>{r.rate != null ? `${money(r.rate)}/hr` : <span style={{ color: '#C0392B' }}>set rate</span>}</td>
                  <td>{r.pay != null ? <strong>{money(r.pay)}</strong> : '—'}</td>
                </tr>
              ))}
              {payRows.length > 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'right' }}><strong>Total</strong></td><td><strong>{money(payTotal)}</strong></td></tr>
              )}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--mist)', marginTop: 8 }}>
            Worked time is Start My Time → Stop My Time on completed tasks. Set rates in Settings → Employee Pay Rates.
            This is a task-time report — it doesn't post to payroll on its own.
          </p>
        </div>
      )}

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
              <th>Description</th>
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
                <td>{t.destination_name}{linkedPart && <span className="status-pill status-scheduled" style={{ marginLeft: 6, fontSize: 10 }}>PARTS</span>}{t.return_to && <span className="status-pill status-scheduled" style={{ marginLeft: 6, fontSize: 10 }}>{t.return_to === 'shop' ? '\u21A9 SHOP' : '\u21A9 JOB'}</span>}</td>
                <td>{t.address || '—'}</td>
                <td>{fmtStamp(t.scheduled_at)}</td>
                <td>{t.duration_minutes}m</td>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtTime(t.on_my_way_at)}</td>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtTime(t.started_at)}</td>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtTime(t.stopped_at)}</td>
                <td><span className={`status-pill status-${t.status}`}>{STATUS_LABEL[t.status] || t.status}</span></td>
                <td style={{ maxWidth: 220, fontSize: 12 }}>{t.description || '—'}{t.status === 'incomplete' && t.incomplete_reason ? <span style={{ color: '#C0392B' }}> · {t.incomplete_reason}</span> : ''}</td>
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
                        <div style={{ fontSize: 13, marginTop: 8 }}>
                          <strong>Worked:</strong> {fmtDur(workedMinutes(t))}
                          {taskPay(t) != null && <> · <strong>Task pay:</strong> {money(taskPay(t))}</>}
                        </div>
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
