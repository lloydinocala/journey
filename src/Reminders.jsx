import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

const today = () => new Date().toISOString().slice(0, 10)

export default function Reminders({ orgId, profile }) {
  const [items, setItems] = useState([])
  const [body, setBody] = useState('')
  const [due, setDue] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!orgId) return
    const { data } = await supabase.from('office_reminders').select('*')
      .eq('org_id', orgId).order('done').order('due_date', { nullsFirst: false }).order('created_at', { ascending: false })
    setItems(data || [])
  }
  useEffect(() => { load() }, [orgId])

  async function add() {
    const t = body.trim(); if (!t || !orgId) return
    setSaving(true)
    await supabase.from('office_reminders').insert({ org_id: orgId, body: t, due_date: due || null, created_by: profile?.user_id || null })
    setSaving(false); setBody(''); setDue(''); load()
  }
  async function toggle(r) { await supabase.from('office_reminders').update({ done: !r.done, done_at: r.done ? null : new Date().toISOString() }).eq('id', r.id); load() }
  async function remove(r) { await supabase.from('office_reminders').delete().eq('id', r.id); load() }

  const open = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)
  const shown = showDone ? items : open

  return (
    <div className="section-card" style={{ padding: 16, marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>📝 Reminders &amp; Notes{open.length ? ` (${open.length})` : ''}</h3>
        {done.length > 0 && <button className="logout-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setShowDone((s) => !s)}>{showDone ? 'Hide done' : `Show done (${done.length})`}</button>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder="Add a note or reminder…" style={{ flex: 1, minWidth: 220, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} title="Optional due date" style={{ padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 8 }} />
        <button className="auth-button" style={{ width: 'auto' }} onClick={add} disabled={saving || !body.trim()}>Add</button>
      </div>
      {shown.length === 0 && <div style={{ color: 'var(--mist)', fontSize: 14 }}>Nothing on the list. 🎉</div>}
      {shown.map((r) => {
        const overdue = !r.done && r.due_date && r.due_date < today()
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--border)' }}>
            <input type="checkbox" checked={r.done} onChange={() => toggle(r)} style={{ width: 18, height: 18, flex: 'none' }} />
            <div style={{ flex: 1, textDecoration: r.done ? 'line-through' : 'none', color: r.done ? 'var(--mist)' : 'inherit', fontSize: 14.5 }}>
              {r.body}
              {r.due_date && <span style={{ marginLeft: 8, fontSize: 12, color: overdue ? '#B0342F' : 'var(--mist)', fontWeight: overdue ? 700 : 400 }}>· {overdue ? 'overdue ' : 'due '}{new Date(r.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            </div>
            <button className="logout-button" style={{ fontSize: 12, padding: '3px 9px', flex: 'none' }} onClick={() => remove(r)} title="Delete">✕</button>
          </div>
        )
      })}
    </div>
  )
}
