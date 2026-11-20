// "Load my day": while the Field App is open with a connection, quietly downloads today's and
// tomorrow's job screens so they open with no signal. Runs at sign-in, at clock-in, when the
// connection comes back, and every 30 minutes. Invisible; never blocks the tech.
import { useEffect, useRef } from 'react'

const EVERY = 30 * 60 * 1000
const LAST = 'journey_prefetch_at'

export default function PrefetchHost({ profile }) {
  const busy = useRef(false)
  useEffect(() => {
    if (!profile?.org_id) return
    try { window.__journeyProfile = profile } catch { /* ignore */ }
    let frame = null
    let timer = null

    const finish = () => {
      clearTimeout(timer)
      if (frame) { frame.remove(); frame = null }
      busy.current = false
    }
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || !e.data?.journeyPrefetch) return
      if (e.data.done) {
        try { localStorage.setItem(LAST, JSON.stringify({ at: Date.now(), day: new Date().toDateString(), uid: profile.id })) } catch { /* ignore */ }
        finish()
      }
    }
    const run = (force) => {
      if (busy.current || navigator.onLine === false || document.visibilityState === 'hidden') return
      if (!force) {
        try {
          const last = JSON.parse(localStorage.getItem(LAST) || 'null')
          if (last && last.uid === profile.id && last.day === new Date().toDateString() && Date.now() - last.at < EVERY) return
        } catch { /* ignore */ }
      }
      busy.current = true
      frame = document.createElement('iframe')
      frame.setAttribute('aria-hidden', 'true')
      frame.tabIndex = -1
      Object.assign(frame.style, { position: 'fixed', width: '1px', height: '1px', left: '-10px', top: '-10px', opacity: '0', pointerEvents: 'none', border: '0' })
      frame.src = '/tech/prefetch?journeyPrefetch=1'
      document.body.appendChild(frame)
      timer = setTimeout(finish, 10 * 60 * 1000) // never leave it running
    }

    window.addEventListener('message', onMessage)
    const onOnline = () => run(true)
    const onClock = () => run(true)
    const onVisible = () => { if (document.visibilityState === 'visible') run(false) }
    window.addEventListener('online', onOnline)
    window.addEventListener('clock-changed', onClock)
    document.addEventListener('visibilitychange', onVisible)
    const start = setTimeout(() => run(false), 8000) // let the screen the tech opened load first
    const tick = setInterval(() => run(false), 5 * 60 * 1000)
    return () => {
      clearTimeout(start); clearInterval(tick); finish()
      window.removeEventListener('message', onMessage)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('clock-changed', onClock)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [profile?.id, profile?.org_id])
  return null
}
