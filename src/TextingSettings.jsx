// Settings → Company → Texting number. Each company texts customers from its own number, so
// customers see (and can reply or call back) the company — not Journey. Until a company has
// its own number, texts go out from the shared Journey number and replies still reach the
// company. The number must match Twilio exactly, so only Journey support can change it.
import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'

const pretty = (p) => { const d = String(p || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (p || '') }
const STATUS = { platform: 'Using the shared Journey number', pending: 'Own number being set up', own_number: 'Own number — active' }

export default function TextingSettings({ orgId, isSuperAdmin }) {
  const [org, setOrg] = useState(null)
  const [num, setNum] = useState('')
  const [mss, setMss] = useState('')
  const [status, setStatus] = useState('platform')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!orgId) return
    supabase.from('organizations').select('id, sms_from_number, sms_messaging_service_sid, sms_number_status').eq('id', orgId).maybeSingle().then(({ data }) => {
      setOrg(data); setNum(data?.sms_from_number || ''); setMss(data?.sms_messaging_service_sid || ''); setStatus(data?.sms_number_status || 'platform'); setMsg('')
    })
  }, [orgId])

  async function save(e) {
    e.preventDefault(); setMsg('')
    let e164 = null
    if (num.trim()) {
      const d = num.replace(/\D/g, '')
      const ten = d.length === 11 && d[0] === '1' ? d.slice(1) : d
      if (ten.length !== 10) { setMsg('Enter a 10-digit US number.'); return }
      e164 = '+1' + ten
    }
    const sid = mss.trim() || null
    if (sid && !/^MG[0-9a-f]{32}$/.test(sid)) { setMsg('A messaging service ID starts with MG followed by 32 letters/numbers.'); return }
    setBusy(true)
    const { error } = await supabase.from('organizations').update({ sms_from_number: e164, sms_messaging_service_sid: sid, sms_number_status: e164 ? status === 'platform' ? 'own_number' : status : 'platform' }).eq('id', orgId)
    setBusy(false)
    if (error) setMsg(error.message.includes('organizations_sms_from_number_key') ? 'That number is already assigned to another company.' : error.message)
    else { setMsg('Saved'); setNum(e164 || ''); if (!e164) setStatus('platform'); else if (status === 'platform') setStatus('own_number') }
  }

  if (!org) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Texting number</h3>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -6, marginBottom: 14, maxWidth: 720 }}>
        The number your customers see when the app texts them (On My Way, invoices, reminders, replies). Replies and texts to this number come into the app: replies from customers with a job land in that job's thread, everything else shows in <b>Text Archive → New texts</b>.
        {' '}Without your own number, texts go out from the shared Journey number and replies still come to you.
      </p>
      <div style={{ fontSize: 14, marginBottom: 12 }}>
        <b>{org.sms_from_number ? pretty(org.sms_from_number) : 'Shared Journey number'}</b>
        <span style={{ color: 'var(--mist)' }}> · {STATUS[org.sms_number_status] || STATUS.platform}</span>
      </div>
      {isSuperAdmin ? (
        <form className="inline-form" onSubmit={save} style={{ flexWrap: 'wrap' }}>
          <div className="field">
            <label>Company number (Twilio)</label>
            <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="(352) 555-0100" style={{ width: 170 }} />
          </div>
          <div className="field">
            <label>Messaging service ID (optional)</label>
            <input value={mss} onChange={(e) => setMss(e.target.value)} placeholder="MG… (blank = Journey's)" style={{ width: 300 }} />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending">Being set up</option>
              <option value="own_number">Active</option>
            </select>
          </div>
          <button className="auth-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          {msg && <span style={{ color: msg === 'Saved' ? '#4CD97B' : '#B42318', fontSize: 14 }}>{msg}</span>}
          <div style={{ fontSize: 12.5, color: 'var(--mist)', width: '100%', marginTop: 4 }}>
            Journey support only. The number must be in the Twilio account, added to a messaging service that's on an approved A2P 10DLC campaign, with its incoming-message webhook set to the twilio-inbound function. Leave the messaging service blank to use Journey's.
          </div>
        </form>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--mist)' }}>Want your own texting number, or a change to it? Contact Journey support — we set it up for you.</div>
      )}
    </div>
  )
}
