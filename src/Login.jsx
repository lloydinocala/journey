import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [brand, setBrand] = useState(null)   // per-org branding when reached via ?org=slug

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('org')
    if (!slug) return
    let cancelled = false
    supabase.rpc('get_org_branding', { p_slug: slug }).then(({ data }) => {
      if (cancelled) return
      const b = Array.isArray(data) ? data[0] : data
      if (b) setBrand(b)
    })
    return () => { cancelled = true }
  }, [])

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

  const brandName = brand ? (brand.dba_name || brand.name) : null

  return (
    <div className="auth-screen">
      <div className="auth-card">
        {brand ? (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            {brand.login_image_url && (
              <img
                src={brand.login_image_url}
                alt={brandName || 'Company'}
                style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }}
              />
            )}
            {brand.logo_url && (
              <img src={brand.logo_url} alt="Logo" style={{ height: 44, marginBottom: 8 }} />
            )}
            <h1 className="wordmark" style={{ fontSize: 26 }}>{brandName}</h1>
            <p className="subtitle">Sign in to your dispatch board</p>
          </div>
        ) : (
          <>
            <div className="route-signature">
              <span className="waypoint" />
              <span className="line" />
            </div>
            <h1 className="wordmark">Journey</h1>
            <p className="subtitle">Sign in to your dispatch board</p>
          </>
        )}
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
        {brand && (
          <p style={{ fontSize: 11, color: 'var(--mist)', marginTop: 14, textAlign: 'center' }}>Powered by Journey</p>
        )}
        <p style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 16, textAlign: 'center' }}>
          Conversations with Quincy, the in-app assistant, are not private and may be reviewed by your administrator.
        </p>
      </div>
    </div>
  )
}
