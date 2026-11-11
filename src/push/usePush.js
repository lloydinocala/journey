import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'

// Public by design — the matching private key lives server-side (push-notify).
export const VAPID_PUBLIC_KEY = 'BKzRysqGHNERaFoRMmO0bawpxun_HKYb9tBZkb7NXscliD0KNC96ZGUYuKh3jRgJp2-DSU0JR56Lr1PcpZauCDE'
const WANT_KEY = 'journey_push_wanted'

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function isIos() {
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function readWant() { try { return localStorage.getItem(WANT_KEY) === '1' } catch (e) { return false } }
function writeWant(v) { try { if (v) localStorage.setItem(WANT_KEY, '1'); else localStorage.removeItem(WANT_KEY) } catch (e) { /* ignore */ } }

async function getReg() {
  // Wait for the app's service worker (registered in main.jsx); give up after a few seconds.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rej) => setTimeout(() => rej(new Error('Service worker not ready — reload the app and try again.')), 8000)),
  ])
}

async function saveSub(sub) {
  const j = sub.toJSON()
  const { error } = await supabase.rpc('push_subscribe', {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys && j.keys.p256dh,
    p_auth: j.keys && j.keys.auth,
    p_user_agent: (navigator.userAgent || '').slice(0, 300),
  })
  if (error) throw error
}

export function usePush(profile) {
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const [status, setStatus] = useState(supported ? 'checking' : 'unsupported') // checking | on | off | denied | unsupported
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!supported) { setStatus('unsupported'); return }
    try {
      if (Notification.permission === 'denied') { setStatus('denied'); return }
      const reg = await getReg()
      let sub = await reg.pushManager.getSubscription()
      // The subscription can disappear when the service worker is replaced (e.g. a forced
      // update). If this person had turned notifications on and permission is still granted,
      // quietly subscribe again — no prompt is shown.
      if (!sub && readWant() && Notification.permission === 'granted' && profile && profile.id) {
        try {
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })
        } catch (e) { sub = null }
      }
      if (sub && profile && profile.id) { try { await saveSub(sub) } catch (e) { /* will retry next time */ } }
      setStatus(sub ? 'on' : 'off')
    } catch (e) {
      setStatus('off')
    }
  }, [supported, profile && profile.id])

  useEffect(() => { refresh() }, [refresh])

  const turnOn = useCallback(async () => {
    if (!supported) return
    setBusy(true); setError('')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setStatus(perm === 'denied' ? 'denied' : 'off'); return }
      const reg = await getReg()
      let sub = await reg.pushManager.getSubscription()
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })
      await saveSub(sub)
      writeWant(true)
      setStatus('on')
    } catch (e) {
      setError((e && e.message) || 'Could not turn on notifications.')
    } finally { setBusy(false) }
  }, [supported])

  const turnOff = useCallback(async () => {
    if (!supported) return
    setBusy(true); setError('')
    try {
      writeWant(false)
      const reg = await getReg()
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        try { await sub.unsubscribe() } catch (e) { /* ignore */ }
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
      }
      setStatus('off')
    } catch (e) {
      setError((e && e.message) || 'Could not turn off notifications.')
    } finally { setBusy(false) }
  }, [supported])

  return { supported, status, busy, error, turnOn, turnOff, needsHomeScreen: !supported && isIos() }
}
