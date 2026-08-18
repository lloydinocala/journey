import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { zonedToUtcIso } from './utils/tz'
import TimePicker15 from './TimePicker15'

function todayISO() { return new Date().toISOString().slice(0, 10) }

// Duration options in 15-minute steps, 15 min → 8 hr, stored as minutes.
const DUR_OPTS = Array.from({ length: 32 }, (_, i) => (i + 1) * 15)
function durLabel(min) {
  const h = min / 60
  return `${Number.isInteger(h) ? h.toFixed(1) : h} hr`
}

export default function NewTaskModal({ orgId, profile, onClose, onCreated }) {
  const [users, setUsers] = useState([])
  const [vendors, setVendors] = useState([])
  const [assignedUserId, setAssignedUserId] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [date, setDate] = useState(todayISO())
  const [time, setTime] = useState('')
  const [durationMin, setDurationMin] = useState('30')
  const [description, setDescription] = useState('')
  const [returnTo, setReturnTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orgId) return
    supabase.from('users').select('id, full_name').eq('org_id', orgId).eq('is_active', true).order('full_name')
      .then(({ data }) => setUsers(data || []))
    supabase.from('vendors').select('id, name, street_address, city, state, zip, phone').eq('org_id', orgId).order('name')
      .then(({ data }) => setVendors(data || []))
  }, [orgId])

  function chooseVendor(id) {
    const v = vendors.find((x) => x.id === id)
    if (!v) return
    setName(v.name)
    const line2 = [v.city, v.state, v.zip].filter(Boolean).join(', ')
    const full = [v.street_address, line2].filter(Boolean).join(', ')
    if (full) setAddress(full)
    if (v.phone) setContactPhone(v.phone)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (!assignedUserId) { setError('Please choose who this task is assigned to.'); return }
    if (!name.trim()) { setError('Task name is required.'); return }
    if (!date || !time) { setError('Date and time are required.'); return }
    const scheduledIso = zonedToUtcIso(date, time)
    if (!scheduledIso || isNaN(new Date(scheduledIso))) { setError('That date/time is not valid.'); return }

    setSaving(true)
    const { error: err } = await supabase.from('field_tasks').insert({
      org_id: orgId,
      assigned_user_id: assignedUserId,
      destination_name: name.trim(),
      address: address.trim() || null,
      contact_name: contactName.trim() || null,
      contact_title: contactTitle.trim() || null,
      contact_phone: contactPhone.trim() || null,
      scheduled_at: scheduledIso,
      duration_minutes: parseInt(durationMin, 10) || 30,
      description: description.trim() || null,
      return_to: returnTo || null,
      created_by: profile.id,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onCreated()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h3>New Task</h3>
        {error && <div className="auth-error" style={{ marginBottom: 10 }}>{error}</div>}
        <form onSubmit={handleSave}>
          <div className="field">
            <label>Assign to</label>
            <select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} required>
              <option value="">Select&hellip;</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>

          <h4 style={{ margin: '14px 0 6px' }}>Task</h4>
          <div className="field">
            <label>Parts House (quick-fill)</label>
            <select value="" onChange={(e) => chooseVendor(e.target.value)}>
              <option value="">Pick a parts house…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pick a parts house above, or type any destination" required />
          </div>
          <div className="field">
            <label>Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, State ZIP" />
          </div>
          <div className="field">
            <label>Contact name</label>
            <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Contact title</label>
              <input type="text" value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} placeholder="e.g. Counter Mgr" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Contact phone / text</label>
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>

          <h4 style={{ margin: '14px 0 6px' }}>Schedule</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Time</label>
              <TimePicker15 value={time} onChange={setTime} required />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Duration</label>
              <select value={durationMin} onChange={(e) => setDurationMin(e.target.value)}>
                {DUR_OPTS.map((m) => <option key={m} value={m}>{durLabel(m)}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Re: PO # or Job #" style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          <div className="field">
            <label>On Completion</label>
            <select value={returnTo} onChange={(e) => setReturnTo(e.target.value)}>
              <option value="">Done — back to Job Cards</option>
              <option value="shop">Return to Shop</option>
              <option value="job">Return to Job</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="auth-button" type="submit" disabled={saving} style={{ width: 'auto', padding: '10px 24px' }}>
              {saving ? 'Creating\u2026' : 'Create Task'}
            </button>
            <button type="button" className="logout-button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

