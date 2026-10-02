import { useEffect, useRef } from 'react'
import { supabase } from './utils/supabase'

// Reports the technician's position LIVE while they're inside the field app (mounted by
// TechGate, past the consent that already covers GPS). Uses watchPosition for continuous
// updates and writes to tech_locations at most every ~30s, or sooner when they've moved
// ~40m, so the Dispatch Map shows movement in near-real-time without hammering the database.
// Foreground only — a browser can't track a closed app (that's Phase 4: a native wrapper or
// truck GPS hardware).
function meters(aLat, aLng, bLat, bLng) {
  const R = 6371000, toR = Math.PI / 180
  const dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export default function TechLocationReporter({ profile }) {
  const last = useRef({ t: 0, lat: null, lng: null })
  useEffect(() => {
    if (!profile?.user_id || !profile?.org_id || !('geolocation' in navigator)) return
    let cancelled = false

    async function write(pos) {
      if (cancelled) return
      const { latitude, longitude, accuracy } = pos.coords
      const now = Date.now()
      const moved = last.current.lat == null ? Infinity : meters(last.current.lat, last.current.lng, latitude, longitude)
      // Throttle: skip unless 30s have passed or they've moved more than ~40m.
      if (now - last.current.t < 30000 && moved < 40) return
      last.current = { t: now, lat: latitude, lng: longitude }
      await supabase.from('tech_locations').upsert({
        user_id: profile.user_id,
        org_id: profile.org_id,
        latitude,
        longitude,
        accuracy,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => write(pos),
      () => { /* denied or unavailable — silently skip */ },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    )
    return () => { cancelled = true; navigator.geolocation.clearWatch(watchId) }
  }, [profile?.user_id, profile?.org_id])
  return null
}
