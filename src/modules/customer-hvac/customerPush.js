import { Capacitor } from '@capacitor/core'
import { supabase } from '../../utils/supabase'

// Push notifications for Home Comfort Connect (the store app that opens this portal).
// Only runs inside the store app; in a phone's web browser it does nothing.
export const inCustomerApp = () => {
  try { return Capacitor.isNativePlatform() && /HomeComfortApp/.test(navigator.userAgent) } catch { return false }
}

let listening = false

// Ask the phone for permission (shows the system prompt the first time) and register this phone.
// onOpen(url) is called when the customer taps a notification.
export async function enablePush(onOpen) {
  if (!inCustomerApp()) return 'unavailable'
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') return 'denied'
    if (!listening) {
      listening = true
      await PushNotifications.addListener('registration', ({ value }) => {
        supabase.rpc('customer_app_register_device', { p_token: value, p_platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android' })
      })
      await PushNotifications.addListener('pushNotificationActionPerformed', (e) => {
        const url = e?.notification?.data?.url || e?.notification?.data?.aps?.url
        if (url && onOpen) onOpen(url)
      })
    }
    await PushNotifications.register()
    return 'granted'
  } catch {
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
