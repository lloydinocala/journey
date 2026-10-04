import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Public SMS opt-in page (A2P 10DLC Call-to-Action). Reviewer-verifiable: a real form
// with a phone field and an UNCHECKED consent checkbox carrying the required disclosures,
// plus links to the SMS Terms and Privacy Policy. Submitting records the consent via the
// sms-optin edge function so there is a real proof-of-consent audit trail.

const CONSENT_TEXT =
  'By checking this box and providing my mobile number, I agree to receive recurring automated ' +
  'SMS text messages from Air-Care Connect about my service appointments, technician dispatch and ' +
  'arrival updates, and account notifications. Consent is not a condition of purchase. Message ' +
  'frequency varies. Message and data rates may apply. Reply STOP to unsubscribe, HELP for help.'

const BRAND = '#0B5CAB'

export default function SmsOptIn() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [zip, setZip] = useState('')
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState('idle') // idle | sending | done | error
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setErr('Please enter a valid 10-digit mobile number.'); return }
    if (!consent) { setErr('Please check the box to agree to receive text messages.'); return }
    setState('sending')
    try {
      const { data, error } = await supabase.functions.invoke('sms-optin', {
        body: { name, phone, email, zip, consent: true, consentText: CONSENT_TEXT },
      })
      if (error || !data?.ok) { setState('error'); setErr('Something went wrong. Please try again or call us.'); return }
      setState('done')
    } catch {
      setState('error'); setErr('Something went wrong. Please try again or call us.')
    }
  }

  const page = { minHeight: '100vh', background: '#f4f6f9', fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif', color: '#1f2937', padding: '0 0 40px' }
  const card = { maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 14, boxShadow: '0 2px 16px rgba(0,0,0,.08)', overflow: 'hidden' }
  const field = { width: '100%', padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 16, boxSizing: 'border-box', marginTop: 4 }
  const label = { display: 'block', fontSize: 13.5, fontWeight: 600, color: '#334155', marginTop: 14 }

  return (
    <div style={page}>
      <div style={{ background: BRAND, color: '#fff', padding: '26px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Air-Care Connect</div>
        <div style={{ fontSize: 14, opacity: 0.92, marginTop: 4 }}>Text Message Updates Sign-Up</div>
      </div>

      <div style={{ maxWidth: 560, margin: '18px auto 16px', padding: '0 16px' }}>
        <div style={card}>
          {state === 'done' ? (
            <div style={{ padding: 28, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
              <h2 style={{ margin: '0 0 8px' }}>You're signed up</h2>
              <p style={{ color: '#475569', margin: 0 }}>
                Thanks! You'll now receive text updates from Air-Care Connect about your service.
                You can reply <strong>STOP</strong> at any time to unsubscribe, or <strong>HELP</strong> for help.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} style={{ padding: '20px 20px 24px' }}>
              <p style={{ marginTop: 0, color: '#475569', fontSize: 15, lineHeight: 1.5 }}>
                Sign up to get text updates from <strong>Air-Care Connect</strong> about your HVAC service —
                appointment confirmations, <strong>“technician on the way”</strong> alerts with live arrival
                tracking, and service reminders.
              </p>

              <label style={label}>Full name
                <input style={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
              <label style={label}>Mobile phone number <span style={{ color: '#dc2626' }}>*</span>
                <input style={field} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(352) 555-0123" autoComplete="tel" />
              </label>
              <label style={label}>Email (optional)
                <input style={field} value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" />
              </label>
              <label style={label}>ZIP code (optional)
                <input style={field} value={zip} onChange={(e) => setZip(e.target.value)} inputMode="numeric" autoComplete="postal-code" />
              </label>

              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18, fontSize: 13, color: '#334155', lineHeight: 1.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, flex: '0 0 auto', width: 18, height: 18 }} />
                <span>{CONSENT_TEXT}</span>
              </label>

              {err && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{err}</div>}

              <button type="submit" disabled={state === 'sending'} style={{ width: '100%', marginTop: 18, background: BRAND, color: '#fff', border: 'none', borderRadius: 8, padding: '13px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                {state === 'sending' ? 'Submitting…' : 'Sign Up for Text Updates'}
              </button>
            </form>
          )}
        </div>

        {/* Program details — the disclosures A2P review looks for. */}
        <div style={{ ...card, marginTop: 16, padding: '18px 20px', fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 800, color: '#1f2937', marginBottom: 6 }}>Text messaging program details</div>
          <p style={{ margin: '0 0 8px' }}><strong>Air-Care Connect Service Updates</strong> sends transactional text messages related to your HVAC service: appointment confirmations and reminders, technician dispatch and “on the way” arrival alerts (with a live tracking link), and account notifications.</p>
          <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
            <li>Message frequency varies based on your service activity.</li>
            <li>Message and data rates may apply.</li>
            <li>Reply <strong>STOP</strong> to unsubscribe at any time. Reply <strong>HELP</strong> for help, or call us at <a href="tel:+13524846341" style={{ color: BRAND }}>(352) 484-6341</a>.</li>
            <li>Consent to receive texts is not a condition of any purchase.</li>
          </ul>
          <p style={{ margin: 0 }}>
            See our <Link to="/sms-policy" style={{ color: BRAND, fontWeight: 600 }}>SMS Terms &amp; Privacy Policy</Link>.
          </p>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
          Air-Care Connect · Ocala &amp; Central Florida · <a href="tel:+13524846341" style={{ color: '#94a3b8' }}>(352) 484-6341</a><br />
          Text messaging delivered on the Journey-HVAC platform.
        </div>
      </div>
    </div>
  )
}
