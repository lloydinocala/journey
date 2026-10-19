import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Top-bar badge for call messages taken for you, plus a desktop notification when a new
// one arrives (asks the browser for permission the first time the badge is clicked).
export default function CallMessageNotifier({ profile }) {
  const [count, setCount] = useState(0)
  const seen = useRef(null)

  async function check() {
    if (!profile?.id || !profile?.org_id) return
    const { data } = await supabase.from('call_messages').select('id, kind, caller_name, message, urgent, created_at')
      .eq('to_user_id', profile.id).is('handled_at', null).order('created_at', { ascending: false }).limit(50)
    const list = data || []
    setCount(list.length)
    const ids = new Set(list.map((r) => r.id))
    if (seen.current) {
      const fresh = list.filter((r) => !seen.current.has(r.id))
      if (fresh.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const r = fresh[0]
        try {
          const n = new Notification(fresh.length > 1 ? `${fresh.length} new call messages` : `${r.urgent ? 'URGENT — ' : ''}Call message${r.caller_name ? ' from ' + r.caller_name : ''}`, { body: r.message || 'Open Team Communications to see it.', tag: 'journey-call-' + r.id })
          n.onclick = () => { window.focus(); window.location.href = '/team-communications' }
        } catch (e) { /* ignore */ }
      }
    }
    seen.current = ids
  }
  useEffect(() => {
    check()
    const t = setInterval(check, 30000)
    const on = () => check()
    window.addEventListener('call-messages-changed', on)
    return () => { clearInterval(t); window.removeEventListener('call-messages-changed', on) }
  }, [profile?.id])

  function askPermission() {
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission() } catch (e) { /* ignore */ }
  }
  if (!profile?.org_id) return null
  return (
    <Link to="/team-communications" onClick={askPermission} title={count ? `${count} call message${count === 1 ? '' : 's'} for you` : 'Team Communications'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: count ? '#DC2626' : 'rgba(255,255,255,0.14)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.28)', whiteSpace: 'nowrap' }}>
      <span aria-hidden="true">📨</span>{count ? ` ${count}` : ''}
    </Link>
  )
}
