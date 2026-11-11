// The store app's native features (Android now, iPhone once it's built). On a browser every
// function here quietly does nothing, so the web Field App is unchanged.
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core'
import { supabase, SUPABASE_URL, SUPABASE_KEY } from '../utils/supabase'

export const isNative = () => { try { return Capacitor.isNativePlatform() } catch { return false } }
export const platform = () => { try { return Capacitor.getPlatform() } catch { return 'web' } }
export const JourneyCalls = registerPlugin('JourneyCalls')
// The background-location plugin ships native code only; its JS side is just this registration.
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation')

// ---------- device key ----------
// Each phone gets its own key at sign-in, so GPS and calls can be reported from the background
// (where the sign-in token can't be refreshed). Cleared on sign-out.
const KEY = 'journey_device_key'
export async function deviceKey(profile) {
  const uid = profile?.id || profile?.user_id
  if (!uid) return null
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (saved?.uid === uid && saved.key) return saved.key
  } catch { /* ignore */ }
  const { data, error } = await supabase.rpc('register_field_device', { p_platform: platform(), p_app_version: '1' })
  if (error || !data) return null
  try { localStorage.setItem(KEY, JSON.stringify({ uid, key: data })) } catch { /* ignore */ }
  return data
}

async function rpcWithKey(fn, body) {
  // Native HTTP keeps working when Android slows down the app's web view in the background.
  const res = await CapacitorHttp.post({
    url: `${SUPABASE_URL}/rest/v1/rpc/${fn}`,
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    data: body,
    connectTimeout: 15000,
    readTimeout: 15000,
  })
  if (res.status >= 400) {
    const err = new Error(typeof res.data === 'object' ? res.data?.message : String(res.data))
    err.status = res.status
    throw err
  }
  return res.data
}

// ---------- constant GPS ----------
const GPS_BUF = 'journey_gps_buffer'
let gpsWatcher = null
let lastKept = null
let flushingGps = false
const meters = (a, b) => {
  const R = 6371000, r = Math.PI / 180
  const s = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
const readBuf = () => { try { return JSON.parse(localStorage.getItem(GPS_BUF) || '[]') } catch { return [] } }
const writeBuf = (b) => { try { localStorage.setItem(GPS_BUF, JSON.stringify(b.slice(-3000))) } catch { /* full */ } }

async function flushGps(key) {
  if (flushingGps || !key) return
  const buf = readBuf()
  if (!buf.length) return
  flushingGps = true
  try {
    for (let i = 0; i < buf.length; i += 500) await rpcWithKey('report_locations', { p_key: key, p_points: buf.slice(i, i + 500) })
    writeBuf(readBuf().slice(buf.length)) // keep anything that arrived meanwhile
  } catch (e) {
    if (e.status === 400 && /Unknown device/i.test(e.message || '')) { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }
    // No signal: the points stay on the phone and go up with the next send.
  } finally { flushingGps = false }
}

export async function startGps(profile) {
  if (!isNative() || gpsWatcher) return
  const key = await deviceKey(profile)
  if (!key) return
  gpsWatcher = await BackgroundGeolocation.addWatcher({
    backgroundTitle: 'Journey',
    backgroundMessage: 'Sharing your location with your company while Journey is running.',
    requestPermissions: true,
    stale: false,
    distanceFilter: 25,
  }, (loc, err) => {
    if (err || !loc) return
    const pt = { lat: loc.latitude, lng: loc.longitude, acc: loc.accuracy, t: new Date(loc.time || Date.now()).toISOString() }
    // Keep a point every 30 seconds, or sooner after moving 40 m.
    if (lastKept && Date.now() - lastKept.ms < 30000 && meters(lastKept, pt) < 40) return
    lastKept = { ...pt, ms: Date.now() }
    const buf = readBuf(); buf.push(pt); writeBuf(buf)
    flushGps(key)
  }).catch(() => null)
  setInterval(() => flushGps(key), 120000)
}

export async function stopGps() {
  if (!gpsWatcher) return
  try { await BackgroundGeolocation.removeWatcher({ id: gpsWatcher }) } catch { /* ignore */ }
  gpsWatcher = null
}

// ---------- calls ----------
const CALL_SYNC = 'journey_calls_synced_at'
export async function setupCalls(profile) {
  if (!isNative() || platform() !== 'android') return
  const key = await deviceKey(profile)
  if (!key) return
  const { data: directory } = await supabase.rpc('caller_directory')
  await JourneyCalls.configure({ deviceKey: key, apiUrl: SUPABASE_URL, apiKey: SUPABASE_KEY, directory: Array.isArray(directory) ? directory : undefined }).catch(() => {})
  syncCallLog(profile)
}

let syncingCalls = false
// Finished calls from the phone's call history go into Call Logs (business callers and numbers
// Journey doesn't know yet; personal contacts are skipped). Only calls since the app was set up.
export async function syncCallLog(profile) {
  if (!isNative() || platform() !== 'android' || syncingCalls) return
  syncingCalls = true
  try {
    const st = await JourneyCalls.status()
    if (!st.callLog) return
    const key = await deviceKey(profile)
    if (!key) return
    let since = Number(localStorage.getItem(CALL_SYNC) || 0)
    if (!since) { since = Date.now(); localStorage.setItem(CALL_SYNC, String(since)); return }
    const { calls } = await JourneyCalls.recentCalls({ since })
    for (const c of calls || []) {
      if (c.personal || !['answered', 'missed'].includes(c.event)) { localStorage.setItem(CALL_SYNC, String(c.at)); continue }
      await rpcWithKey('report_call_event', { p_key: key, p_phone: c.phone, p_event: c.event, p_duration: c.duration, p_at: new Date(c.at).toISOString(), p_ext_id: `log:${c.id}` })
      localStorage.setItem(CALL_SYNC, String(c.at))
    }
  } catch { /* no signal — next time */ } finally { syncingCalls = false }
}

export async function callStatus() {
  if (!isNative() || platform() !== 'android') return null
  try { return await JourneyCalls.status() } catch { return null }
}

// ---------- sign-out ----------
export async function nativeSignOut() {
  if (!isNative()) return
  await stopGps()
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (saved?.key) await supabase.rpc('revoke_my_field_device', { p_key: saved.key })
  } catch { /* ignore */ }
  try { localStorage.removeItem(KEY); localStorage.removeItem(GPS_BUF); localStorage.removeItem(CALL_SYNC) } catch { /* ignore */ }
  if (platform() === 'android') await JourneyCalls.signOut().catch(() => {})
}
