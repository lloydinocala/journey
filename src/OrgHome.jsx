import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

// Active placeholder home for organization users. For now it simply presents the
// company's name (and logo, if set) — a calm landing until a real org home
// dashboard is designed. Super-admins keep their own home; techs get the field app.
export default function OrgHome({ profile }) {
  const [org, setOrg] = useState(null)

  useEffect(() => {
    if (!profile?.org_id) return
    supabase
      .from('organizations')
      .select('name, logo_url, brand_primary_color')
      .eq('id', profile.org_id)
      .single()
      .then(({ data }) => setOrg(data))
  }, [profile?.org_id])

  const primary = org?.brand_primary_color || '#1B3A6B'

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
      }}
    >
      {org?.logo_url && (
        <img
          src={org.logo_url}
          alt={org?.name || ''}
          style={{ maxHeight: 96, maxWidth: 340, marginBottom: 22, objectFit: 'contain' }}
        />
      )}
      <h1 style={{ fontSize: 40, fontWeight: 800, color: primary, margin: 0, letterSpacing: '-0.5px' }}>
        {org?.name || ' '}
      </h1>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 14 }}>
        Your home dashboard is coming soon.
      </p>
    </div>
  )
}
