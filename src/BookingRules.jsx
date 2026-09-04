import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

const TYPES = [
  { key: 'repair', label: 'Service Call', unit: 'hours' },
  { key: 'system_quote', label: 'Free Estimate', unit: 'hours' },
  { key: 'pm', label: 'Preventive Maintenance', unit: 'bdays' },
  { key: 'duct_cleaning', label: 'Duct Cleaning', unit: 'bdays', amOnly: true },
]
const DEFAULTS = {
  daily_cap: 4,
  repair: { days: 'mon_fri', lead_hours: 0 },
  system_quote: { days: 'mon_fri', lead_hours: 4 },
  pm: { days: 'mon_fri', lead_bdays: 2 },
  duct_cleaning: { days: 'mon_fri', lead_bdays: 3, am_only: true },
}
const box = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }

export default function BookingRules({ orgId }) {
  const [rules, setRules] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!orgId) return
    supabase.from('organizations').select('booking_rules').eq('id', orgId).single().then(({ data }) => {
      const r = data?.booking_rules || {}
      const merged = { ...DEFAULTS, ...r, daily_cap: r.daily_cap ?? DEFAULTS.daily_cap }
      for (const t of TYPES) merged[t.key] = { ...DEFAULTS[t.key], ...(r[t.key] || {}) }
      setRules(merged); setSaved(false)
    })
  }, [orgId])

  function setType(key, field, value) {
    setRules((r) => ({ ...r, [key]: { ...r[key], [field]: value } })); setSaved(false)
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('organizations').update({ booking_rules: rules }).eq('id', orgId)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  if (!rules) return null

  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 13.5, color: 'var(--mist)', marginTop: -6, maxWidth: 580 }}>
        Controls what customers can self-book in the portal. “Minimum notice” is how far ahead they must book.
        Duct cleanings are always scheduled at 9:00 AM. Service Calls can also add same-day ASAP.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 18px' }}>
        <label style={{ fontSize: 14, fontWeight: 600 }}>Max self-bookings per day</label>
        <input type="number" min="0" value={rules.daily_cap ?? 4} style={{ ...box, width: 72 }}
          onChange={(e) => { const v = parseInt(e.target.value || '0', 10); setRules((r) => ({ ...r, daily_cap: v })); setSaved(false) }} />
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 640 }}>
        <thead>
          <tr style={{ textAlign: 'left', fontSize: 11.5, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            <th style={{ padding: '6px 8px' }}>Service</th>
            <th style={{ padding: '6px 8px' }}>Days</th>
            <th style={{ padding: '6px 8px' }}>Minimum notice</th>
          </tr>
        </thead>
        <tbody>
          {TYPES.map((t) => {
            const r = rules[t.key] || {}
            const field = t.unit === 'hours' ? 'lead_hours' : 'lead_bdays'
            const val = r[field] ?? 0
            return (
              <tr key={t.key} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 8px', fontWeight: 600 }}>{t.label}</td>
                <td style={{ padding: '10px 8px' }}>
                  <select value={r.days || 'mon_fri'} style={box} onChange={(e) => setType(t.key, 'days', e.target.value)}>
                    <option value="mon_fri">Mon–Fri</option>
                    <option value="mon_sat">Mon–Sat</option>
                  </select>
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <input type="number" min="0" value={val} style={{ ...box, width: 66 }}
                    onChange={(e) => setType(t.key, field, parseInt(e.target.value || '0', 10))} />
                  <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--mist)' }}>{t.unit === 'hours' ? 'hours' : 'business days'}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <button className="auth-button" style={{ width: 'auto', marginTop: 16, padding: '8px 20px' }} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save booking rules'}
      </button>
      {saved && <span style={{ marginLeft: 12, color: '#1a7f37', fontSize: 14 }}>Saved ✓</span>}
    </div>
  )
}
