import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import ChecklistReport from '../../ChecklistReport'

export default function CustomerReportView() {
  const { runId } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    supabase.functions.invoke('get-checklist-report', { body: { runId } }).then(({ data, error }) => {
      if (error || data?.error) setErr('Report not found.')
      else setData(data)
    })
  }, [runId])
  return (
    <div>
      <div className="noprint">
        <button className="cp-back" onClick={() => nav('/portal/reports')}>‹ Service Reports</button>
      </div>
      <style>{`@media print { .noprint { display:none !important } }`}</style>
      {err ? <p style={{ padding: 16, color: '#C0392B' }}>{err}</p>
        : !data ? <p style={{ padding: 16, color: 'var(--muted)' }}>Loading…</p>
        : (
          <div style={{ padding: '0 8px 24px' }}>
            <div className="noprint" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={() => window.print()} style={{ background: 'var(--sky)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Save PDF / Print</button>
            </div>
            <ChecklistReport data={data} />
          </div>
        )}
    </div>
  )
}
