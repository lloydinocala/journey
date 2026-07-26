import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { TERMS_VERSION, TERMS } from './techTerms'

// Consent gate wrapping every mobile job view. Any signed-in employee who opens
// the field app must accept the current terms (message archiving + always-on GPS)
// before any jobs load. Declining blocks all job access. Versioned re-consent.
export default function TechGate({ profile }) {
  const [state, setState] = useState('loading') // loading | need | ok | declined
  const [agree, setAgree] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { check() }, [])

  async function check() {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) { setState('need'); return }
      const { data } = await supabase
        .from('tech_app_consents')
        .select('id')
        .eq('user_id', uid)
        .eq('terms_version', TERMS_VERSION)
        .limit(1)
      setState(data && data.length ? 'ok' : 'need')
    } catch {
      setState('need')
    }
  }

  async function accept() {
    if (!agree) return
    setSaving(true); setErr('')
    const { data: u } = await supabase.auth.getUser()
    const uid = u?.user?.id
    const { error } = await supabase.from('tech_app_consents').insert({
      user_id: uid, org_id: profile?.org_id || null, terms_version: TERMS_VERSION, user_agent: navigator.userAgent,
    })
    setSaving(false)
    if (error) { setErr('Could not save your acceptance — please try again.'); return }
    setState('ok')
  }

  if (state === 'loading') {
    return (
      <div className="mobile-shell job-card-v2">
        <div className="jc-header"><div className="jc-header-text"><div className="jc-title">Air-Care Field App</div></div></div>
        <div className="jc-body"><p className="jc-muted-note">Loading…</p></div>
      </div>
    )
  }
  if (state === 'ok') return <Outlet />

  return (
    <div className="mobile-shell job-card-v2 consent-shell">
      <div className="jc-header">
        <div className="jc-header-text">
          <div className="jc-title">Before You Start</div>
          <div className="jc-sub">Field app terms — required to receive work</div>
        </div>
      </div>
      <div className="jc-body">
        {state === 'declined' ? (
          <div className="consent-declined">
            <div className="consent-declined-badge">Access blocked</div>
            <h2>You can't receive jobs until you accept</h2>
            <p>These conditions are required to use the field app. They're also covered by the form you signed during onboarding. If you have questions, contact the office — otherwise review and accept to continue.</p>
            <button className="jc-btn wide" onClick={() => { setState('need'); setAgree(false) }}>Review the Terms</button>
          </div>
        ) : (
          <>
            <div className="consent-intro">
              Please review and accept these conditions for using the Air-Care field app on this device.
              Acceptance is <strong>required</strong> before you can view or work jobs.
            </div>
            {TERMS.map((t, i) => (
              <div key={i} className="consent-item">
                <div className="consent-num">{i + 1}</div>
                <div>
                  <div className="consent-item-title">{t.title}</div>
                  <div className="consent-item-body">{t.body}</div>
                </div>
              </div>
            ))}
            <label className="consent-agree">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I have read and agree to these conditions.</span>
            </label>
            {err && <p style={{ color: 'var(--jc-red)', fontWeight: 700, fontSize: 13, margin: '4px 0 8px' }}>{err}</p>}
            <button className="jc-btn wide" disabled={!agree || saving} onClick={accept}>
              {saving ? 'Saving…' : 'Agree & Continue'}
            </button>
            <button className="jc-btn consent-decline wide" onClick={() => setState('declined')}>Decline</button>
          </>
        )}
      </div>
    </div>
  )
}
