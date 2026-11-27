import { useEffect, useState } from 'react'
import { supabase } from '../../utils/supabase'
import { inCustomerApp, enablePush, pushStatus, MONTHS } from './customerPush'

// The customer's notification switches and (optional) birthday. Used two ways:
//  - welcome: the one-time screen after first sign-in (shown before the phone's own permission prompt)
//  - settings: the Notifications section of Edit Personal Info
export default function NotifySettings({ brandName, mode = 'settings', onDone, onOpenUrl }) {
  const app = inCustomerApp()
  const [p, setP] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState('unavailable')
  const company = brandName || 'your HVAC company'

  useEffect(() => {
    supabase.rpc('customer_notify_prefs_get').then(({ data }) => {
      const d = data || {}
      setP({
        service: d.service_updates !== false,
        // First time (welcome): greetings start on, news off. After that, what the customer chose.
        greetings: d.consent_at ? !!d.greetings : true,
        news: !!d.news,
        month: d.birthday_month ? String(d.birthday_month) : '',
        day: d.birthday_day ? String(d.birthday_day) : '',
      })
    })
    pushStatus().then(setStatus)
  }, [])

  if (!p) return null
  const set = (k, v) => { setP((x) => ({ ...x, [k]: v })); setSaved(false) }

  async function save(skip) {
    setBusy(true)
    if (app) {
      await supabase.rpc('customer_notify_prefs_set', {
        p_service: skip ? true : p.service, p_greetings: skip ? false : p.greetings, p_news: skip ? false : p.news,
      })
    }
    if (!skip) {
      await supabase.rpc('customer_set_birthday', {
        p_month: p.month && p.day ? Number(p.month) : null, p_day: p.month && p.day ? Number(p.day) : null,
      })
    }
    if (app && !skip && (p.service || p.greetings || p.news)) setStatus(await enablePush(onOpenUrl))
    try { localStorage.setItem('cp_welcome_done', '1') } catch { /* ignore */ }
    setBusy(false); setSaved(true)
    if (onDone) onDone()
  }

  const Toggle = ({ k, title, text }) => (
    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderTop: '1px solid var(--line)', cursor: 'pointer' }}>
      <input type="checkbox" checked={p[k]} onChange={(e) => set(k, e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, flexShrink: 0 }} />
      <span><b style={{ fontSize: 15.5 }}>{title}</b><br /><span style={{ fontSize: 14, color: 'var(--muted)' }}>{text}</span></span>
    </label>
  )

  const birthday = (
    <>
      <div className="cp-label">Your birthday <span style={{ fontWeight: 600, color: 'var(--muted)' }}>(month and day)</span></div>
      <p className="cp-note" style={{ marginTop: 0 }}>We’ll use it to confirm it’s really you when you call {company} about your account. No year needed.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <select className="cp-sel" value={p.month} onChange={(e) => set('month', e.target.value)} aria-label="Birthday month">
          <option value="">Month</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className="cp-sel" value={p.day} onChange={(e) => set('day', e.target.value)} aria-label="Birthday day" style={{ maxWidth: 110 }}>
          <option value="">Day</option>
          {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
      </div>
      <p className="cp-note" style={{ fontSize: 12.5 }}>…and we may send you a birthday note.</p>
    </>
  )

  return (
    <div className="cp-card">
      {mode === 'welcome' && (
        <>
          <h2 className="cp-h2" style={{ marginTop: 0 }}>{app ? `Welcome to ${company}` : 'One quick thing'}</h2>
          <p className="cp-lead" style={{ marginBottom: 8 }}>{app ? 'Add your birthday to protect your account, and choose what you’d like to hear about. You can change this anytime in Edit Personal Info.' : 'Add your birthday to protect your account.'}</p>
        </>
      )}
      {mode === 'welcome' && birthday}
      {mode === 'welcome' && app && <div className="cp-label">Notifications</div>}
      {mode === 'settings' && app && <div className="cp-label" style={{ marginTop: 0 }}>Notifications</div>}
      {app && (
        <>
          <Toggle k="service" title="Service Updates" text="When your technician is on the way, reminders the day before a visit, and when an invoice is ready." />
          <Toggle k="greetings" title="Goodwill" text={`A birthday note and holiday greeting from ${company}, plus heads-ups before extreme heat, freezing nights and storms.`} />
          <Toggle k="news" title="Optional Messages" text={`Occasional news and offers from ${company}. At most a couple a week.`} />
          {status === 'denied' && <p className="cp-note">Notifications are turned off for this app in your phone’s settings. To get them, open your phone’s Settings, find this app, and turn on Notifications.</p>}
        </>
      )}
      {mode === 'settings' && birthday}
      <div style={{ height: 14 }} />
      <button className="cp-btn" onClick={() => save(false)} disabled={busy}>{busy ? 'Saving…' : mode === 'welcome' ? 'Continue' : 'Save'}</button>
      {mode === 'welcome' && <><div style={{ height: 8 }} /><button className="cp-btn ghost" onClick={() => save(true)} disabled={busy}>Not now</button></>}
      {saved && mode === 'settings' && <p className="cp-note">Saved, thank you!</p>}
    </div>
  )
}
