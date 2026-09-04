import { useEffect, useRef } from 'react'
import { supabase } from './utils/supabase'

// Reports the technician's position while they're inside the field app (mounted by
// TechGate, past the consent that already covers GPS). Foreground only — the web
// can't track a closed app. Refreshes every ~90s; upserts one row per user.
export default function TechLocationReporter({ profile }) {
  const timer = useRef(null)
  useEffect(() => {
    if (!profile?.user_id || !profile?.org_id || !('geolocation' in navigator)) return
    let cancelled = false
    const report = () => navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return
        await supabase.from('tech_locations').upsert({
          user_id: profile.user_id,
          org_id: profile.org_id,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      },
      () => { /* denied or unavailable — silently skip */ },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 }
    )
    report()
    timer.current = setInterval(report, 90000)
    return () => { cancelled = true; clearInterval(timer.current) }
  }, [profile?.user_id, profile?.org_id])
  return null
}
