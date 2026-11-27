import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Customer Portal feedback page — public, no login, reached only from the private link in the
// follow-up text sent two days after a customer books or orders filters in the portal.
// The token-gated portal-feedback function loads it and passes the answers to the office.
export default function PublicFeedback() {
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [err, setErr] = useState('')
  const [rating, setRating] = useState(0)
  const [experience, setExperience] = useState('')
  const [suggestions, setSuggestions] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.functions.invoke('portal-feedback', { body: { action: 'get', token } }).then(({ data, error }) => {
      if (error || !data?.ok) setErr("This link isn't valid.")
      else setInfo(data)
    })
  }, [token])

  async function submit() {
    if (!rating && !experience.trim() && !suggestions.trim()) { setErr('Please pick a rating or write a comment.'); return }
    setBusy(true); setErr('')
    const { data, error } = await supabase.functions.invoke('portal-feedback', { body: { action: 'submit', token, rating, experience, suggestions } })
    setBusy(false)
    if (error || !data?.ok) { setErr(data?.error || 'Something went wrong. Please try again.'); return }
    setDone(true)
  }

  const brand = info?.brand_color || '#215F9A'
  const box = { maxWidth: 520, margin: '0 auto', padding: '28px 20px 40px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#1f2937' }
  const ta = { width: '100%', minHeight: 96, padding: 12, fontSize: 16, border: '1.5px solid #CBD5E1', borderRadius: 10, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }
  const label = { display: 'block', fontWeight: 700, fontSize: 15, margin: '20px 0 8px' }

  if (!info) return <div style={box}>{err ? <p style={{ fontSize: 17 }}>{err}</p> : <p style={{ color: '#64748B' }}>Loading…</p>}</div>

  const header = (
    <div style={{ textAlign: 'center', marginBottom: 18 }}>
      {info.logo_url
        ? <img src={info.logo_url} alt={info.org_name} style={{ maxHeight: 64, maxWidth: '70%' }} />
        : <div style={{ fontSize: 22, fontWeight: 800, color: brand }}>{info.org_name}</div>}
    </div>
  )

  if (done || info.submitted) return (
    <div style={box}>{header}
      <h1 style={{ fontSize: 24, margin: '10px 0' }}>Thank you{info.first_name ? `, ${info.first_name}` : ''}!</h1>
      <p style={{ fontSize: 16, lineHeight: 1.5 }}>{done ? 'Your feedback went straight to our office.' : 'We already received your feedback for this visit.'} We read every comment and use it to make the app better for you.</p>
      {info.office_phone && <p style={{ fontSize: 15, color: '#475569' }}>Need something now? Call us at {info.office_phone}.</p>}
    </div>
  )

  if (info.expired) return (
    <div style={box}>{header}
      <p style={{ fontSize: 16, lineHeight: 1.5 }}>This feedback link has expired. We'd still love to hear from you{info.office_phone ? ` — call us at ${info.office_phone}` : ''}.</p>
    </div>
  )

  return (
    <div style={box}>
      {header}
      <h1 style={{ fontSize: 23, margin: '6px 0 8px' }}>How did our app work for you{info.first_name ? `, ${info.first_name}` : ''}?</h1>
      <p style={{ fontSize: 15.5, color: '#475569', lineHeight: 1.5, margin: 0 }}>You recently used our app to {info.what}. A minute of your time helps us make it better.</p>

      <span style={label}>Your overall experience</span>
      <div role="radiogroup" aria-label="Rating" style={{ display: 'flex', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} of 5`} onClick={() => setRating(n)}
            style={{ fontSize: 38, lineHeight: 1, background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: n <= rating ? '#F59E0B' : '#CBD5E1' }}>★</button>
        ))}
      </div>

      <label style={label} htmlFor="fb-exp">Tell us about your experience</label>
      <textarea id="fb-exp" style={ta} value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="What went well? Was anything confusing or frustrating?" maxLength={4000} />

      <label style={label} htmlFor="fb-sug">What would you add or improve in the app?</label>
      <textarea id="fb-sug" style={ta} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} placeholder="Anything you wish the app could do for you" maxLength={4000} />

      {err && <p style={{ color: '#B91C1C', fontSize: 15 }}>{err}</p>}
      <button type="button" onClick={submit} disabled={busy}
        style={{ marginTop: 22, width: '100%', padding: '15px 18px', fontSize: 17, fontWeight: 700, color: '#fff', background: brand, border: 'none', borderRadius: 10, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
        {busy ? 'Sending…' : 'Send to the office'}
      </button>
      <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 14 }}>Your answers go to {info.org_name} with your name, so we can follow up if needed.</p>
    </div>
  )
}
