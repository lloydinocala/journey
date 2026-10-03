import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Customer-facing live arrival tracking — public, no login. Reached at /track/:token from
// the link in the "On My Way" text/email. Polls the token-gated track-status edge function
// and shows the technician approaching on a map with a live ETA. Think "your driver is
// 8 minutes away." Self-contained styling so it looks right for a homeowner on a phone.

const POLL_MS = 15000

function agoLabel(iso) {
  if (!iso) return ''
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 15) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  return `${m} min ago`
}

export default function PublicTrack() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0) // re-render for the "updated Xs ago" label

  const mapRef = useRef(null)
  const elRef = useRef(null)
  const techMarker = useRef(null)
  const destMarker = useRef(null)
  const lineRef = useRef(null)

  async function poll() {
    try {
      const { data: d, error } = await supabase.functions.invoke('track-status', { body: { token } })
      if (error) { setErr('network'); setLoading(false); return }
      if (!d?.ok) { setData({ ended: true, reason: d?.reason }); setLoading(false); return }
      setData(d); setErr(''); setLoading(false)
    } catch {
      setErr('network'); setLoading(false)
    }
  }

  useEffect(() => { poll(); /* first load */ }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll on an interval while the trip is live; stop once it ends.
  useEffect(() => {
    if (data?.ended || data?.status === 'ended') return
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [data?.ended, data?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the "updated Xs ago" label ticking.
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 5000); return () => clearInterval(id) }, [])

  // Build/refresh the Leaflet map whenever positions change.
  useEffect(() => {
    if (!data || data.ended || !data.dest || !window.L || !elRef.current) return
    const L = window.L
    if (!mapRef.current) {
      const map = L.map(elRef.current, { zoomControl: true, attributionControl: true })
        .setView([data.dest.lat, data.dest.lng], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map)
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 200)
    }
    const map = mapRef.current

    // Destination (the customer's home).
    if (!destMarker.current) {
      const icon = L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 32], html:
        `<div style="font-size:26px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">🏠</div>` })
      destMarker.current = L.marker([data.dest.lat, data.dest.lng], { icon }).addTo(map)
    }

    // Technician (moving).
    if (data.tech) {
      const color = data.org?.color || '#2F5DE3'
      const icon = L.divIcon({ className: '', iconSize: [40, 40], iconAnchor: [20, 20], html:
        `<div style="background:${color};width:36px;height:36px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:20px">🚚</div>` })
      if (!techMarker.current) techMarker.current = L.marker([data.tech.lat, data.tech.lng], { icon, zIndexOffset: 1000 }).addTo(map)
      else techMarker.current.setLatLng([data.tech.lat, data.tech.lng])

      // Straight connector line (just a visual tie; the ETA itself is road-accurate).
      const pts = [[data.tech.lat, data.tech.lng], [data.dest.lat, data.dest.lng]]
      if (!lineRef.current) lineRef.current = L.polyline(pts, { color, weight: 3, opacity: 0.5, dashArray: '4,8' }).addTo(map)
      else lineRef.current.setLatLngs(pts)
      try { map.fitBounds(pts, { padding: [60, 60], maxZoom: 14 }) } catch { /* ignore */ }
    } else {
      try { map.setView([data.dest.lat, data.dest.lng], 13) } catch { /* ignore */ }
    }
  }, [data])

  // ---- rendering ----------------------------------------------------------
  const wrap = { minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', display: 'flex', flexDirection: 'column' }
  const brand = data?.org?.color || '#2F5DE3'

  if (loading) {
    return <div style={{ ...wrap, alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading…</div>
  }

  if (err === 'network' && !data) {
    return (
      <div style={{ ...wrap, alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: '#64748b' }}>
        <div>Couldn’t load tracking right now. Please check your connection and reopen the link.</div>
      </div>
    )
  }

  if (data?.ended || data?.status === 'ended') {
    return (
      <div style={{ ...wrap, alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✓</div>
          <h2 style={{ margin: '0 0 8px', color: '#0f172a' }}>This visit is complete</h2>
          <p style={{ color: '#64748b', margin: 0 }}>Live tracking for this appointment has ended. Thanks for choosing {data?.org?.name || 'us'}.</p>
        </div>
      </div>
    )
  }

  const arrived = data?.status === 'arrived'
  const name = data?.techName || 'Your technician'

  return (
    <div style={wrap}>
      {/* Header band */}
      <div style={{ background: brand, color: '#fff', padding: '18px 20px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 600, letterSpacing: 0.3 }}>{data?.org?.name || 'Your service provider'}</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
          {arrived ? `${name} has arrived` : `${name} is on the way`}
        </div>
        {!arrived && data?.etaClock && (
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'baseline', gap: 8, background: 'rgba(255,255,255,.16)', borderRadius: 999, padding: '8px 18px' }}>
            <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{data.etaMinutes}</span>
            <span style={{ fontSize: 14, opacity: 0.95 }}>min away · arriving ~{data.etaClock}</span>
          </div>
        )}
        {!arrived && !data?.etaClock && (
          <div style={{ marginTop: 10, fontSize: 14, opacity: 0.95 }}>
            {data?.tech ? 'Calculating arrival time…' : 'Live location will appear here shortly.'}
          </div>
        )}
      </div>

      {/* Map */}
      <div style={{ position: 'relative', flex: 1, minHeight: 320 }}>
        <div ref={elRef} style={{ position: 'absolute', inset: 0 }} />
        {!data?.tech && !arrived && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', pointerEvents: 'none' }}>
            <span style={{ background: '#fff', color: '#64748b', fontSize: 12.5, padding: '6px 12px', borderRadius: 999, boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}>
              Waiting for the technician’s location…
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', padding: '12px 20px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
        {data?.tech?.updatedAt && !arrived && <div style={{ marginBottom: data?.org?.phone ? 6 : 0 }}>Location updated {agoLabel(data.tech.updatedAt)}</div>}
        {data?.org?.phone && <div>Questions? <a href={`tel:${data.org.phone}`} style={{ color: brand, fontWeight: 700, textDecoration: 'none' }}>Call {data.org.phone}</a></div>}
      </div>
    </div>
  )
}
