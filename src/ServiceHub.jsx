import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './utils/supabase'
import './modules/customer-hvac/portal.css'

const CATS = [
  { k: 'repair', label: 'Report a problem', sub: 'Something isn’t working right' },
  { k: 'tuneup', label: 'Book a tune-up', sub: 'Routine maintenance / check-up' },
  { k: 'question', label: 'Ask a question', sub: 'Anything else' },
]

export default function ServiceHub() {
  const { token } = useParams()
  const [info, setInfo] = useState(undefined) // undefined=loading, null=invalid
  const [category, setCategory] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [urgency, setUrgency] = useState('soon')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.functions.invoke('service-request', { body: { mode: 'resolve', token } })
      .then(({ data }) => setInfo(data?.ok ? data : null))
      .catch(() => setInfo(null))
  }, [token])

  async function submit() {
    if (category !== 'question' && !details.trim()) { setErr('Please tell us a little about the issue.'); return }
    setBusy(true); setErr('')
    const { data, error } = await supabase.functions.invoke('service-request', {
      body: { mode: 'submit', token, category, name: name.trim(), phone: phone.trim(), urgency: category === 'repair' ? urgency : null, details: details.trim() },
    })
    setBusy(false)
    if (error || !data?.ok) { setErr(data?.error || 'Could not send — please call the office.'); return }
    setDone(true)
  }

  if (info === undefined) return <div className="cp-root"><div className="cp-center">Loading…</div></div>
  if (info === null) return (
    <div className="cp-root"><div className="cp-center">
      <div style={{ fontSize: 42 }}>🔎</div>
      <h2 className="cp-h2">This code isn’t active</h2>
      <p className="cp-lead" style={{ maxWidth: 340 }}>Please call the office for service.</p>
    </div></div>
  )

  if (done) return (
    <div className="cp-root"><div className="cp-center">
      <div style={{ fontSize: 46 }}>✅</div>
      <h2 className="cp-h2">Request sent</h2>
      <p className="cp-lead" style={{ maxWidth: 360 }}>Thanks! {info.org_name} has your request for <b>{info.address}</b> and will reach out to schedule. For an emergency, please also call the office.</p>
    </div></div>
  )

  return (
    <div className="cp-root">
      <div className="cp-wrap" style={{ maxWidth: 460, margin: '0 auto', paddingTop: 24 }}>
        <div className="cp-brandtag" style={{ position: 'static', marginBottom: 8 }}>{info.org_name}</div>
        <h2 className="cp-h2">Service for this address</h2>
        <p className="cp-lead" style={{ marginTop: -4 }}>📍 {info.address}</p>

        {!category && (
          <>
            {CATS.map((c) => (
              <button key={c.k} className="cp-btn" style={{ marginBottom: 10, textAlign: 'left' }} onClick={() => { setCategory(c.k); setErr('') }}>
                <div style={{ fontWeight: 800 }}>{c.label}</div>
                <div style={{ fontSize: 12.5, opacity: 0.85 }}>{c.sub}</div>
              </button>
            ))}
          </>
        )}

        {category && (
          <>
            <button className="cp-back" onClick={() => { setCategory(null); setErr('') }}>‹ Back</button>
            <div className="cp-label">Your name</div>
            <input className="cp-sel" value={name} onChange={(e) => setName(e.target.value)} placeholder="First & last name" />
            <div className="cp-label">Best callback number</div>
            <input className="cp-sel" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(352) 555-1234" />
            {category === 'repair' && (
              <>
                <div className="cp-label">How urgent?</div>
                <div className="cp-winrow">
                  {[['emergency', 'Emergency'], ['soon', 'Soon'], ['flexible', 'Flexible']].map(([v, l]) => (
                    <button key={v} className={'cp-wincard' + (urgency === v ? ' on' : '')} onClick={() => setUrgency(v)}>
                      <span className="wlabel">{l}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="cp-label">{category === 'question' ? 'Your question' : 'What’s going on?'}</div>
            <textarea className="cp-ta" value={details} onChange={(e) => setDetails(e.target.value)} placeholder={category === 'tuneup' ? 'Anything we should know? (optional)' : 'e.g. AC is running but not cooling'} />
            {err && <div className="cp-err">{err}</div>}
            <div style={{ height: 10 }} />
            <button className="cp-btn" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
            <p className="cp-note">This goes straight to {info.org_name}. For a true emergency, please also call.</p>
          </>
        )}
      </div>
    </div>
  )
}
