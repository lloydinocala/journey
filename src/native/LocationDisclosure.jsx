import { useState } from 'react'

// Location disclosure shown in the store apps before the phone asks for location permission.
// Google Play requires this as its own screen (not only inside the App Use Terms): it must say
// "location", say it continues when the app is closed or not in use, and list every feature that
// uses it. Shown once per phone; the phone's own permission prompt comes right after "Continue".
export const DISCLOSURE_KEY = 'journey_location_disclosure_v1'

export function disclosureSeen() {
  try { return localStorage.getItem(DISCLOSURE_KEY) === '1' } catch { return false }
}

export const FEATURES = [
  'Showing your office where you are on the dispatch map',
  'Giving customers an accurate arrival time when you tap On My Way',
  'Planning your route between jobs',
  'Recording when you arrive at and leave a job, and your mileage',
  'Alerting you and the office if location sharing stops (worker safety)',
]

export default function LocationDisclosure({ onContinue }) {
  const [declined, setDeclined] = useState(false)

  function proceed() {
    try { localStorage.setItem(DISCLOSURE_KEY, '1') } catch { /* private mode */ }
    onContinue()
  }

  return (
    <div className="mobile-shell job-card-v2 consent-shell">
      <div className="jc-header">
        <div className="jc-header-text">
          <div className="jc-title">Location sharing</div>
          <div className="jc-sub">Please read before your phone asks</div>
        </div>
      </div>
      <div className="jc-body">
        {declined ? (
          <div className="consent-declined">
            <div className="consent-declined-badge">Location required</div>
            <h2>Jobs need location sharing</h2>
            <p>Your company requires location sharing to send you work. If you have questions, contact the office.</p>
            <button className="jc-btn wide" onClick={() => setDeclined(false)}>Go back</button>
          </div>
        ) : (
          <>
            <div className="consent-intro">
              <strong>Journey collects this phone's location and shares it with your company, including when the app is
              closed or not in use, for as long as you are signed in.</strong> Signing out stops it.
            </div>
            <div className="consent-item-title" style={{ margin: '14px 0 6px' }}>Your location is used for:</div>
            {FEATURES.map((f, i) => (
              <div key={i} className="consent-item">
                <div className="consent-num">{i + 1}</div>
                <div><div className="consent-item-body">{f}</div></div>
              </div>
            ))}
            <p className="jc-muted-note" style={{ margin: '12px 0 14px' }}>
              Your location is not sold or used for advertising. On the next screen, your phone will ask for
              permission. Choose <strong>Allow all the time</strong> (Android) or <strong>Always</strong> (iPhone).
            </p>
            <button className="jc-btn wide" onClick={proceed}>Continue</button>
            <button className="jc-btn consent-decline wide" onClick={() => setDeclined(true)}>Not now</button>
          </>
        )}
      </div>
    </div>
  )
}
