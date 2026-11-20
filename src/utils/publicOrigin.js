// The web address customer links, QR codes and password-reset links must point at. Inside the
// store apps the screens run from the phone (capacitor://localhost or https://localhost), which
// a customer's browser can't open, so those links always use the live site instead.
const LIVE = 'https://www.journey-hvac.app'
export function publicOrigin() {
  try {
    const { protocol, hostname, origin } = window.location
    if (protocol !== 'https:' && protocol !== 'http:') return LIVE
    if (hostname === 'localhost' || hostname === '127.0.0.1') return LIVE
    return origin
  } catch { return LIVE }
}
