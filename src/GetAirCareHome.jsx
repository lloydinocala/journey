import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

// The customer-portal QR code (shown on the tech app's job card) encodes the bare
// address https://portal.journey-hvac.app. Opening it sends the customer to the
// Air Care Home app in their phone's store: iPhone → App Store, Android → Google
// Play. Any other device gets a page with only the two store buttons — the portal
// is never offered as a web app here.
export const APP_STORE_URL = 'https://apps.apple.com/us/app/air-care-home/id6837530570'
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.ventexiq.homecomfort'
const IOS_STORE_APP_URL = 'itms-apps://apps.apple.com/app/id6837530570'
const ANDROID_STORE_APP_URL = 'intent://details?id=com.ventexiq.homecomfort#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=' + encodeURIComponent(PLAY_STORE_URL) + ';end'

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''
  // Inside the Air Care Home app itself — never redirect the app to a store.
  if (/HomeComfortApp/i.test(ua) || (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.())) return 'app'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

export default function GetAirCareHome() {
  const [platform] = useState(detectPlatform)

  useEffect(() => {
    // Plain https store links opened by a script stay in the browser (iOS shows
    // Apple's web preview). The store apps' own address schemes open the App Store
    // / Play Store app directly; the https link is the fallback.
    if (platform === 'ios') {
      window.location.href = IOS_STORE_APP_URL
      const t = setTimeout(() => { if (!document.hidden) window.location.replace(APP_STORE_URL) }, 2500)
      return () => clearTimeout(t)
    }
    if (platform === 'android') window.location.replace(ANDROID_STORE_APP_URL)
  }, [platform])

  if (platform === 'app') return <Navigate to="/portal" replace />

  const btn = {
    display: 'block', width: '100%', maxWidth: 300, margin: '0 auto 12px', padding: '14px 18px',
    borderRadius: 12, background: '#0B3041', color: '#fff', textDecoration: 'none',
    fontWeight: 700, fontSize: 17, textAlign: 'center', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#77D1F9,#2B8CD6)', fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '32px 24px', maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.15)' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 26, color: '#0B3041' }}>Air Care Home</h1>
        <p style={{ margin: '0 0 22px', color: '#475569', fontSize: 15, lineHeight: 1.45 }}>
          {platform === 'other'
            ? 'Get the app on your phone to see your home’s heating & cooling service, records, and appointments.'
            : 'Opening your app store…'}
        </p>
        <a href={APP_STORE_URL} style={btn}>Download on the App Store</a>
        <a href={PLAY_STORE_URL} style={btn}>Get it on Google Play</a>
      </div>
    </div>
  )
}

// Wraps the customer portal (/portal/*). The portal only runs inside the Air Care
// Home app; in any web browser — phone or computer — the visitor is sent to the
// app stores instead.
export function PortalGate({ children }) {
  const [platform] = useState(detectPlatform)
  return platform === 'app' ? children : <GetAirCareHome />
}
