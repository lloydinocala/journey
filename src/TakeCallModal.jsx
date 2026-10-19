import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { HANDLING, HANDLING_SHORT } from './utils/callHandling'
import { zonedToUtcIso } from './utils/tz'

// "Take a call for…" — the receptionist picks who the call is for, sees exactly how that
// person wants it handled, and logs what happened. Every outcome notifies the recipient
// (in-app + desktop). Live transfer/forward is done on the phone for now; this records it.
export default function TakeCallModal({ profile, orgId, onClose, onDone }) {
  const org = orgId || profile?.org_id
  const [users, setUsers] = useState([])
  const [prefs, setPrefs] = useState([])
  const [toId, setToId] = useState('')
  const [mode, setMode] = useState('')
  const [callerName, setCallerName] = useState('')
  const [callerPhone, setCallerPhone] = useState('')
  const [message, setMessage] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [apptDate, setApptDate] = useState('')
  const [apptTime, setApptTime] = useState('09:00')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!org) return
    Promise.all([
      supabase.from('users').select('id, full_name, role').eq('org_id', org).eq('is_active', true).order('full_name'),
      supabase.from('call_handling_prefs').select('*').eq('org_id', org),
    ]).then(([{ data: u }, { data: p }]) => { setUsers(u || []); setPrefs(p || []) })
  }, [org])

  const pref = prefs.find((p) => p.user_id === toId) || (toId ? { handling: 'message' } : null)
  const person = users.find((u) => u.id === toId)
  useEffect(() => { setMode(pref?.handling || '') }, [toId])

  async function log(kind) {
    setErr('')
    if (!toId) { setErr('Choose who the call is for.'); return }
    if ((kind === 'message' || kind === 'appointment') && !callerName.trim() && !callerPhone.trim()) { setErr('Add the caller’s name or phone number.'); return }
    if (kind === 'message' && !message.trim()) { setErr('Write the message.'); return }
    if (kind === 'appointment' && !apptDate) { setErr('Pick the appointment date.'); return }
    setSaving(true)
    const { error } = await supabase.from('call_messages').insert({
      org_id: org, to_user_id: toId, taken_by: profile?.id || null, kind,
      caller_name: callerName.trim() || null, caller_phone: callerPhone.trim() || null,
      message: message.trim() || null, urgent,
      appointment_at: kind === 'appointment' ? zonedToUtcIso(apptDate, apptTime) : null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onDone && onDone(); onClose()
  }

  const input = { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, width: '100%', boxSizing: 'border-box' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,34,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(20,26,34,.28)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Take a call for…</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--mist)' }}>×</button>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'grid', gap: 10 }}>
          <select value={toId} onChange={(e) => setToId(e.target.value)} style={input}>
            <option value="">Who is the call for?</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          {pref && (
            <div style={{ background: '#F5F8FF', border: '1px solid #D8E2F5', borderRadius: 8, padding: '10px 12px', fontSize: 13.5 }}>
              <div><strong>{person?.full_name}&rsquo;s instructions:</strong> {HANDLING[pref.handling]}{pref.handling === 'forward' && pref.forward_phone ? ` — ${pref.forward_phone}` : ''}.</div>
              {pref.fallback && <div style={{ marginTop: 2 }}>If not possible: {HANDLING[pref.fallback]}{pref.fallback === 'forward' && pref.forward_phone ? ` — ${pref.forward_phone}` : ''}.</div>}
              {pref.instructions && <div style={{ marginTop: 4, color: 'var(--mist)' }}>“{pref.instructions}”</div>}
            </div>
          )}
          {toId && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['transfer', 'forward', 'message', 'appointment'].map((k) => (
                <button key={k} type="button" onClick={() => setMode(k)} style={{ border: '1px solid ' + (mode === k ? '#176E7A' : 'var(--border)'), background: mode === k ? '#176E7A' : '#fff', color: mode === k ? '#fff' : '#176E7A', borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {HANDLING_SHORT[k]}{pref && (pref.handling === k) ? ' ★' : ''}
                </button>
              ))}
            </div>
          )}
          {toId && mode && (<>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={callerName} onChange={(e) => setCallerName(e.target.value)} placeholder="Caller name" style={input} />
              <input value={callerPhone} onChange={(e) => setCallerPhone(e.target.value)} placeholder="Caller phone" style={input} />
            </div>
            {(mode === 'message' || mode === 'appointment') && (
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder={mode === 'message' ? 'Message' : 'What the appointment is about'} style={input} />
            )}
            {mode === 'appointment' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} style={input} />
                <input type="time" value={apptTime} onChange={(e) => setApptTime(e.target.value)} style={input} />
              </div>
            )}
            {(mode === 'transfer' || mode === 'forward') && (
              <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>
                {mode === 'transfer' ? 'Transfer the call on your phone, then log it here so they know who called.' : `Forward on your phone${pref?.forward_phone ? ' to ' + pref.forward_phone : ''}, then log it here.`} Live transfer/forward becomes one click when the phone system is connected.
              </div>
            )}
            <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Urgent</label>
          </>)}
          {err && <div style={{ color: '#B5462F', fontSize: 13, fontWeight: 600 }}>{err}</div>}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          {mode === 'message' && <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={saving} onClick={() => log('message')}>{saving ? 'Saving…' : 'Send message'}</button>}
          {mode === 'appointment' && <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={saving} onClick={() => log('appointment')}>{saving ? 'Saving…' : 'Book & notify'}</button>}
          {mode === 'transfer' && <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={saving} onClick={() => log('transferred')}>Log transfer & notify</button>}
          {mode === 'forward' && <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={saving} onClick={() => log('forwarded')}>Log forward & notify</button>}
          <button className="logout-button" style={{ margin: 0 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
