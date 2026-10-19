import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { HANDLING, HANDLING_SHORT } from './utils/callHandling'

// "When a call comes in for me" — each person sets how the receptionist/dispatcher
// handles calls meant for them. adminMode lists everyone so an admin can set it for
// the whole management team. Live transfer/forwarding happens on the phone today and
// will be automated when the phone system is connected.
function PrefEditor({ orgId, userId, initial, onSaved }) {
  const [p, setP] = useState(initial || { handling: 'message', fallback: 'message', forward_phone: '', instructions: '' })
  const [saved, setSaved] = useState(false)
  useEffect(() => { setP(initial || { handling: 'message', fallback: 'message', forward_phone: '', instructions: '' }) }, [initial])
  async function save() {
    await supabase.from('call_handling_prefs').upsert({ user_id: userId, org_id: orgId, handling: p.handling, fallback: p.fallback || null, forward_phone: p.forward_phone || null, instructions: p.instructions || null, updated_at: new Date().toISOString() })
    setSaved(true); setTimeout(() => setSaved(false), 2000); onSaved && onSaved()
  }
  const sel = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 7 }
  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
      <label style={{ fontSize: 13 }}>First choice
        <select value={p.handling} onChange={(e) => setP({ ...p, handling: e.target.value })} style={{ ...sel, display: 'block', width: '100%', marginTop: 4 }}>
          {Object.entries(HANDLING).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label style={{ fontSize: 13 }}>If that isn&rsquo;t possible
        <select value={p.fallback || ''} onChange={(e) => setP({ ...p, fallback: e.target.value })} style={{ ...sel, display: 'block', width: '100%', marginTop: 4 }}>
          <option value="">— nothing else —</option>
          {Object.entries(HANDLING).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      {(p.handling === 'forward' || p.fallback === 'forward') && (
        <label style={{ fontSize: 13 }}>Cell phone to forward to
          <input value={p.forward_phone || ''} onChange={(e) => setP({ ...p, forward_phone: e.target.value })} placeholder="352-555-0100" style={{ ...sel, display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }} />
        </label>
      )}
      <label style={{ fontSize: 13 }}>Notes for the receptionist (optional)
        <input value={p.instructions || ''} onChange={(e) => setP({ ...p, instructions: e.target.value })} placeholder="e.g. Vendors: always take a message. Customers with emergencies: forward." style={{ ...sel, display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }} />
      </label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '8px 18px' }} onClick={save}>Save</button>
        {saved && <span style={{ color: '#1a7f37', fontSize: 13, fontWeight: 700 }}>Saved ✓</span>}
      </div>
    </div>
  )
}

export default function CallHandlingPrefs({ profile, orgId, adminMode = false }) {
  const org = orgId || profile?.org_id
  const [mine, setMine] = useState(null)
  const [all, setAll] = useState([])
  const [users, setUsers] = useState([])
  const [editing, setEditing] = useState(null)

  async function load() {
    if (!org) return
    if (adminMode) {
      const [{ data: u }, { data: prefs }] = await Promise.all([
        supabase.from('users').select('id, full_name, role').eq('org_id', org).eq('is_active', true).neq('role', 'tech').order('full_name'),
        supabase.from('call_handling_prefs').select('*').eq('org_id', org),
      ])
      setUsers(u || []); setAll(prefs || [])
    } else if (profile?.id) {
      const { data } = await supabase.from('call_handling_prefs').select('*').eq('user_id', profile.id).maybeSingle()
      setMine(data || null)
    }
  }
  useEffect(() => { load() }, [org, adminMode])

  if (!org) return null
  if (!adminMode) {
    return (
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: 'var(--mist)', fontSize: 13.5, margin: '0 0 12px', maxWidth: 640 }}>How the receptionist or dispatcher handles calls meant for you. They see this when they take a call for you, and you get a notification for every message or appointment they log.</p>
        <PrefEditor orgId={org} userId={profile.id} initial={mine} onSaved={load} />
      </div>
    )
  }
  const prefFor = (id) => all.find((p) => p.user_id === id)
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ color: 'var(--mist)', fontSize: 13.5, margin: '0 0 12px', maxWidth: 640 }}>How calls for each office/management team member are handled. Everyone can also set their own under My Preferences. Anyone not set defaults to “Take a message.”</p>
      <table className="data-table" style={{ maxWidth: 820 }}>
        <thead><tr><th>Team member</th><th>First choice</th><th>Otherwise</th><th>Cell</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => {
            const p = prefFor(u.id)
            return (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td>{HANDLING_SHORT[p?.handling || 'message']}</td>
                <td>{p?.fallback ? HANDLING_SHORT[p.fallback] : '—'}</td>
                <td>{p?.forward_phone || '—'}</td>
                <td><button className="logout-button" onClick={() => setEditing(editing === u.id ? null : u.id)}>{editing === u.id ? 'Close' : 'Edit'}</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {editing && (
        <div className="section-card" style={{ padding: 14, marginTop: 12, maxWidth: 600 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{users.find((u) => u.id === editing)?.full_name}</div>
          <PrefEditor orgId={org} userId={editing} initial={prefFor(editing)} onSaved={() => { load(); setEditing(null) }} />
        </div>
      )}
    </div>
  )
}
