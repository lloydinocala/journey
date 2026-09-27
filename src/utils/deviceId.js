// Stable per-device identity for the trusted time clock. A random token kept in
// localStorage — NOT a hardware fingerprint (privacy-friendly). It's how a punch
// and a Field App session are bound to one device: clocking in / opening the app
// claims this device as the single active one; any other device is locked out.
const KEY = 'jf_device_id'

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // Private mode / storage blocked — fall back to a per-load id (still works,
    // just won't persist, so it reads as a new device each open).
    return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
}

export function deviceLabel() {
  try {
    const ua = navigator.userAgent || ''
    const m = ua.match(/(iPhone|iPad|Android|Windows|Macintosh|Linux)[^;)]*/i)
    return (m ? m[0] : (navigator.platform || 'Device')).slice(0, 60)
  } catch { return 'Device' }
}

export function devicePlatform() {
  try { return (navigator.platform || null) } catch { return null }
}

// One best-effort GPS fix. Never rejects — resolves null if denied/unavailable,
// so a clock action is never blocked by location.
export function getPosition(timeoutMs = 8000) {
  return new Promise((resolve) => {
    try {
      if (!('geolocation' in navigator)) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: timeoutMs }
      )
    } catch { resolve(null) }
  })
}
