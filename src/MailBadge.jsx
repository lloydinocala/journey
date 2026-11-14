import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Unread email for the mailboxes this person can see (only shows when they have one).
function useMailboxes(profile) {
  const [boxes, setBoxes] = useState([])
  useEffect(() => {
    if (!profile?.id) return undefined
    let live = true
    const check = () => supabase.rpc('mail_unread_counts').then(({ data }) => { if (live) setBoxes(data || []) })
    check()
    const t = setInterval(check, 60000)
    window.addEventListener('mail-changed', check)
    return () => { live = false; clearInterval(t); window.removeEventListener('mail-changed', check) }
  }, [profile?.id])
  return boxes
}

// Top-bar ✉ badge.
export default function MailBadge({ profile }) {
  const boxes = useMailboxes(profile)
  if (!boxes.length) return null
  const unread = boxes.reduce((n, b) => n + Number(b.unread || 0), 0)
  return (
    <Link to="/mail" title={unread ? `${unread} unread email${unread === 1 ? '' : 's'}` : 'Inbox'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: unread ? '#2E6FB5' : 'rgba(255,255,255,0.14)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.28)', whiteSpace: 'nowrap' }}>
      <span aria-hidden="true">✉️</span>{unread ? ` ${unread}` : ''}
    </Link>
  )
}

// Dashboard card: one line per mailbox with its unread count.
export function MailCard({ profile }) {
  const boxes = useMailboxes(profile)
  if (!boxes.length) return null
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      {boxes.map((b) => {
        const n = Number(b.unread || 0)
        return (
          <Link key={b.mailbox_id} to="/mail"
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: `1px solid ${n ? '#2E6FB5' : '#CBD5E1'}`, borderLeft: `5px solid ${n ? '#2E6FB5' : '#CBD5E1'}`, borderRadius: 10, padding: '10px 14px', textDecoration: 'none', color: '#1E293B', minWidth: 260 }}>
            <span aria-hidden="true" style={{ fontSize: 22 }}>✉️</span>
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              <span style={{ fontWeight: 800, fontSize: 14.5 }}>{b.name} Inbox</span>
              <span style={{ fontSize: 12.5, color: '#64748B' }}>{b.address}</span>
            </span>
            <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 13.5, color: n ? '#2E6FB5' : '#64748B', whiteSpace: 'nowrap' }}>{n ? `${n} unread` : 'All read'} →</span>
          </Link>
        )
      })}
    </div>
  )
}
