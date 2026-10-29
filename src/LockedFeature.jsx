import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Shown in place of a page that isn't part of this subscriber's Journey subscription.
// "I'm interested" files a feature request so the Journey office knows to follow up.
export default function LockedFeature({ profile, featureKey, mobile }) {
  const [feat, setFeat] = useState(null)
  const [state, setState] = useState('') // '' | sending | sent | error
  useEffect(() => {
    if (!featureKey) return
    supabase.from('features').select('key, name, description').eq('key', featureKey).maybeSingle().then(({ data }) => setFeat(data || { key: featureKey, name: featureKey }))
  }, [featureKey])

  async function interested() {
    setState('sending')
    const { error } = await supabase.from('feature_requests').insert({
      org_id: profile?.org_id, user_id: profile?.id, feature_key: featureKey,
      title: `Interested in ${feat?.name || featureKey}`, source: 'locked_page',
    })
    setState(error ? 'error' : 'sent')
  }

  return (
    <div style={{ padding: mobile ? 16 : 32, maxWidth: 620 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mist)' }}>Not in your subscription</div>
      <h2 style={{ margin: '6px 0 8px' }}>{feat?.name || 'This feature'}</h2>
      {feat?.description && <p style={{ fontSize: 14.5, lineHeight: 1.55, margin: '0 0 14px' }}>{feat.description}</p>}
      <p style={{ fontSize: 14, color: 'var(--mist)', margin: '0 0 16px' }}>
        This is an add-on package for your Journey account. Your data is never affected — tap below and the Journey team will reach out about adding it, including a free trial.
      </p>
      {state === 'sent' ? (
        <div style={{ background: '#E3F1E8', color: '#166534', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 14 }}>Thanks — the Journey team will be in touch about {feat?.name || 'this package'}.</div>
      ) : (
        <button className="auth-button" style={{ width: 'auto', padding: '9px 22px', margin: 0 }} disabled={state === 'sending'} onClick={interested}>
          {state === 'sending' ? 'Sending…' : "I'm interested — tell me more"}
        </button>
      )}
      {state === 'error' && <div className="auth-error" style={{ marginTop: 10 }}>Couldn&rsquo;t send that just now — please try again.</div>}
      <div style={{ marginTop: 18 }}><Link to={mobile ? '/tech' : '/home'} style={{ fontSize: 13.5 }}>← Back</Link></div>
    </div>
  )
}

// "Suggest a feature" — anything a subscriber wishes Journey did. Goes to the Journey office.
export function SuggestFeature({ profile, compact }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [state, setState] = useState('')
  if (!profile?.org_id || profile.role === 'super_admin') return null
  async function send(e) {
    e.preventDefault()
    if (!title.trim()) return
    setState('sending')
    const { error } = await supabase.from('feature_requests').insert({ org_id: profile.org_id, user_id: profile.id, title: title.trim(), details: details.trim() || null, source: 'help' })
    if (error) { setState('error'); return }
    setState('sent'); setTitle(''); setDetails('')
  }
  if (!open) return <button type="button" onClick={() => { setOpen(true); setState('') }} style={{ background: 'none', border: 'none', color: 'var(--accent, #2E6FB5)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: compact ? 13 : 14 }}>💡 Suggest a feature</button>
  return (
    <form onSubmit={send} style={{ border: '1px solid var(--border, #D5DAE1)', borderRadius: 10, padding: 12, background: '#fff', marginTop: 6 }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>What do you wish Journey did?</div>
      {state === 'sent' ? (
        <div style={{ color: '#166534', fontSize: 13.5, fontWeight: 600 }}>Thanks — it went straight to the Journey team.</div>
      ) : (
        <>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="One line, e.g. Text customers when a part arrives" style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border, #D5DAE1)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 6 }} />
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="How would you use it? (optional)" style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border, #D5DAE1)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="submit" className="auth-button" style={{ width: 'auto', padding: '6px 16px', margin: 0 }} disabled={state === 'sending' || !title.trim()}>{state === 'sending' ? 'Sending…' : 'Send'}</button>
            <button type="button" className="logout-button" style={{ width: 'auto', padding: '6px 14px', margin: 0 }} onClick={() => setOpen(false)}>Cancel</button>
          </div>
          {state === 'error' && <div style={{ color: '#B00020', fontSize: 13, marginTop: 6 }}>Couldn&rsquo;t send — please try again.</div>}
        </>
      )}
    </form>
  )
}

// Banner when a trial package ends within 7 days.
export function TrialBanner({ profile }) {
  const [trials, setTrials] = useState([])
  useEffect(() => {
    if (!profile?.org_id || profile.role === 'super_admin') return
    const soon = new Date(Date.now() + 7 * 86400000).toISOString()
    supabase.from('org_addons').select('feature_key, trial_ends_at, features(name)').eq('org_id', profile.org_id).eq('enabled', true)
      .gt('trial_ends_at', new Date().toISOString()).lte('trial_ends_at', soon)
      .then(({ data }) => setTrials(data || []))
  }, [profile?.org_id, profile?.role])
  const [kept, setKept] = useState({})
  if (!trials.length) return null
  async function keep(t) {
    const { error } = await supabase.from('feature_requests').insert({ org_id: profile.org_id, user_id: profile.id, feature_key: t.feature_key, title: `Keep ${t.features?.name || t.feature_key} after the trial`, source: 'trial' })
    if (!error) setKept((k) => ({ ...k, [t.feature_key]: true }))
  }
  return (
    <div style={{ background: '#FFF7E6', borderBottom: '1px solid #F5C542', padding: '8px 16px', fontSize: 13.5, color: '#7A4B00' }}>
      {trials.map((t) => (
        <div key={t.feature_key} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Your free trial of <b>{t.features?.name || t.feature_key}</b> ends {new Date(t.trial_ends_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}. Your data stays either way.</span>
          {kept[t.feature_key]
            ? <span style={{ fontWeight: 700 }}>Thanks — the Journey team will set it up.</span>
            : <button type="button" onClick={() => keep(t)} style={{ border: '1px solid #B8720A', background: '#fff', color: '#7A4B00', borderRadius: 6, padding: '3px 10px', fontWeight: 700, cursor: 'pointer' }}>Keep it</button>}
        </div>
      ))}
    </div>
  )
}
