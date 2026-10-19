import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Settings → WorkForce → Time off. When approval is ON, requests wait for someone with the
// "Approve time off" permission (they get each one in their Agent Inbox). When OFF, requests
// are approved the moment they're submitted. Either way the person shows as out on the
// Dispatch Station and Calendar, and the record stays in HR.
export default function TimeOffSettings({ orgId }) {
  const [on, setOn] = useState(true)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!orgId) return
    supabase.from('rewards_settings').select('time_off_approval_required').eq('org_id', orgId).maybeSingle()
      .then(({ data }) => setOn(data ? data.time_off_approval_required !== false : true))
  }, [orgId])
  async function save(v) {
    setOn(v)
    const { error } = await supabase.from('rewards_settings').upsert({ org_id: orgId, time_off_approval_required: v }, { onConflict: 'org_id' })
    setMsg(error ? 'Could not save: ' + error.message : 'Saved'); setTimeout(() => setMsg(''), 1800)
  }
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, cursor: 'pointer' }}>
        <input type="checkbox" checked={on} onChange={(e) => save(e.target.checked)} />
        Time-off requests need approval
        {msg && <span style={{ fontWeight: 600, fontSize: 12.5, color: msg.startsWith('Could') ? '#B42318' : '#15803D' }}>{msg}</span>}
      </label>
      <p style={{ fontSize: 13, color: 'var(--mist)', margin: '4px 0 0 24px' }}>
        {on
          ? <>Requests wait for someone with the <b>Approve time off</b> permission (admins and field managers by default — change it on <Link to="/roles">Roles &amp; Tags</Link>). Each request lands in their Agent Inbox.</>
          : <>Requests are approved automatically when submitted.</>}
        {' '}Approved time off shows on the Dispatch Station and Calendar so no one gets dispatched while out; the record stays in HR → Time Off.
      </p>
    </div>
  )
}
