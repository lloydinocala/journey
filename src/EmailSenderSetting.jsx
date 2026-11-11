import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'

// The address this company's emails come FROM. It must be verified (SendGrid sends a link to it)
// before any email — invoices, estimates, confirmations, reports — can go out. Desktop Settings → Company.
export default function EmailSenderSetting({ orgId, canEdit, superAdmin }) {
  const [snd, setSnd] = useState(null)
  const [addr, setAddr] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!orgId) return
    setMsg(null)
    supabase.from('organizations').select('email_from_address, email_sender_status').eq('id', orgId).maybeSingle()
      .then(({ data }) => { setSnd({ address: data?.email_from_address || '', status: data?.email_sender_status || 'none' }); setAddr(data?.email_from_address || '') })
  }, [orgId])
  async function call(action, extra = {}) {
    setBusy(action); setMsg(null)
    const { data, error } = await supabase.functions.invoke('email-sender', { body: { action, ...(superAdmin ? { org_id: orgId } : {}), ...extra } })
    let e = data?.error
    if (!e && error) { try { e = (await error.context?.json())?.error } catch { /* generic */ } e = e || error.message }
    setBusy('')
    if (e) { setMsg({ ok: false, t: e }); return }
    setSnd({ address: data.address, status: data.status })
    if (action === 'request') setMsg({ ok: true, t: data.status === 'verified' ? 'Verified.' : `Verification email sent to ${data.address}. Click the link in it, then press Check status.${data.freeMail ? ' Tip: Gmail/Yahoo-type addresses often land in customers’ spam — an address at your business domain works best.' : ''}` })
    if (action === 'resend') setMsg({ ok: true, t: 'Verification email sent again.' })
  }
  if (!snd) return null
  const chip = snd.status === 'verified' ? ['Verified', '#166534', '#E3F1E8'] : snd.status === 'pending' ? ['Pending — check your inbox', '#92400E', '#FEF3C7'] : ['Not verified — emails won’t send', '#B00020', '#FBE7E7']
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 16, marginBottom: 6 }}>Email sender</h3>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: 0, marginBottom: 10, maxWidth: 640 }}>
        Every email your company sends comes from this address, under your company name. It must be verified before emails can go out.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <b>{snd.address || 'Not set'}</b>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: chip[1], background: chip[2], borderRadius: 8, padding: '3px 9px' }}>{chip[0]}</span>
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="email" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="office@yourcompany.com" style={{ minWidth: 260, padding: '8px 11px', border: '1px solid var(--border)', borderRadius: 8 }} />
          <button type="button" className="auth-button" style={{ width: 'auto', margin: 0, padding: '8px 16px' }} disabled={!!busy || !addr.trim() || (addr.trim().toLowerCase() === snd.address && snd.status !== 'none')} onClick={() => call('request', { address: addr.trim() })}>{busy === 'request' ? 'Sending…' : 'Verify'}</button>
          {snd.status === 'pending' && <button type="button" className="logout-button" disabled={!!busy} onClick={() => call('status')}>{busy === 'status' ? 'Checking…' : 'Check status'}</button>}
          {snd.status === 'pending' && <button type="button" className="logout-button" disabled={!!busy} onClick={() => call('resend')}>Resend link</button>}
        </div>
      )}
      {msg && <div style={{ marginTop: 8, fontSize: 13.5, fontWeight: 600, color: msg.ok ? '#166534' : '#B00020' }}>{msg.t}</div>}
    </div>
  )
}
