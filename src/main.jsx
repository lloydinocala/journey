import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// --- PWA: auto-update — make sure a new deploy always reaches the OPEN tab ---
import { registerSW } from 'virtual:pwa-register'

// THE KEY FIX: reload the page the instant a new service worker takes control,
// so the tab runs the freshly-deployed code instead of the stale cached bundle
// it was showing. Guarded so it does NOT fire on the very first install (no prior
// controller) and cannot loop (refreshing latch).
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return
    refreshing = true
    window.location.reload()
  })
}

// Belt-and-suspenders version check: the SW auto-update lifecycle is flaky in
// practice (a normal refresh serves the cached bundle). This compares the running
// build to the deployed index.html directly; on a mismatch it force-unregisters
// the worker + clears caches + reloads — guaranteeing the newest code loads.
const BUILD_ID = __BUILD_ID__
let __updating = false
async function forceUpdate() {
  if (__updating) return
  __updating = true
  try {
    if ('serviceWorker' in navigator) {
      const rs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(rs.map((r) => r.unregister()))
    }
    if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))) }
  } catch (e) { /* ignore */ }
  window.location.reload()
}
async function checkVersion() {
  if (!BUILD_ID || __updating) return
  try {
    // Fetch version.json, which is deliberately NOT precached, so the service
    // worker can't hand us a stale build number (the old index.html check could
    // read the SW's own cached copy and never notice a new deploy).
    const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return
    const { build: deployed } = await res.json()
    if (deployed && String(deployed) !== String(BUILD_ID)) forceUpdate()
  } catch (e) { /* offline / ignore */ }
}
window.addEventListener('focus', checkVersion)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkVersion() })
setInterval(checkVersion, 60 * 1000)

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { updateSW(true) },   // new version available -> update + reload
  onRegisteredSW(swUrl, r) {
    if (!r) return
    const check = () => { r.update().catch(() => {}) }
    setInterval(check, 60 * 1000)                        // check every 60s while open
    window.addEventListener('focus', check)              // and the moment the tab regains focus
    document.addEventListener('visibilitychange', () => {// and when it becomes visible again
      if (document.visibilityState === 'visible') check()
    })
  },
})

