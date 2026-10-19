import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

// Settings → Dispatch: how long finished service requests stay on the page before they
// archive themselves (hidden, never deleted; still counted in the success report).
export default function ServiceRequestSettings({ orgId }) {
  const [days, setDays] = useState('30')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!orgId) return
    supabase.from('organizations').select('service_request_archive_days').eq('id', orgId).single()
      .then(({ data }) => setDays(String(data?.service_request_archive_days ?? 30)))
  }, [orgId])
  async function save() {
    const n = Math.max(1, Math.min(3650, parseInt(days, 10) || 30))
    await supabase.from('organizations').update({ service_request_archive_days: n }).eq('id', orgId)
    setDays(String(n)); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ color: 'var(--mist)', fontSize: 14, marginTop: -6, marginBottom: 12, maxWidth: 640 }}>
        Finished requests archive themselves after this many days: declined requests after the decision, approved requests after the job is paid in full. Archived requests are hidden from the page, never deleted, and still count in the report.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <label style={{ fontSize: 14 }}>Archive after</label>
        <input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 80, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 7 }} />
        <span style={{ fontSize: 14 }}>days</span>
        <button className="auth-button" style={{ width: 'auto', margin: 0, padding: '8px 18px' }} onClick={save}>Save</button>
        {saved && <span style={{ color: '#1a7f37', fontSize: 13, fontWeight: 700 }}>Saved ✓</span>}
      </div>
    </div>
  )
}
