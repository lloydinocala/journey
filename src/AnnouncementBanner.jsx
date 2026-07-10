import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

export default function AnnouncementBanner({ profile }) {
  const [announcements, setAnnouncements] = useState([])
  const isSuperAdmin = profile?.role === 'super_admin'

  useEffect(() => {
    if (!profile) return

    if (isSuperAdmin) {
      supabase
        .from('org_announcements')
        .select('id, severity, message, org_id, organizations(name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .then(({ data }) => setAnnouncements(data || []))
      return
    }

    if (!profile.org_id) return
    supabase
      .from('org_announcements')
      .select('id, severity, message, org_id, organizations(name)')
      .or(`org_id.eq.${profile.org_id},org_id.is.null`)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setAnnouncements(data || []))
  }, [profile?.org_id, profile?.role])

  if (!profile || announcements.length === 0) return null
  if (!isSuperAdmin && !profile.org_id) return null

  return (
    <>
      {announcements.map((a) => (
        <div key={a.id} className={`announcement-banner severity-${a.severity}`}>
          <span>
            {isSuperAdmin && (a.organizations?.name ? `[${a.organizations.name}] ` : '[All orgs] ')}
            {a.message}
          </span>
        </div>
      ))}
    </>
  )
}
