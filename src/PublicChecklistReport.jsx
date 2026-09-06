import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './utils/supabase'
import ChecklistReport from './ChecklistReport'

export default function PublicChecklistReport() {
  const { runId } = useParams()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    supabase.functions.invoke('get-checklist-report', { body: { runId } }).then(({ data, error }) => {
      if (error || data?.error) setErr('Report not found.')
      else setData(data)
    })
  }, [runId])
  if (err) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>{err}</div>
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading…</div>
  return (
    <div style={{ background: '#EEF1F6', minHeight: '100vh', padding: '20px 0' }}>
      <style>{`@media print { .noprint { display:none !important } body { background:#fff } }`}</style>
      <div className="noprint" style={{ maxWidth: 760, margin: '0 auto 12px', display: 'flex', justifyContent: 'flex-end', padding: '0 12px' }}>
        <button onClick={() => window.print()} style={{ background: '#102A43', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}>Save as PDF / Print</button>
      </div>
      <ChecklistReport data={data} />
    </div>
  )
}
