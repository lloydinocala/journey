// Rewards-HVAC · Settings — go-live switch + org payroll configuration
import { useState, useEffect } from 'react'
import { getSettings, upsertSettings } from './hrData'
import { useOrgSelector, OrgBar, EnabledPill } from './shared'

const FREQ = [
  { v: 'weekly', l: 'Weekly' },
  { v: 'biweekly', l: 'Bi-weekly' },
  { v: 'semimonthly', l: 'Semi-monthly' },
]
const STATES = ['FL', 'AL', 'GA', 'SC', 'NC', 'TN', 'TX', 'CA', 'NY', 'PA', 'OH', 'Other']

export default function RewardsSettings({ profile }) {
  const org = useOrgSelector(profile)
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    if (!org.selectedOrg) return
    const data = await getSettings(org.selectedOrg)
    setS(data || {
      enabled: false, pay_frequency: 'weekly', work_state: 'FL',
      default_deposit_schedule: 'monthly', tax_setaside_account_label: '', fein: '',
      reporting_agent_enabled: false,
    })
  }
  useEffect(() => { load() }, [org.selectedOrg])

  async function save(patch) {
    setSaving(true); setMsg('')
    const next = { ...s, ...patch }
    setS(next)
    const { error } = await upsertSettings(org.selectedOrg, {
      enabled: next.enabled,
      pay_frequency: next.pay_frequency,
      work_state: next.work_state,
      default_deposit_schedule: next.default_deposit_schedule,
      tax_setaside_account_label: next.tax_setaside_account_label || null,
      fein: next.fein || null,
      reporting_agent_enabled: next.reporting_agent_enabled,
    })
    setSaving(false)
    setMsg(error ? error.message : 'Saved.')
  }

  if (!s) return <p style={{ color: 'var(--mist)' }}>Loading…</p>

  return (
    <div>
      <div className="page-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Rewards Settings</h2>
          <EnabledPill enabled={s.enabled} />
        </div>
      </div>
      <OrgBar {...org} />

      <div style={{ maxWidth: 640 }}>
        <div style={{
          border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Go live with payroll</div>
            <div style={{ color: 'var(--mist)', fontSize: 13, marginTop: 4 }}>
              HR features (people, hiring, onboarding, certifications) work in setup mode without this.
              Turning on marks the org ready for live paychecks &amp; tax filing (Phase R2+). Leave off during setup.
            </div>
          </div>
          <button
            className="auth-button"
            style={{ width: 'auto', margin: 0, background: s.enabled ? 'var(--alert-orange)' : '#1B3A6B' }}
            disabled={saving}
            onClick={() => save({ enabled: !s.enabled })}
          >
            {s.enabled ? 'Turn Off' : 'Turn On'}
          </button>
        </div>

        <form className="inline-form" style={{ flexWrap: 'wrap', gap: 16 }} onSubmit={(e) => { e.preventDefault(); save({}) }}>
          <div className="field">
            <label>Pay frequency</label>
            <select value={s.pay_frequency} onChange={(e) => setS({ ...s, pay_frequency: e.target.value })}>
              {FREQ.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Work state</label>
            <select value={s.work_state} onChange={(e) => setS({ ...s, work_state: e.target.value })}>
              {STATES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Federal deposit schedule</label>
            <select value={s.default_deposit_schedule} onChange={(e) => setS({ ...s, default_deposit_schedule: e.target.value })}>
              <option value="monthly">Monthly</option>
              <option value="semiweekly">Semi-weekly</option>
            </select>
          </div>
          <div className="field">
            <label>Employer FEIN</label>
            <input type="text" value={s.fein || ''} placeholder="00-0000000" onChange={(e) => setS({ ...s, fein: e.target.value })} />
          </div>
          <div className="field" style={{ minWidth: 260 }}>
            <label>Tax set-aside account label</label>
            <input type="text" value={s.tax_setaside_account_label || ''} placeholder="e.g. Payroll Tax Savings" onChange={(e) => setS({ ...s, tax_setaside_account_label: e.target.value })} />
          </div>
          <button className="auth-button" type="submit" style={{ width: 'auto' }} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
        <p style={{ color: 'var(--mist)', fontSize: 12, marginTop: 10 }}>
          Work state drives withholding &amp; labor rules. Florida has no state income tax, so a Florida org needs
          federal withholding only. The set-aside account label is the contractor's own account where withheld
          taxes are quarantined each payroll — Rewards never holds the money.
        </p>
        {msg && <div style={{ marginTop: 12, color: msg === 'Saved.' ? '#166534' : '#B00020' }}>{msg}</div>}
      </div>
    </div>
  )
}
