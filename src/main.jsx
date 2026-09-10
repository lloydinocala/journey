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
