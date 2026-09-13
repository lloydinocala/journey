import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

// Landing page for Intuit's OAuth redirect. Hands the code to the callback edge
// function (authenticated), then returns the user to Settings.
export default function QboCallback() {
  const [msg] = useState('Finishing your QuickBooks connection\u2026')
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const code = p.get('code'), state = p.get('state'), realmId = p.get('realmId')
    if (p.get('error') || !code || !state || !realmId) { window.location.href = '/settings?qbo=error'; return }
    supabase.functions.invoke('quickbooks-callback', { body: { code, state, realmId } })
      .then(({ data }) => { window.location.href = '/settings?qbo=' + (data?.connected ? 'connected' : 'error') })
      .catch(() => { window.location.href = '/settings?qbo=error' })
  }, [])
  return <div style={{ padding: 48, fontSize: 15, color: '#1C2430' }}>{msg}</div>
}
