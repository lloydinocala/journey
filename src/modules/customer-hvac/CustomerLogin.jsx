import { useState } from 'react'
import { supabase } from '../../utils/supabase'

// Passwordless sign-in with a 6-digit CODE (not a link). The customer types the
// code into the app, so the session is created in the app itself — it works even
// when the email is on another device, and it never bounces out to a browser.
export default function CustomerLogin() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendCode() {
    const e = email.trim().toLowerCase()
    if (!e) return
    setBusy(true); setError('')
    const { error: err } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } })
    setBusy(false)
    if (err) setError(err.message)
    else setStep('code')
  }

  async function verifyCode() {
    const e = email.trim().toLowerCase()
    const token = code.trim()
    if (token.length < 6) return
    setBusy(true); setError('')
    const { error: err } = await supabase.auth.verifyOtp({ email: e, token, type: 'email' })
    setBusy(false)
    if (err) setError(err.message)
    // On success, index.jsx's auth listener takes over and loads the account.
  }

  return (
    <div className="cp-login">
      <div className="cp-apptitle">Your Air-Care Connection</div>

      <img className="cp-hero-img" src="/portal-hero.png" alt=""
        onError={(e) => { e.currentTarget.style.display = 'none' }} />

      <div className="cp-box">
        {step === 'code' ? (
          <>
            <h2 className="cp-h2" style={{ marginTop: 0 }}>Enter your code</h2>
            <p className="cp-lead" style={{ marginBottom: 10 }}>
              We emailed a 6-digit code to <b>{email.trim().toLowerCase()}</b>. Enter it here to sign in —
              no link to open, no browser.
            </p>
            <input
              className="cp-input" type="text" inputMode="numeric" autoComplete="one-time-code"
              placeholder="123456" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
              style={{ textAlign: 'center', fontSize: 26, letterSpacing: 8, fontWeight: 800 }}
            />
            {error && <div className="cp-err">{error}</div>}
            <div style={{ height: 14 }} />
            <button className="cp-btn" onClick={verifyCode} disabled={busy || code.trim().length < 6}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <div style={{ height: 8 }} />
            <button className="cp-btn ghost" onClick={() => { setStep('email'); setCode(''); setError('') }}>
              Use a different email
            </button>
            <p className="cp-note">Didn't get it? Check your spam folder, or go back and try again.</p>
          </>
        ) : (
          <>
            <h2 className="cp-h2" style={{ marginTop: 0 }}>Welcome back</h2>
            <p className="cp-lead">Enter the email we have on file and we'll send you a 6-digit sign-in code.</p>
            <input
              className="cp-input" type="email" inputMode="email" autoComplete="email"
              placeholder="you@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCode()}
            />
            {error && <div className="cp-err">{error}</div>}
            <div style={{ height: 14 }} />
            <button className="cp-btn" onClick={sendCode} disabled={busy}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
            <p className="cp-note">
              First time here? Use the same email you gave us for service and we'll connect you to
              your account automatically.
            </p>
          </>
        )}
      </div>

      <ul className="cp-taglist">
        <li>Your Home</li>
        <li>Your Comfort</li>
        <li>Your Health</li>
        <li>Your Money</li>
      </ul>
    </div>
  )
}
