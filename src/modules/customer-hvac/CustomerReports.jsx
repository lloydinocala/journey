import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '')

export default function CustomerReports() {
  const nav = useNavigate()
  const [reports, setReports] = useState(null)
  useEffect(() => { supabase.rpc('get_my_reports').then(({ data }) => setReports(data || [])) }, [])
  return (
    <div>
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <div className="cp-sec">Service Reports</div>
      <div style={{ padding: '0 16px 24px' }}>
        {reports === null ? (
          <p style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : reports.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No maintenance reports yet. After your next tune-up, your report will appear here.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {reports.map((r) => (
              <button key={r.run_id} onClick={() => nav('/portal/report/' + r.run_id)}
                style={{ textAlign: 'left', background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 14, cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{r.checklist_name || 'Maintenance Report'}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{[r.property_address, fmt(r.completed_at)].filter(Boolean).join(' · ')}</div>
                <div style={{ fontSize: 13, color: 'var(--sky)', marginTop: 6, fontWeight: 600 }}>View report →</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
