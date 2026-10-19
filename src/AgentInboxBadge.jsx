import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Top-bar 🤖 badge: how many agent items are waiting on THIS person. The count comes
// straight from the database, which only returns items their roles & permissions cover.
export function notifyAgentInbox() { try { window.dispatchEvent(new Event('agent-inbox-changed')) } catch (e) { /* ignore */ } }

export default function AgentInboxBadge({ profile }) {
  const [count, setCount] = useState(0)
  const [urgent, setUrgent] = useState(0)

  async function check() {
    if (!profile?.id) return
    let q = supabase.from('agent_actions').select('id, priority').in('status', ['pending', 'failed']).limit(500)
    if (profile.org_id) q = q.eq('org_id', profile.org_id)
    const { data } = await q
    setCount((data || []).length)
    setUrgent((data || []).filter((r) => r.priority === 'urgent').length)
  }
  useEffect(() => {
    check()
    const t = setInterval(check, 60000)
    window.addEventListener('agent-inbox-changed', check)
    return () => { clearInterval(t); window.removeEventListener('agent-inbox-changed', check) }
  }, [profile?.id])

  if (!profile?.org_id && profile?.role !== 'super_admin') return null
  return (
    <Link to="/agent-inbox" title={count ? `${count} agent item${count === 1 ? '' : 's'} waiting on you${urgent ? ` (${urgent} urgent)` : ''}` : 'Agent Inbox'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: urgent ? '#DC2626' : count ? '#2E6FB5' : 'rgba(255,255,255,0.14)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.28)', whiteSpace: 'nowrap' }}>
      <span aria-hidden="true">🤖</span>{count ? ` ${count}` : ''}
    </Link>
  )
}

// Small banner for a record page: "The agent prepared something for this."
export function AgentDraftsBanner({ subjectId, skill, label }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    if (!subjectId && !skill) return
    let q = supabase.from('agent_actions').select('id, title').in('status', ['pending', 'failed']).limit(20)
    q = subjectId ? q.eq('subject_id', subjectId) : q.eq('skill_key', skill)
    q.then(({ data }) => setItems(data || []))
  }, [subjectId, skill])
  if (!items.length) return null
  const one = items.length === 1
  return (
    <Link to={'/agent-inbox' + (one ? '?focus=' + items[0].id : '')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#EEF4FB', border: '1px solid #C9DAEE', borderRadius: 10, padding: '9px 12px', margin: '10px 0', textDecoration: 'none', color: '#1F3A5F', fontSize: 13.5, fontWeight: 600 }}>
      <span aria-hidden="true">🤖</span>
      <span style={{ flex: 1 }}>{one ? `Agent prepared: ${items[0].title}` : `${items.length} agent ${label || 'items'} waiting for review`}</span>
      <span style={{ fontWeight: 800 }}>Review →</span>
    </Link>
  )
}
