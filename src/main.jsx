import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// --- PWA: auto-update — reload as soon as a new version is deployed ---
import { registerSW } from 'virtual:pwa-register'
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { updateSW(true) },   // new version available -> update + reload now
  onRegisteredSW(swUrl, r) {
    // check for a new deploy every 60s while the app is open
    if (r) setInterval(() => { r.update() }, 60 * 1000)
  },
})
