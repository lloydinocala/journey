import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// --- PWA: register service worker + prompt on new version ---
import { registerSW } from 'virtual:pwa-register'
const updateSW = registerSW({
  onNeedRefresh() {
    if (document.getElementById('pwa-update-bar')) return
    const bar = document.createElement('div')
    bar.id = 'pwa-update-bar'
    bar.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99999;background:#0B3041;color:#fff;padding:12px 18px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.35);font:14px system-ui,-apple-system,sans-serif;display:flex;gap:12px;align-items:center'
    const span = document.createElement('span'); span.textContent = 'A new version is available.'
    const btn = document.createElement('button'); btn.textContent = 'Refresh'
    btn.style.cssText = 'background:#4E95D9;color:#fff;border:none;border-radius:6px;padding:7px 16px;font-weight:700;cursor:pointer'
    btn.onclick = () => updateSW(true)
    bar.appendChild(span); bar.appendChild(btn)
    document.body.appendChild(bar)
  },
})
