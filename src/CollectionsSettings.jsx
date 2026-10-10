// Subscriber settings for automated collections ("Quincy collections").
// A single ON/OFF switch plus the reminder cadence and channels. Writes collections_settings
// (one row per org). The collections-run engine reads this on every pass.
import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

const DEFAULTS = {
  enabled: false,
  first_reminder_days: 3, second_reminder_days: 7, recurring_reminder_days: 7, uncollectable_days: 90,
  send_email: true, send_text: true, daytime_only: true, respect_text_optout: true, freeze_on_uncollectable: true,
}

export default function CollectionsSettings({ orgId }) {
  const [s, setS] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (orgId) load() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('collections_settings').select('*').eq('org_id', orgId).maybeSingle()
    setS({ ...DEFAULTS, ...(data || {}) })
    setLoading(false)
  }
  function set(k, v) { setS((p) => ({ ...p, [k]: v })); setSaved(false) }
  function num(k, v) { set(k, Math.max(0, parseInt(v || '0', 10) || 0)) }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    const row = {
      org_id: orgId, enabled: s.enabled,
      first_reminder_days: s.first_reminder_days, second_reminder_days: s.second_reminder_days,
      recurring_reminder_days: s.recurring_reminder_days, uncollectable_days: s.uncollectable_days,
      send_email: s.send_email, send_text: s.send_text, daytime_only: s.daytime_only,
      respect_text_optout: s.respect_text_optout, freeze_on_uncollectable: s.freeze_on_uncollectable,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('collections_settings').upsert(row, { onConflict: 'org_id' })
    setSaving(false); setSaved(true)
  }

  if (!orgId) return <p style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 24 }}>Select an organization to configure collections.</p>
  if (loading) return <p style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 24 }}>Loading…</p>

  const off = !s.enabled
  return (
    <form onSubmit={save} style={{ marginBottom: 28, maxWidth: 640 }}>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -6, marginBottom: 14 }}>
        When on, Quincy automatically sends friendly, escalating payment reminders for unpaid invoices by email and text,
        and stops the moment an invoice is paid. Leave it off to handle collections yourself.
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700, fontSize: 15, marginBottom: 18 }}>
        <input type="checkbox" checked={s.enabled} onChange={(e) => set('enabled', e.target.checked)} />
        Automated collections — {s.enabled ? 'ON' : 'OFF'}
      </label>

      <div style={{ opacity: off ? 0.45 : 1, pointerEvents: off ? 'none' : 'auto', transition: 'opacity .15s' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
          <Field label="First reminder (days after sent)" value={s.first_reminder_days} onChange={(v) => num('first_reminder_days', v)} />
          <Field label="Second reminder (days after sent)" value={s.second_reminder_days} onChange={(v) => num('second_reminder_days', v)} />
          <Field label="Then repeat every (days)" value={s.recurring_reminder_days} onChange={(v) => num('recurring_reminder_days', v)} />
          <Field label="Flag uncollectable at (days)" value={s.uncollectable_days} onChange={(v) => num('uncollectable_days', v)} />
        </div>
        <Check label="Send email reminders" checked={s.send_email} onChange={(v) => set('send_email', v)} />
        <Check label="Send text reminders" checked={s.send_text} onChange={(v) => set('send_text', v)} />
        <Check label="Only send texts during daytime hours (9am–6pm)" checked={s.daytime_only} onChange={(v) => set('daytime_only', v)} />
        <Check label="Honor text opt-outs (recommended)" checked={s.respect_text_optout} onChange={(v) => set('respect_text_optout', v)} />
        <Check label={`Freeze new jobs for a customer once their account hits ${s.uncollectable_days} days uncollectable`} checked={s.freeze_on_uncollectable} onChange={(v) => set('freeze_on_uncollectable', v)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button className="auth-button" type="submit" style={{ width: 'auto', padding: '9px 22px' }} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        {saved && <span style={{ color: '#4CD97B', fontSize: 14 }}>Saved</span>}
      </div>
    </form>
  )
}

function Field({ label, value, onChange }) {
  return (
    <label style={{ fontSize: 13, color: 'var(--mist)' }}>{label}
      <input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #cdd7e1', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
    </label>
  )
}
function Check({ label, checked, onChange }) {
  return (
    <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <label style={{ marginBottom: 0, cursor: 'pointer' }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginRight: 6 }} />
        {label}
      </label>
    </div>
  )
}
