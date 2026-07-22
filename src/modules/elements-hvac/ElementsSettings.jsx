// Elements-HVAC · Inventory Settings — enable toggle + weekly cadence + reorder defaults
import { useState, useEffect } from 'react'
import { getSettings, upsertSettings } from './data'
import { useOrgSelector, OrgBar, EnabledPill } from './shared'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ElementsSettings({ profile }) {
  const org = useOrgSelector(profile)
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const s = await getSettings(org.selectedOrg)
    setSettings(
      s || {
        enabled: false,
        issue_day_of_week: 1,
        replenish_mode: 'restock_to_par',
        default_lead_time_days: 2,
        safety_days: 7,
      }
    )
  }
  useEffect(() => { load() }, [org.selectedOrg])

  async function save(patch) {
    setSaving(true)
    setMsg('')
    const next = { ...settings, ...patch }
    setSettings(next)
    const { error } = await upsertSettings(org.selectedOrg, {
      enabled: next.enabled,
      issue_day_of_week: next.issue_day_of_week,
      replenish_mode: next.replenish_mode || 'restock_to_par',
      default_lead_time_days: next.default_lead_time_days,
      safety_days: next.safety_days,
    })
    setSaving(false)
    setMsg(error ? error.message : 'Saved.')
  }

  if (!settings) return <p style={{ color: 'var(--mist)' }}>Loading…</p>

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Inventory Settings</h2>
          <EnabledPill enabled={settings.enabled} />
        </div>
      </div>
      <OrgBar {...org} />

      <div style={{ maxWidth: 620 }}>
        <div
          style={{
            border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Enable Elements-HVAC Inventory</div>
            <div style={{ color: 'var(--mist)', fontSize: 13, marginTop: 4 }}>
              When on, invoiced pricebook parts deduct from the assigned technician's truck.
              Leave off until items, trucks, and service mappings are ready.
            </div>
          </div>
          <button
            className="auth-button"
            style={{ width: 'auto', margin: 0, background: settings.enabled ? 'var(--alert-orange)' : '#1B3A6B' }}
            disabled={saving}
            onClick={() => save({ enabled: !settings.enabled })}
          >
            {settings.enabled ? 'Turn Off' : 'Turn On'}
          </button>
        </div>

        <form className="inline-form" style={{ flexWrap: 'wrap' }} onSubmit={(e) => { e.preventDefault(); save({}) }}>
          <div className="field">
            <label>Weekly truck issue-day</label>
            <select
              value={settings.issue_day_of_week ?? 1}
              onChange={(e) => setSettings({ ...settings, issue_day_of_week: parseInt(e.target.value, 10) })}
            >
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Default vendor lead time (days)</label>
            <input
              type="number" min="0"
              value={settings.default_lead_time_days ?? 2}
              onChange={(e) => setSettings({ ...settings, default_lead_time_days: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div className="field">
            <label>Safety stock (days)</label>
            <input
              type="number" min="0"
              value={settings.safety_days ?? 7}
              onChange={(e) => setSettings({ ...settings, safety_days: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
        <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 8 }}>
          Lead time is per-vendor on the vendor record; this is the fallback when a vendor has none.
          Safety-stock default is 7 days (revisit later).
        </p>
        {msg && <div style={{ marginTop: 12, color: msg === 'Saved.' ? '#166534' : '#B00020' }}>{msg}</div>}
      </div>
    </div>
  )
}
