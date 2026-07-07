import { useState } from 'react'
import { supabase } from './utils/supabase'

export default function SetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      setError(error.message)
    } else {
      window.history.replaceState(null, '', window.location.pathname)
      onDone()
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="route-signature">
          <span className="waypoint" />
          <span className="line" />
        </div>
        <h1 className="wordmark">Journey</h1>
        <p className="subtitle">Set your password to finish joining</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="password">New password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <button className="auth-button" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Set password'}
          </button>
        </form>
      </div>
    </div>
  )
}
