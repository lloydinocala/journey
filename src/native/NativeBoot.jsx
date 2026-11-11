import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isNative, startGps, setupCalls, syncCallLog } from './native'
import { flush } from './offline'

// Starts the store app's native features once a field user is signed in and past the terms:
// constant GPS, caller ID / call logging, and opening links from notifications inside the app.
export default function NativeBoot({ profile }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isNative() || !profile?.id) return
    let live = true
    const subs = []
    ;(async () => {
      startGps(profile)
      setupCalls(profile)
      const { App } = await import('@capacitor/app')
      const go = (url) => {
        try {
          const u = new URL(url)
          if (u.pathname.startsWith('/tech')) navigate(u.pathname + u.search)
        } catch { /* not a Journey link */ }
      }
      const launch = await App.getLaunchUrl().catch(() => null)
      if (live && launch?.url) go(launch.url)
      subs.push(await App.addListener('appUrlOpen', (e) => go(e.url)))
      subs.push(await App.addListener('resume', () => { syncCallLog(profile); flush() }))
    })()
    const t = setInterval(() => syncCallLog(profile), 120000)
    return () => { live = false; clearInterval(t); subs.forEach((s) => s?.remove?.()) }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
