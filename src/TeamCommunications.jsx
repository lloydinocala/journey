import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import TakeCallModal from './TakeCallModal'
import { MSG_KIND } from './utils/callHandling'
import { can } from './utils/permissions'
import { isSettingsAdmin } from './utils/settingsMap'
import { formatDateTimeInZone } from './utils/tz'

// WorkForce → Team Communications: calls taken for team members (messages, appointment
// requests, transfers/forwards) plus the Text Archive. Each person sees their own inbox;
// reception and admins can see everyone's.
const fmt = (t) => (t ? formatDateTimeInZone(t, undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

export default function TeamCommunications({ profile }) {
  const org = profile?.org_id
  const seeAll = isSettingsAdmin(profile) || can(profile, 'view_text_archive') || can(profile, 'dispatch_messaging_poc')
  const [tab, setTab] = useState('mine')
  const [rows, setRows] = useState([])
  const [users, setUsers] = useState([])
  const [showHandled, setShowHandled] = useState(false)
  const [taking, setTaking] = useState(false)

  async function load() {
    if (!org) return
    let q = supabase.from('call_messages').select('*').eq('org_id', org).order('created_at', { ascending: false }).limit(300)
    if (tab === 'mine') q = q.eq('to_user_id', profile.id)
    if (!showHandled) q = q.is('handled_at', null)
    const [{ data }, { data: u }] = await Promise.all([q, supabase.from('users').select('id, full_name').eq('org_id', org)])
    setRows(data || []); setUsers(u || [])
    // Opening your inbox marks your new messages as read (the notification badge clears).
    const unread = (data || []).filter((r) => r.to_user_id === profile.id && !r.read_at).map((r) => r.id)
    if (unread.length) supabase.from('call_messages').update({ read_at: new Date().toISOString() }).in('id', unread).then(() => window.dispatchEvent(new Event('call-messages-changed')))
  }
  useEffect(() => { load() }, [org, tab, showHandled])

  const name = (id) => users.find((u) => u.id === id)?.full_name || '—'
  async function setHandled(r, on) {
    await supabase.from('call_messages').update({ handled_at: on ? new Date().toISOString() : null }).eq('id', r.id)
    window.dispatchEvent(new Event('call-messages-changed')); load()
  }

  const tabBtn = (k, l) => <button onClick={() => setTab(k)} className={tab === k ? 'auth-button' : 'logout-button'} style={{ width: 'auto', padding: '6px 16px', margin: 0 }}>{l}</button>
  return (
    <div style={{ maxWidth: 1000 }}>
      <div className="page-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Team Communications</h2>
        <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={() => setTaking(true)}>📞 Take a call for…</button>
      </div>
      <p style={{ color: 'var(--mist)', fontSize: 13.5, marginTop: 0 }}>
        Calls taken for team members. Each person sets how their calls are handled under Settings → My Preferences, and gets a desktop notification for every message.
        Customer text threads are in the <Link to="/text-archive">Text Archive</Link>.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        {tabBtn('mine', 'My call messages')}
        {seeAll && tabBtn('all', 'Everyone')}
        <Link to="/text-archive" className="logout-button" style={{ textDecoration: 'none', padding: '6px 16px' }}>Text Archive</Link>
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}><input type="checkbox" checked={showHandled} onChange={(e) => setShowHandled(e.target.checked)} /> Show handled</label>
      </div>
      {rows.length === 0 ? <p style={{ color: 'var(--mist)' }}>No {showHandled ? '' : 'open '}call messages.</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} className="section-card" style={{ padding: 14, borderLeft: `4px solid ${r.urgent ? '#DC2626' : r.handled_at ? 'var(--border)' : '#176E7A'}`, opacity: r.handled_at ? 0.7 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <strong>{MSG_KIND[r.kind] || r.kind}</strong>{r.urgent && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: '#fff', background: '#DC2626', borderRadius: 6, padding: '1px 7px' }}>URGENT</span>}
                  {tab === 'all' && <span style={{ color: 'var(--mist)' }}> · for {name(r.to_user_id)}</span>}
                  <div style={{ fontSize: 13.5, marginTop: 2 }}>{[r.caller_name, r.caller_phone].filter(Boolean).join(' · ') || 'Caller not recorded'}{r.caller_phone && <> · <a href={`tel:${r.caller_phone}`}>call back</a></>}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--mist)', textAlign: 'right' }}>{fmt(r.created_at)}<div>taken by {name(r.taken_by)}</div></div>
              </div>
              {r.appointment_at && <div style={{ marginTop: 6, fontWeight: 700 }}>📅 {fmt(r.appointment_at)}</div>}
              {r.message && <div style={{ marginTop: 6, fontSize: 14, whiteSpace: 'pre-wrap' }}>{r.message}</div>}
              <div style={{ marginTop: 8 }}>
                {r.handled_at
                  ? <button className="logout-button" onClick={() => setHandled(r, false)}>Reopen</button>
                  : <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '6px 14px' }} onClick={() => setHandled(r, true)}>Mark handled</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {taking && <TakeCallModal profile={profile} orgId={org} onClose={() => setTaking(false)} onDone={load} />}
    </div>
  )
}
