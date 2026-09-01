import { useState } from 'react'
import { supabase } from '../../utils/supabase'

// Passwordless sign-in. OTP proves the customer controls the email, which is
// what makes the "link to the customer record by email" step safe server-side.
export default function CustomerLogin() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendLink() {
    const e = email.trim().toLowerCase()
    if (!e) return
    setBusy(true); setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: e,
      options: { emailRedirectTo: window.location.origin + '/portal' },
    })
    setBusy(false)
    if (err) setError(err.message)
    else setSent(true)
  }

  return (
    <div className="cp-login">
      <div className="cp-apptitle">Your Air-Care Connection</div>

      {/* Lifestyle image. Appears once a licensed image is uploaded to
          public/portal-hero.png; hides itself (no broken icon, no gap) until then. */}
      <img className="cp-hero-img" src="/portal-hero.png" alt=""
        onError={(e) => { e.currentTarget.style.display = 'none' }} />

      <div className="cp-box">
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>✉️</div>
            <h2 className="cp-h2" style={{ marginTop: 0 }}>Check your email</h2>
            <p className="cp-lead" style={{ marginBottom: 8 }}>
              We sent a sign-in link to <b>{email.trim().toLowerCase()}</b>. Tap it on this
              device and you'll be signed in — no password needed.
            </p>
            <button className="cp-btn ghost" onClick={() => { setSent(false); setError('') }}>
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <h2 className="cp-h2" style={{ marginTop: 0 }}>Welcome back</h2>
            <p className="cp-lead">Enter the email we have on file and we'll send you a secure sign-in link.</p>
            <input
              className="cp-input" type="email" inputMode="email" autoComplete="email"
              placeholder="you@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendLink()}
            />
            {error && <div className="cp-err">{error}</div>}
            <div style={{ height: 14 }} />
            <button className="cp-btn" onClick={sendLink} disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
            <p className="cp-note">
              First time here? Use the same email address you gave us when we did work at your
              home, and we'll connect you to your account automatically.
            </p>
          </>
        )}
      </div>

      {/* The four subtitles as a small blue list under the sign-in. */}
      <ul className="cp-taglist">
        <li>Your Home</li>
        <li>Your Comfort</li>
        <li>Your Health</li>
        <li>Your Money</li>
      </ul>
    </div>
  )
}
