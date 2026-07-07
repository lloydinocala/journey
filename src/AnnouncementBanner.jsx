import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

export default function AnnouncementBanner({ profile }) {
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    if (!profile?.org_id) return
    supabase
      .from('org_announcements')
      .select('id, severity, message')
      .or(`org_id.eq.${profile.org_id},org_id.is.null`)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setAnnouncements(data || []))
  }, [profile?.org_id])

  if (!profile?.org_id || announcements.length === 0) return null

  return (
    <>
      {announcements.map((a) => (
        <div key={a.id} className={`announcement-banner severity-${a.severity}`}>
          <span>{a.message}</span>
        </div>
      ))}
    </>
  )
}
