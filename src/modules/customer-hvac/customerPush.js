import { Capacitor } from '@capacitor/core'
import { supabase } from '../../utils/supabase'

// Push notifications for Home Comfort Connect (the store app that opens this portal).
// Only runs inside the store app; in a phone's web browser it does nothing.
export const inCustomerApp = () => {
  try { return Capacitor.isNativePlatform() && /HomeComfortApp/.test(navigator.userAgent) } catch { return false }
}

let listening = false

// Phone check: records what happened on this phone (store app or browser, permission, registered or the
// error) so the office can see it on Customer App Messages. Never throws.
export function reportPush(step, extra = {}) {
  try {
    let platform = 'web'
    try { platform = Capacitor.getPlatform() } catch { /* ignore */ }
    supabase.rpc('customer_app_push_event', {
      p_in_app: inCustomerApp(), p_platform: platform, p_permission: extra.permission || null,
      p_step: step, p_error: extra.error ? String(extra.error).slice(0, 500) : null,
      p_ua: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 300),
    }).then(() => {}, () => {})
  } catch { /* ignore */ }
}

// Ask the phone for permission (shows the system prompt the first time) and register this phone.
// onOpen(url) is called when the customer taps a notification.
export async function enablePush(onOpen) {
  if (!inCustomerApp()) return 'unavailable'
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') { reportPush('permission_denied', { permission: perm.receive }); return 'denied' }
    if (!listening) {
      listening = true
      await PushNotifications.addListener('registration', async ({ value }) => {
        const { error } = await supabase.rpc('customer_app_register_device', { p_token: value, p_platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android' })
        reportPush(error ? 'save_failed' : 'registered', { permission: 'granted', error: error?.message })
      })
      await PushNotifications.addListener('registrationError', (e) => {
        reportPush('phone_refused', { permission: 'granted', error: e?.error || JSON.stringify(e) })
      })
      await PushNotifications.addListener('pushNotificationActionPerformed', (e) => {
        const url = e?.notification?.data?.url || e?.notification?.data?.aps?.url
        if (url && onOpen) onOpen(url)
      })
    }
    await PushNotifications.register()
    return 'granted'
  } catch (e) {
    reportPush('plugin_error', { error: e?.message || String(e) })
    return 'unavailable'
  }
}

// Returns 'granted' | 'denied' | 'prompt' | 'unavailable' without asking.
export async function pushStatus() {
  if (!inCustomerApp()) return 'unavailable'
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const p = await PushNotifications.checkPermissions()
    return p.receive === 'granted' ? 'granted' : p.receive === 'denied' ? 'denied' : 'prompt'
  } catch { return 'unavailable' }
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
