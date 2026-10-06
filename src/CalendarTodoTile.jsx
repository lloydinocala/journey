import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'

const today = () => new Date().toISOString().slice(0, 10)

// Compact To-Do tile for the Calendar's left column — sits under the Needs Dispatch
// tray. Reads the same office_reminders table as the full To-Do page (Reminders),
// shows the open count, lets you check items off or add a quick one, and links out
// to the full list.
export default function CalendarTodoTile({ orgId, profile, isMobile }) {
  const nav = useNavigate()
  const [items, setItems] = useState([])
  const [body, setBody] = useState('')
  const [due, setDue] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!orgId) { setItems([]); return }
    const { data } = await supabase.from('office_reminders')
      .select('id, body, due_date, done, done_at, created_at')
      .eq('org_id', orgId).eq('done', false)
      .order('due_date', { nullsFirst: false }).order('created_at', { ascending: false })
    setItems(data || [])
  }
  useEffect(() => { load() }, [orgId])

  async function add() {
    const t = body.trim(); if (!t || !orgId) return
    setSaving(true)
    await supabase.from('office_reminders').insert({ org_id: orgId, body: t, due_date: due || null, created_by: profile?.user_id || null })
    setSaving(false); setBody(''); setDue(''); load()
  }
  async function complete(r) {
    await supabase.from('office_reminders').update({ done: true, done_at: new Date().toISOString() }).eq('id', r.id)
    load()
  }

  const t = today()
  const count = items.length
  // "Flagged" = due today or already overdue — these must stand out.
  const flaggedCount = items.filter((i) => i.due_date && i.due_date <= t).length
  const inputStyle = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }

  return (
    <div style={{
      width: isMobile ? '100%' : '100%',
      background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(23,110,122,.28)', borderRadius: 12,
      padding: 12, marginTop: isMobile ? 0 : 16, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <strong style={{ fontSize: 14, color: '#176E7A' }}>📝 To-Do{count ? ` (${count})` : ''}</strong>
        <span onClick={() => nav('/to-do')} style={{ fontSize: 11.5, color: '#2E6FB5', cursor: 'pointer', fontWeight: 700 }}>Open →</span>
      </div>

      {flaggedCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#DC2626', color: '#fff', borderRadius: 7, padding: '6px 10px', marginBottom: 10, fontSize: 12.5, fontWeight: 800 }}>
          🚩 {flaggedCount} due today{items.some((i) => i.due_date && i.due_date < t) ? ' or overdue' : ''}
        </div>
      )}

      <input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }}
        placeholder="Add a to-do…" style={{ ...inputStyle, marginBottom: 6 }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} title="Optional due date"
          style={{ ...inputStyle, flex: 1, minWidth: 0, padding: '6px 8px' }} />
        <button className="auth-button" style={{ width: 'auto', padding: '6px 12px', margin: 0 }} onClick={add} disabled={saving || !body.trim()}>Add</button>
      </div>

      {count === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--mist)' }}>All caught up. 🎉</div>
      ) : (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {items.map((r) => {
            const overdue = r.due_date && r.due_date < t
            const dueToday = r.due_date === t
            const flag = overdue || dueToday
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: flag ? '7px 8px' : '6px 0',
                borderTop: flag ? 'none' : '1px solid var(--border)',
                background: flag ? '#FDE8E8' : 'transparent',
                borderLeft: flag ? '4px solid #DC2626' : 'none',
                borderRadius: flag ? 6 : 0,
                marginBottom: flag ? 5 : 0,
              }}>
                <input type="checkbox" checked={false} onChange={() => complete(r)} title="Mark done" style={{ width: 16, height: 16, flex: 'none', marginTop: 2, cursor: 'pointer' }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.3, fontWeight: flag ? 700 : 400 }}>
                  {flag && <span style={{ marginRight: 4 }}>🚩</span>}
                  {r.body}
                  {r.due_date && (
                    <span style={{ display: 'block', fontSize: 11, marginTop: 1,
                      color: flag ? '#B0342F' : 'var(--mist)', fontWeight: flag ? 800 : 400,
                      textTransform: flag ? 'uppercase' : 'none', letterSpacing: flag ? '.03em' : 0 }}>
                      {overdue ? 'Overdue' : dueToday ? 'Due today' : 'due'} · {new Date(r.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
