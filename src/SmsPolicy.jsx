import { Link } from 'react-router-dom'

// Public SMS Terms & Privacy Policy page. Required for A2P 10DLC review. Contains the
// carrier-mandated language — including the explicit statement that mobile opt-in data and
// consent are never shared with third parties — which reviewers specifically look for.

const BRAND = '#0B5CAB'

export default function SmsPolicy() {
  const page = { minHeight: '100vh', background: '#f4f6f9', fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif', color: '#1f2937' }
  const wrap = { maxWidth: 680, margin: '0 auto', padding: '0 18px 48px' }
  const h = { color: '#0f172a', marginTop: 28, marginBottom: 8, fontSize: 19 }
  const p = { color: '#374151', lineHeight: 1.65, fontSize: 15, margin: '0 0 10px' }

  return (
    <div style={page}>
      <div style={{ background: BRAND, color: '#fff', padding: '24px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Air-Care Connect</div>
        <div style={{ fontSize: 14, opacity: 0.92, marginTop: 4 }}>SMS Terms &amp; Privacy Policy</div>
      </div>

      <div style={wrap}>
        <p style={{ ...p, marginTop: 20, fontSize: 13, color: '#64748b' }}>Last updated: October 2026</p>

        <h2 style={h}>SMS Terms &amp; Conditions</h2>
        <p style={p}>
          When you opt in to the Air-Care Connect text messaging program, you agree to receive recurring
          automated text messages related to your HVAC service — including appointment confirmations and
          reminders, technician dispatch and “on the way” arrival alerts (with a live tracking link), and
          account notifications — at the mobile number you provide.
        </p>
        <p style={p}><strong>Message frequency varies</strong> based on your service activity.</p>
        <p style={p}><strong>Message and data rates may apply.</strong> Check with your mobile carrier for details.</p>
        <p style={p}>
          <strong>To opt out</strong>, reply <strong>STOP</strong> to any message at any time; you will receive a
          confirmation and no further messages. <strong>For help</strong>, reply <strong>HELP</strong>, email{' '}
          <a href="mailto:info@air-careconnect.com" style={{ color: BRAND }}>info@air-careconnect.com</a>, or call{' '}
          <a href="tel:+13524846341" style={{ color: BRAND }}>(352) 484-6341</a>.
        </p>
        <p style={p}>
          Carriers are not liable for delayed or undelivered messages. Consent to receive text messages is not a
          condition of any purchase.
        </p>

        <h2 style={h}>Privacy Policy</h2>
        <p style={p}>
          Air-Care Connect collects the information you provide on our opt-in form — your name, mobile number, and
          any optional details — to send you the service text messages described above and to provide and improve
          our services.
        </p>
        <p style={{ ...p, background: '#eef5ff', border: '1px solid #cfe0f7', borderRadius: 8, padding: '12px 14px', fontWeight: 600, color: '#0f2d52' }}>
          No mobile information will be shared with third parties or affiliates for marketing or promotional
          purposes. Information sharing to subcontractors in support services, such as customer service, is
          permitted. All other use case categories exclude text messaging originator opt-in data and consent; this
          information will not be shared with any third parties.
        </p>
        <p style={p}>
          We retain opt-in records as proof of consent and keep your information only as long as needed to provide
          our services or as required by law. You may request access to or deletion of your information by
          contacting us using the details below.
        </p>

        <h2 style={h}>Contact</h2>
        <p style={p}>
          Air-Care Connect · Ocala &amp; Central Florida<br />
          Phone/Text: <a href="tel:+13524846341" style={{ color: BRAND }}>(352) 484-6341</a><br />
          Email: <a href="mailto:info@air-careconnect.com" style={{ color: BRAND }}>info@air-careconnect.com</a>
        </p>

        <p style={{ marginTop: 26 }}>
          <Link to="/sms-signup" style={{ color: BRAND, fontWeight: 600 }}>← Back to sign-up</Link>
        </p>
      </div>
    </div>
  )
}
