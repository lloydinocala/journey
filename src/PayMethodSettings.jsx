// Settings → Workforce → How hourly employees are paid. One method for the whole company:
//   • Hourly — clocked hours (errands included), overtime per labor law.
//   • Task hours + hourly — task hours from completed jobs (pricebook task hours) plus errand
//     hours, at the employee's hourly rate; the labor-law check still applies (never less than
//     clocked hours × hourly rate, plus the overtime premium).
import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'

const OPTIONS = [
  ['hourly', 'Hourly', 'Pay every hourly employee for the hours on the shift clock — errands included — with overtime over 40 hours per labor law.'],
  ['task', 'Task hours + hourly', 'Pay task hours earned on completed jobs (from the pricebook) plus errand hours (errand tasks and ERRANDS jobs), at the employee\'s hourly rate. Payroll still checks the labor-law minimum: never less than clocked hours × hourly rate, plus the overtime premium over 40 hours.'],
]

export default function PayMethodSettings({ orgId }) {
  const [method, setMethod] = useState(null)
  const [settings, setSettings] = useState({})
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!orgId) return
    supabase.from('rewards_settings').select('settings').eq('org_id', orgId).maybeSingle().then(({ data }) => {
      setSettings(data?.settings || {}); setMethod(data?.settings?.hourly_pay_method === 'task' ? 'task' : 'hourly'); setMsg('')
    })
  }, [orgId])

  async function choose(m) {
    setMethod(m); setMsg('')
    const next = { ...settings, hourly_pay_method: m }
    const { error } = await supabase.from('rewards_settings').upsert({ org_id: orgId, settings: next, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
    if (error) setMsg(error.message); else { setSettings(next); setMsg('Saved') }
  }

  if (!method) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 16, marginBottom: 6 }}>How hourly employees are paid</h3>
      <p style={{ color: 'var(--mist)', fontSize: 13.5, marginTop: 0, marginBottom: 10, maxWidth: 760 }}>One method for every hourly employee. Payroll Capture starts each week this way and fills in the hours for you. Salaried employees and 1099 contractors aren't affected.</p>
      <div style={{ display: 'grid', gap: 8, maxWidth: 760 }}>
        {OPTIONS.map(([k, label, desc]) => (
          <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid ' + (method === k ? '#215F9A' : 'var(--border)'), background: method === k ? 'rgba(33,95,154,0.06)' : '#fff', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
            <input type="radio" name="hourly_pay_method" checked={method === k} onChange={() => choose(k)} style={{ marginTop: 3 }} />
            <span><b>{label}</b><br /><span style={{ fontSize: 13, color: 'var(--mist)' }}>{desc}</span></span>
          </label>
        ))}
      </div>
      {msg && <div style={{ fontSize: 13, marginTop: 6, color: msg === 'Saved' ? '#1F8A4C' : '#B00020' }}>{msg}</div>}
    </div>
  )
}
