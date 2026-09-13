import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { can } from './utils/permissions'

const QBGREEN = '#2CA01C'

// Settings card for the optional QuickBooks connection (one-way push: Journey -> QBO).
export default function QuickBooksSettings({ profile }) {
  const canManage = profile?.role === 'super_admin' || can(profile, 'manage_integrations')
  const [st, setSt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)

  async function load() {
    setLoading(true)
    try { const { data } = await supabase.functions.invoke('quickbooks-status'); setSt(data || {}) } catch { setSt({}) }
    setLoading(false)
  }
  useEffect(() => {
    load()
    const p = new URLSearchParams(window.location.search)
    if (p.get('qbo') === 'connected') setFlash({ ok: true, msg: 'QuickBooks connected.' })
    else if (p.get('qbo') === 'error') setFlash({ ok: false, msg: 'That connection didn’t complete — please try again.' })
    if (p.get('qbo')) window.history.replaceState({}, '', '/settings')
  }, [])

  async function connect() {
    setBusy(true)
    try {
      const { data } = await supabase.functions.invoke('quickbooks-connect')
      if (data?.url) { window.location.href = data.url; return }
      setFlash({ ok: false, msg: data?.message || 'QuickBooks isn’t set up yet — the Intuit credentials still need to be added.' })
    } catch { setFlash({ ok: false, msg: 'Could not start the connection.' }) }
    setBusy(false)
  }
  async function disconnect() {
    if (!window.confirm('Disconnect QuickBooks? Journey will stop sending data to it.')) return
    setBusy(true)
    try { await supabase.functions.invoke('quickbooks-status', { body: { action: 'disconnect' } }) } catch { /* noop */ }
    setBusy(false); load()
  }

  if (!canManage) return null

  return (
    <div className="section-card" style={{ padding: 16, marginBottom: 24, maxWidth: 560, borderLeft: `4px solid ${QBGREEN}` }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>QuickBooks</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--mist)' }}>Send Journey’s invoices and payments straight into your QuickBooks — one-way, automatic, no re-typing.</p>
      {flash && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, fontSize: 13.5, background: flash.ok ? '#EAF3EC' : '#FBECE8', color: flash.ok ? '#2E7D52' : '#B5462F', border: `1px solid ${flash.ok ? '#CADFCF' : '#EAC5BC'}` }}>{flash.msg}</div>}
      <div style={{ fontSize: 10, color: '#B00', wordBreak: 'break-all', marginBottom: 8 }}>debug: {JSON.stringify(st)}</div>
      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--mist)' }}>Checking…</div>
      ) : !st?.configured ? (
        <div style={{ fontSize: 13.5, color: '#9C6A12', background: '#FAF2E0', border: '1px solid #EAD3A0', borderRadius: 8, padding: '10px 12px' }}>
          Not set up yet — the Intuit app credentials need to be added before this can be connected. One-time setup.
        </div>
      ) : st?.connected ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: '#2E7D52' }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Connected{st.company_name ? ` to ${st.company_name}` : ''}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9C6A12', background: '#FAF2E0', borderRadius: 999, padding: '2px 8px', textTransform: 'capitalize' }}>{st.environment}</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--mist)', margin: '0 0 12px' }}>Invoices and payments flow into QuickBooks automatically.</p>
          <button onClick={disconnect} disabled={busy} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>Disconnect</button>
        </div>
      ) : (
        <button onClick={connect} disabled={busy} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: QBGREEN, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>{busy ? '…' : 'Connect QuickBooks'}</button>
      )}
    </div>
  )
}
