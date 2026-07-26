import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { IconChevronLeft } from './MobileIcons'
import { TERMS } from './techTerms'

export default function TechSettings({ profile }) {
  const navigate = useNavigate()
  const [consent, setConsent] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('jc-theme') === 'dark' } catch { return false } })

  useEffect(() => { load() }, [])
  async function load() {
    const { data: u } = await supabase.auth.getUser()
    const uid = u?.user?.id
    if (uid) {
      const { data } = await supabase.from('tech_app_consents').select('terms_version, accepted_at').eq('user_id', uid).order('accepted_at', { ascending: false }).limit(1)
      setConsent((data && data[0]) || null)
    }
    setLoaded(true)
  }
  function toggleDark(v) { setDark(v); try { localStorage.setItem('jc-theme', v ? 'dark' : 'light') } catch { /* ignore */ } }

  return (
    <div className={`mobile-shell job-card-v2${dark ? ' jc-dark' : ''}`}>
      <div className="jc-header">
        <button className="jc-back" onClick={() => navigate('/tech')}><IconChevronLeft /></button>
        <div className="jc-header-text"><div className="jc-title">Mobile App Settings</div></div>
      </div>
      <div className="jc-body">
        <div className="jc-task">
          <div className="jc-task-head blue" style={{ cursor: 'default' }}><span className="jc-th-title">Appearance</span></div>
          <div className="jc-task-body">
            <label className="consent-agree" style={{ marginBottom: 0 }}>
              <input type="checkbox" checked={dark} onChange={(e) => toggleDark(e.target.checked)} />
              <span>Dark mode (job card)</span>
            </label>
          </div>
        </div>

        <div className="jc-task">
          <div className="jc-task-head blue" style={{ cursor: 'default' }}><span className="jc-th-title">Terms &amp; Consent</span></div>
          <div className="jc-task-body">
            {!loaded ? (
              <p className="jc-muted-note">Loading…</p>
            ) : consent ? (
              <p className="jc-muted-note">Accepted on {new Date(consent.accepted_at).toLocaleString()} (version {consent.terms_version}). Also covered by your signed onboarding form.</p>
            ) : (
              <p className="jc-muted-note">No acceptance on record for your account yet.</p>
            )}
            <button className="jc-btn ghost wide" style={{ marginTop: 10 }} onClick={() => setShowTerms((v) => !v)}>{showTerms ? 'Hide Terms' : 'Review Terms'}</button>
            {showTerms && (
              <div style={{ marginTop: 12 }}>
                {TERMS.map((t, i) => (
                  <div key={i} className="consent-item">
                    <div className="consent-num">{i + 1}</div>
                    <div><div className="consent-item-title">{t.title}</div><div className="consent-item-body">{t.body}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
