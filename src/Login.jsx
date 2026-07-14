import { useState } from 'react'
import { supabase } from './utils/supabase'
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setLoading(false)
      setError(signInError.message)
      return
    }

    const { data: active } = await supabase.rpc('check_active_status')
    if (active === false) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('This account has been deactivated. Contact your administrator.')
      return
    }

    setLoading(false)
  }
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="route-signature">
          <span className="waypoint" />
          <span className="line" />
        </div>
        <h1 className="wordmark">Journey</h1>
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
            <input
              id="password"
              type="password"
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
          Conversations with Apollo, the in-app assistant, are not private and may be reviewed by your administrator.
        </p>
      </div>
    </div>
  )
}
