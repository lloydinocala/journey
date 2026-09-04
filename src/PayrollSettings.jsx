import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function PayrollSettings({ orgId }) {
  const [startDow, setStartDow] = useState(1)
  const [days, setDays] = useState(7)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!orgId) return
    supabase.from('organizations').select('pay_period_start_dow, pay_period_days').eq('id', orgId).single().then(({ data }) => {
      setStartDow(data?.pay_period_start_dow ?? 1); setDays(data?.pay_period_days ?? 7); setSaved(false)
    })
  }, [orgId])

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('organizations').update({ pay_period_start_dow: startDow, pay_period_days: days }).eq('id', orgId)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 13.5, color: 'var(--mist)', marginTop: -6, maxWidth: 580 }}>
        Sets the pay period used in Payroll Capture. <strong>Start day</strong> is the first day of each period; <strong>number of days</strong> is its length (7 = weekly, 14 = biweekly).
      </p>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Pay period starts on</label>
          <select value={startDow} onChange={(e) => setStartDow(Number(e.target.value))}>
            {DOW.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Number of days</label>
          <input type="number" min="1" max="31" value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} style={{ width: 90 }} />
        </div>
        <button className="auth-button" style={{ width: 'auto' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save pay period'}</button>
        {saved && <span style={{ color: '#1a7f37', fontSize: 14, marginBottom: 8 }}>Saved ✓</span>}
      </div>
    </div>
  )
}
