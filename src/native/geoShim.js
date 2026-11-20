// In the store apps, location comes from the native location engine (Transistorsoft), which the
// tech already allowed. Without this, the web view asks again ("… would like to use your
// location") whenever a screen reads the GPS — clock in/out, arrival detection, etc.
// Browsers are left alone.
import { Capacitor } from '@capacitor/core'

function toPosition(loc) {
  const c = loc?.coords || {}
  return {
    coords: {
      latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy ?? 0,
      altitude: c.altitude ?? null, altitudeAccuracy: c.altitude_accuracy ?? null,
      heading: c.heading ?? null, speed: c.speed ?? null,
    },
    timestamp: loc?.timestamp ? Date.parse(loc.timestamp) || Date.now() : Date.now(),
  }
}
const geoError = (code = 2, message = 'Location unavailable') => ({ code, message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })

let bgp = null
const bg = () => (bgp = bgp || import('@transistorsoft/capacitor-background-geolocation').then((m) => m.default || m.BackgroundGeolocation))

try {
  if (Capacitor.isNativePlatform() && typeof navigator !== 'undefined') {
    const watches = new Map()
    let nextId = 1
    const shim = {
      getCurrentPosition(ok, fail, opts = {}) {
        bg().then((BG) => BG.getCurrentPosition({
          samples: 1, persist: false,
          timeout: Math.max(1, Math.round((opts.timeout || 15000) / 1000)),
          maximumAge: opts.maximumAge ?? 30000,
          desiredAccuracy: opts.enableHighAccuracy === false ? 100 : -1,
        })).then((loc) => ok && ok(toPosition(loc)), (code) => fail && fail(geoError(code === 1 ? 1 : code === 408 ? 3 : 2)))
      },
      watchPosition(ok, fail, opts = {}) {
        const id = nextId++
        bg().then((BG) => {
          if (!watches.has(id)) return
          const sub = BG.watchPosition({ interval: 5000, persist: false, desiredAccuracy: opts.enableHighAccuracy === false ? 100 : -1 },
            (loc) => ok && ok(toPosition(loc)), () => fail && fail(geoError(2)))
          watches.set(id, sub)
        }).catch(() => fail && fail(geoError(2)))
        watches.set(id, null)
        return id
      },
      clearWatch(id) {
        const sub = watches.get(id)
        watches.delete(id)
        try { if (sub && typeof sub.remove === 'function') sub.remove() } catch { /* ignore */ }
      },
    }
    Object.defineProperty(navigator, 'geolocation', { value: shim, configurable: true })
  }
} catch { /* not in the app */ }
