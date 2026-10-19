import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

// Settings → Jobs & Customers: when completed tasks leave the Tasks table.
// Archived tasks are hidden (not deleted) and can be shown again with "Show archived".
const OPTS = [['21', '3 weeks (default)'], ['30', '30 days'], ['60', '60 days'], ['90', '90 days'], ['180', '6 months'], ['365', '1 year'], ['never', 'Always show — never archive']]

export default function TaskSettings({ orgId }) {
  const [val, setVal] = useState('21')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!orgId) return
    supabase.from('organizations').select('task_archive_days').eq('id', orgId).single()
      .then(({ data }) => setVal(data?.task_archive_days == null ? 'never' : String(data.task_archive_days)))
  }, [orgId])
  async function save(v) {
    setVal(v)
    await supabase.from('organizations').update({ task_archive_days: v === 'never' ? null : Number(v) }).eq('id', orgId)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }
  const known = OPTS.some(([k]) => k === val)
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -6, marginBottom: 12, maxWidth: 640 }}>
        Completed, assigned tasks archive this long after they&rsquo;re stopped. Archived tasks are hidden from the Tasks table, never deleted, and stay locked as payroll records.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <label style={{ fontSize: 14 }}>Archive completed tasks after</label>
        <select value={val} onChange={(e) => save(e.target.value)} style={{ padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 7 }}>
          {!known && <option value={val}>{val} days</option>}
          {OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {saved && <span style={{ color: '#1a7f37', fontSize: 13, fontWeight: 700 }}>Saved ✓</span>}
      </div>
    </div>
  )
}
