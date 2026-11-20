// The store app's native features (Android now, iPhone once it's built). On a browser every
// function here quietly does nothing, so the web Field App is unchanged.
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core'
import { supabase, SUPABASE_URL, SUPABASE_KEY } from '../utils/supabase'

export const isNative = () => { try { return Capacitor.isNativePlatform() } catch { return false } }
export const platform = () => { try { return Capacitor.getPlatform() } catch { return 'web' } }
export const JourneyCalls = registerPlugin('JourneyCalls')

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
// Transistorsoft Background Geolocation: native tracking that keeps going in the background,
// after the app is closed and after the phone restarts, for as long as the tech is signed in.
// Points are stored on the phone (SQLite) and uploaded natively to the field-gps function,
// so no signal / a closed app never loses them. Signing out is the only thing that stops it.
const GPS_URL = `${SUPABASE_URL}/functions/v1/field-gps`
let gpsReady = false
async function bgGeo() {
  const mod = await import('@transistorsoft/capacitor-background-geolocation')
  return mod.default || mod.BackgroundGeolocation
}

export async function startGps(profile) {
  if (!isNative()) return
  const key = await deviceKey(profile)
  if (!key) return
  try {
    const BG = await bgGeo()
    if (!gpsReady) {
      gpsReady = true
      await BG.ready({
        reset: true,
        geolocation: {
          desiredAccuracy: BG.DesiredAccuracy.High,
          distanceFilter: 25,
          stopTimeout: 5,
          locationAuthorizationRequest: 'Always',
          showsBackgroundLocationIndicator: true,
        },
        app: {
          stopOnTerminate: false,
          startOnBoot: true,
          heartbeatInterval: 600,
          notification: { title: 'Journey', text: 'Sharing your location with your company while you are signed in.' },
        },
        http: {
          url: GPS_URL,
          headers: { 'x-device-key': key },
          autoSync: true,
          batchSync: true,
          maxBatchSize: 250,
          rootProperty: 'locations',
        },
        persistence: {
          locationTemplate: '{"lat":<%= latitude %>,"lng":<%= longitude %>,"acc":<%= accuracy %>,"t":"<%= timestamp %>","moving":<%= is_moving %>,"ev":"<%= event %>"}',
          maxDaysToPersist: 7,
        },
        logger: { logLevel: BG.LogLevel.Error },
      })
    } else {
      // A different tech signed in on this phone: send their points with their own key.
      await BG.setConfig({ http: { headers: { 'x-device-key': key } } })
    }
    const st = await BG.getState()
    if (!st.enabled) await BG.start()
    // Tell the office what the phone allows (Always / While Using / Off), now and whenever it changes.
    reportLocationStatus(key, await BG.getProviderState())
    if (!providerSub) providerSub = BG.onProviderChange((e) => reportLocationStatus(key, e))
  } catch { /* plugin missing on an old app build — nothing to track with */ }
}

const AUTH_NAMES = { 0: 'not_asked', 1: 'restricted', 2: 'denied', 3: 'always', 4: 'while_using', 5: 'denied' }
let providerSub = null
export let lastLocationStatus = null
function reportLocationStatus(key, e) {
  if (!e) return
  const status = AUTH_NAMES[e.status] || String(e.status)
  lastLocationStatus = { status, enabled: !!e.enabled }
  rpcWithKey('report_location_status', { p_key: key, p_status: status, p_enabled: !!e.enabled }).catch(() => {})
}

export async function stopGps() {
  if (!isNative()) return
  try {
    const BG = await bgGeo()
    try { providerSub?.remove() } catch { /* ignore */ }
    providerSub = null
    await BG.stop()
    await BG.destroyLocations()
  } catch { /* ignore */ }
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

// ---------- app notifications (Firebase) ----------
let pushReady = false
export async function pushStatus() {
  if (!isNative()) return null
  try { const { PushNotifications } = await import('@capacitor/push-notifications'); return (await PushNotifications.checkPermissions()).receive } catch { return null }
}
// Registers this phone for Journey notifications. ask=false only registers when already allowed.
export async function setupPush(profile, openUrl, ask = true) {
  if (!isNative()) return null
  const key = await deviceKey(profile)
  if (!key) return null
  const { PushNotifications } = await import('@capacitor/push-notifications')
  let perm = await PushNotifications.checkPermissions()
  if (perm.receive === 'prompt' && ask) perm = await PushNotifications.requestPermissions()
  if (perm.receive !== 'granted') return perm.receive
  if (!pushReady) {
    pushReady = true
    await PushNotifications.addListener('registration', (t) => { rpcWithKey('set_field_device_push', { p_key: key, p_token: t.value }).catch(() => {}) })
    await PushNotifications.addListener('pushNotificationActionPerformed', (a) => { const u = a?.notification?.data?.url; if (u && openUrl) openUrl(u) })
  }
  await PushNotifications.register()
  return 'granted'
}

// ---------- sign-out ----------
export async function nativeSignOut() {
  if (!isNative()) return
  await stopGps()
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (saved?.key) await supabase.rpc('revoke_my_field_device', { p_key: saved.key })
  } catch { /* ignore */ }
  try { localStorage.removeItem(KEY); localStorage.removeItem('journey_gps_buffer'); localStorage.removeItem(CALL_SYNC) } catch { /* ignore */ }
  if (platform() === 'android') await JourneyCalls.signOut().catch(() => {})
  // Courtesy notice on the sign-in screen: tracking has stopped.
  try { sessionStorage.setItem('journey_tracking_stopped', '1') } catch { /* ignore */ }
}
