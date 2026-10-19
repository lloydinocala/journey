import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { zonedToUtcIso, utcToZonedInputs } from './utils/tz'

// Confirm cards for what QuincyAI (in Help) proposes. Quincy never changes anything
// itself: each card shows every field, the user can edit them, and the change is made
// here with the user's own session — so their permissions and the database rules apply.

const box = { border: '1px solid #DCE6F3', background: '#F7FAFE', borderRadius: 10, padding: 12, marginTop: 10 }
const inp = { width: '100%', padding: '7px 9px', border: '1px solid #D5DAE1', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }
const lbl = { fontSize: 11.5, color: '#64748B', fontWeight: 700, display: 'block', marginTop: 6 }
const btn = (bg) => ({ padding: '8px 13px', borderRadius: 8, border: 'none', background: bg, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' })

export default function QuincyProposals({ proposals, profile, onNavigate }) {
  if (!proposals?.length) return null
  return proposals.map((p, i) => (
    p.type === 'open_page' ? <OpenPage key={i} p={p} onNavigate={onNavigate} />
      : p.type === 'create_task' ? <CreateTask key={i} p={p} profile={profile} />
        : p.type === 'reschedule_job' ? <Reschedule key={i} p={p} profile={profile} />
          : null
  ))
}

function OpenPage({ p, onNavigate }) {
  const navigate = useNavigate()
  return (
    <div style={{ marginTop: 10 }}>
      <button style={btn('#1F3A5F')} onClick={() => { navigate(p.path); onNavigate?.() }}>➜ {p.label}</button>
    </div>
  )
}

function Done({ text }) {
  return <div style={{ ...box, background: '#E8F5EC', borderColor: '#BFE3CB', color: '#166534', fontWeight: 700, fontSize: 13 }}>✓ {text}</div>
}

function CreateTask({ p, profile }) {
  const [f, setF] = useState({ name: p.name || '', description: p.description || '', address: p.address || '', assigned: p.assigned_user_id || '', date: p.date || '', time: p.time || '09:00', duration: p.duration_minutes || 30 })
  const [team, setTeam] = useState([])
  const [state, setState] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    if (profile?.org_id) supabase.from('users').select('id, full_name').eq('org_id', profile.org_id).eq('is_active', true).order('full_name').then(({ data }) => setTeam(data || []))
  }, [profile?.org_id])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function confirm() {
    setErr('')
    if (!f.name.trim() || !f.date || !f.time) { setErr('Name, date and time are required.'); return }
    const iso = zonedToUtcIso(f.date, f.time)
    if (!iso || isNaN(new Date(iso))) { setErr('That date/time is not valid.'); return }
    setState('saving')
    const { error } = await supabase.from('field_tasks').insert({
      org_id: profile.org_id, assigned_user_id: f.assigned || null, destination_name: f.name.trim(), address: f.address.trim() || null,
      description: f.description.trim() || null, scheduled_at: iso, duration_minutes: parseInt(f.duration, 10) || 30, created_by: profile.id,
    })
    if (error) { setErr(error.message); setState(''); return }
    setState('done')
  }
  if (state === 'done') return <Done text={`Task created: ${f.name}`} />
  return (
    <div style={box}>
      <div style={{ fontWeight: 800, fontSize: 13.5, color: '#1F3A5F' }}>New task — confirm to create</div>
      <label style={lbl}>Task</label><input style={inp} value={f.name} onChange={set('name')} />
      <label style={lbl}>Details</label><input style={inp} value={f.description} onChange={set('description')} />
      <label style={lbl}>Address</label><input style={inp} value={f.address} onChange={set('address')} />
      <label style={lbl}>Assigned to</label>
      <select style={inp} value={f.assigned} onChange={set('assigned')}>
        <option value="">Unassigned (goes to the Calendar tray)</option>
        {team.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Date</label><input type="date" style={inp} value={f.date} onChange={set('date')} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Time</label><input type="time" style={inp} value={f.time} onChange={set('time')} /></div>
        <div style={{ width: 70 }}><label style={lbl}>Minutes</label><input type="number" style={inp} value={f.duration} onChange={set('duration')} /></div>
      </div>
      {err && <div style={{ color: '#B00020', fontSize: 12.5, marginTop: 6 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button style={btn('#15803D')} disabled={state === 'saving'} onClick={confirm}>{state === 'saving' ? 'Creating…' : '✓ Create task'}</button>
        <button style={{ ...btn('#94A3B8') }} onClick={() => setState('done-cancel')}>Cancel</button>
      </div>
      {state === 'done-cancel' && <div style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>Cancelled — nothing was created.</div>}
    </div>
  )
}

function Reschedule({ p, profile }) {
  const [date, setDate] = useState(p.date || '')
  const [time, setTime] = useState(p.time || '08:00')
  const [state, setState] = useState('')
  const [err, setErr] = useState('')
  const cur = p.current_start ? utcToZonedInputs(p.current_start) : null

  async function confirm() {
    setErr('')
    if (!date || !time) { setErr('Pick a date and time.'); return }
    const iso = zonedToUtcIso(date, time)
    if (!iso || isNaN(new Date(iso))) { setErr('That date/time is not valid.'); return }
    setState('saving')
    // Same guard as the Calendar: an install can't be scheduled until its payment is confirmed.
    const { data: inv } = await supabase.from('invoices').select('payment_confirmed_at, paid_at').eq('estimate_type', 'system')
      .or(`spawned_job_id.eq.${p.job_id},converted_to_job_id.eq.${p.job_id}`).limit(1)
    if (inv?.[0] && !inv[0].payment_confirmed_at && !inv[0].paid_at) {
      setErr("This install can't be scheduled yet — its payment isn't confirmed (Payments to Confirm)."); setState(''); return
    }
    const { data: j } = await supabase.from('jobs').select('status').eq('id', p.job_id).single()
    const patch = { job_date: date, start_time: iso, date_pending: false }
    if (!j?.status || j.status === 'unscheduled') patch.status = 'scheduled'
    const { error } = await supabase.from('jobs').update(patch).eq('id', p.job_id)
    if (error) { setErr(error.message); setState(''); return }
    setState('done')
  }
  if (state === 'done') return <Done text={`Job ${p.job_number} moved to ${new Date(date + 'T12:00:00').toLocaleDateString()} at ${time}`} />
  return (
    <div style={box}>
      <div style={{ fontWeight: 800, fontSize: 13.5, color: '#1F3A5F' }}>Reschedule job {p.job_number} — confirm to move it</div>
      <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4 }}>
        {p.customer}{p.customer ? ' · ' : ''}Now: {p.current_date ? new Date(p.current_date + 'T12:00:00').toLocaleDateString() : 'unscheduled'}{cur?.time ? ' at ' + cur.time : ''}
        {p.reason ? <div>Reason: {p.reason}</div> : null}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}><label style={lbl}>New date</label><input type="date" style={inp} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>New time</label><input type="time" style={inp} value={time} onChange={(e) => setTime(e.target.value)} /></div>
      </div>
      {err && <div style={{ color: '#B00020', fontSize: 12.5, marginTop: 6 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button style={btn('#15803D')} disabled={state === 'saving'} onClick={confirm}>{state === 'saving' ? 'Moving…' : '✓ Move job'}</button>
        <button style={btn('#94A3B8')} onClick={() => setState('cancel')}>Cancel</button>
      </div>
      {state === 'cancel' && <div style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>Cancelled — nothing changed.</div>}
    </div>
  )
}
