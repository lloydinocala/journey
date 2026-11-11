import { useState } from 'react'
import { supabase } from './utils/supabase'
import PasswordInput from './PasswordInput'
import { deviceKind } from './utils/deviceId'
import './fieldapp.css'

// The company this phone last signed in to (saved by App after sign-in) — the sign-in page
// can't know the company before anyone signs in, so it shows the last one used on this device.
export const LAST_ORG_KEY = 'journey_last_org'
function lastOrg() {
  try { const v = JSON.parse(localStorage.getItem(LAST_ORG_KEY) || 'null'); return v && v.id ? v : null } catch { return null }
}

async function signIn(email, password) {
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) return signInError.message
  const { data: active } = await supabase.rpc('check_active_status')
  if (active === false) {
    await supabase.auth.signOut()
    return 'This account has been deactivated. Contact your administrator.'
  }
  return ''
}

// Phone sign-in (Field App): Journey · From Surviving to Thriving · with AGENTIC AI · company ·
// Sign-In · "Can't sign in? Notify your Supervisor".
function MobileSignIn() {
  const org = lastOrg()
  const [mode, setMode] = useState('start') // start | form | help
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)
  const [helpName, setHelpName] = useState('')
  const [helpPhone, setHelpPhone] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const msg = await signIn(email, password)
    setLoading(false)
    if (msg) setError(msg)
  }
  async function notify(e) {
    e.preventDefault()
    if (!org) return
    setError(''); setOk(''); setLoading(true)
    const { data, error: fnErr } = await supabase.functions.invoke('staff-alerts', { body: { action: 'notify_supervisor', org_id: org.id, name: helpName, phone: helpPhone } })
    setLoading(false)
    let detail = data?.error
    if (!detail && fnErr?.context?.json) { try { detail = (await fnErr.context.json()).error } catch { /* keep generic */ } }
    if (detail || fnErr) { setError(detail || 'Could not reach your supervisor — please call them.'); return }
    setOk('Your supervisor has been notified by text and email.'); setMode('start')
  }

  return (
    <div className="fa-signin">
      <div className="fa-signin-brand">Journey</div>
      <div className="fa-signin-tag">From Surviving to Thriving</div>
      <img className="fa-signin-face" src="/brand/quincy-face.png" alt="" />
      <div className="fa-signin-ai">with AGENTIC AI</div>
      {org?.name ? <div className="fa-signin-org">{org.name}</div> : <div style={{ height: 26 }} />}

      {error && <div className="fa-signin-err">{error}</div>}
      {ok && <div className="fa-signin-ok">{ok}</div>}

      {mode === 'form' ? (
        <form className="fa-signin-form" onSubmit={submit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          <PasswordInput placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          <button className="fa-btn" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign-In'}</button>
        </form>
      ) : mode === 'help' ? (
        <form className="fa-signin-form" onSubmit={notify}>
          <input placeholder="Your name" value={helpName} onChange={(e) => setHelpName(e.target.value)} required autoFocus />
          <input type="tel" placeholder="Your phone number" value={helpPhone} onChange={(e) => setHelpPhone(e.target.value)} />
          <button className="fa-btn" type="submit" disabled={loading || !helpName.trim()}>{loading ? 'Sending…' : 'Notify my Supervisor'}</button>
          <button type="button" className="fa-link" style={{ marginTop: 4, fontStyle: 'normal' }} onClick={() => { setMode('start'); setError('') }}>Back</button>
        </form>
      ) : (
        <div className="fa-signin-form">
          <button className="fa-btn" type="button" onClick={() => { setMode('form'); setError(''); setOk('') }}>Sign-In</button>
        </div>
      )}

      {mode !== 'help' && (
        <div className="fa-signin-form">
          <div className="fa-btn ghost">
            Can&apos;t sign in?{' '}
            {org
              ? <button type="button" className="fa-link" onClick={() => { setMode('help'); setError(''); setOk('') }}>Notify your Supervisor</button>
              : <span style={{ fontWeight: 700 }}>Please call your Supervisor</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Login() {
  if (deviceKind() === 'mobile') return <MobileSignIn />
  return <DesktopLogin />
}

function DesktopLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const msg = await signIn(email, password)
    setLoading(false)
    if (msg) setError(msg)
  }
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img src="/brand/journey-logo.png" alt="Journey HVAC — From Surviving to Thriving"
          style={{ display: 'block', width: '100%', maxWidth: 250, height: 'auto', margin: '0 auto 10px' }} />
        <p className="subtitle">Sign in to your dispatch board</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button className="auth-button" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 16, textAlign: 'center' }}>
          Conversations with Quincy, the in-app assistant, are not private and may be reviewed by your administrator.
        </p>
      </div>
    </div>
  )
}
