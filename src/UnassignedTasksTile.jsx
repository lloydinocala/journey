import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { formatDateTimeInZone } from './utils/tz'

// Calendar tray for tasks created without an assignee. They wait here (off the time
// grid) until someone is assigned; assigning sends the task to that person's phone.
export default function UnassignedTasksTile({ orgId, isMobile }) {
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    if (!orgId) return
    const [{ data: t }, { data: u }] = await Promise.all([
      supabase.from('field_tasks').select('id, destination_name, address, scheduled_at, duration_minutes, description')
        .eq('org_id', orgId).is('assigned_user_id', null).is('deleted_at', null).is('archived_at', null)
        .not('status', 'in', '(completed,canceled)').order('scheduled_at', { ascending: true }),
      supabase.from('users').select('id, full_name').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    ])
    setTasks(t || []); setUsers(u || [])
  }
  useEffect(() => { load() }, [orgId])

  async function assign(task, userId) {
    if (!userId) return
    setBusy(task.id); setErr('')
    const { error } = await supabase.from('field_tasks').update({ assigned_user_id: userId }).eq('id', task.id)
    setBusy(null)
    if (error) { setErr(error.message); return }
    load()
  }

  if (!tasks.length) return null
  return (
    <div style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(46,111,181,.3)', borderRadius: 12, padding: 12, marginTop: 12, width: isMobile ? '100%' : 202, boxSizing: 'border-box' }}>
      <strong style={{ fontSize: 14, color: '#2E6FB5' }}>Unassigned Tasks ({tasks.length})</strong>
      {err && <div style={{ color: '#B5462F', fontSize: 12, marginTop: 6 }}>{err}</div>}
      {tasks.map((t) => (
        <div key={t.id} style={{ background: '#fff', borderLeft: '4px solid #2E6FB5', borderRadius: 8, padding: '8px 10px', marginTop: 8, boxShadow: '0 1px 3px rgba(16,42,67,.12)' }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.destination_name}</div>
          <div style={{ fontSize: 12, color: 'var(--mist)' }}>{formatDateTimeInZone(t.scheduled_at, undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
          {t.description && <div style={{ fontSize: 12, color: 'var(--mist)' }}>{t.description}</div>}
          <select value="" disabled={busy === t.id} onChange={(e) => assign(t, e.target.value)} style={{ width: '100%', marginTop: 6, fontSize: 12.5 }}>
            <option value="">Assign to…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
      ))}
      <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 6 }}>Edit times on the <Link to="/tasks">Tasks</Link> page.</div>
    </div>
  )
}
