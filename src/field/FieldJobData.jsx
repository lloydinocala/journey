import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FieldShell, { isLate } from './FieldShell'
import { supabase } from '../utils/supabase'
import { formatTimeInZone } from '../utils/tz'

// JOBS DATA — one job at a glance for the supervisor, with "Open Job Card" to work it.
export default function FieldJobData({ profile }) {
  const navigate = useNavigate()
  const { jobId } = useParams()
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    ;(async () => {
      const { data: j, error } = await supabase.from('jobs')
        .select('id, job_number, segment, status, job_date, start_time, duration_hours, arrival_at, job_type, service_complaint, property_id, customers ( display_name, primary_phone, email_1 ), properties ( street_address, unit, city, state, zip )')
        .eq('id', jobId).maybeSingle()
      if (!live) return
      if (error || !j) { setErr('Job not found.'); return }
      const [{ data: jt }, { data: filters }] = await Promise.all([
        supabase.from('job_technicians').select('users ( full_name )').eq('job_id', jobId),
        j.property_id ? supabase.from('property_filters').select('width, height, thickness, merv, quantity').eq('property_id', j.property_id) : Promise.resolve({ data: [] }),
      ])
      if (live) setD({ ...j, techs: (jt || []).map((r) => r.users?.full_name).filter(Boolean), filters: filters || [] })
    })()
    return () => { live = false }
  }, [jobId])

  const p = d?.properties
  const late = d && d.status !== 'completed' && isLate(d)
  return (
    <FieldShell profile={profile} title="Jobs Data" onBack={() => navigate(-1)}>
      <div className="fa-panel" style={{ display: 'block', padding: '16px 18px' }}>
        {err ? <p className="fa-empty">{err}</p> : !d ? <p className="fa-empty">Loading…</p> : (
          <div style={{ fontSize: 16, lineHeight: 1.35, color: 'var(--fa-ink)' }}>
            <div style={{ fontWeight: 600 }}>JOB # {d.job_number}{d.segment > 1 ? `-${d.segment}` : ''}</div>
            <div style={{ fontSize: 21, fontWeight: 800, color: '#1F4E79' }}>{d.customers?.display_name}</div>
            {late && <div className="fa-msg err" style={{ margin: '8px 0' }}>Running late — the tech hasn&apos;t arrived.</div>}
            <div style={{ marginTop: 14, fontWeight: 600 }}>Date: {d.job_date ? new Date(d.job_date + 'T12:00:00').toLocaleDateString('en-US') : '—'}</div>
            <div style={{ fontWeight: 600 }}>{d.start_time ? formatTimeInZone(d.start_time) : 'No time set'}{d.status ? ` · ${String(d.status).replace(/_/g, ' ')}` : ''}</div>
            <div style={{ marginTop: 14, fontWeight: 600 }}>{String(d.job_type || 'Job').toUpperCase()}{d.duration_hours ? ` - ${d.duration_hours} Hrs Duration` : ''}</div>
            {d.service_complaint && <div style={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>{d.service_complaint}</div>}
            <div style={{ marginTop: 14, fontWeight: 600 }}>Assigned: {d.techs.length ? d.techs.join(', ') : 'No tech'}</div>
            {p?.street_address && <div style={{ marginTop: 14, fontWeight: 600 }}>{p.street_address}{p.unit ? ` #${p.unit}` : ''}, {p.city} {p.zip || ''}</div>}
            {d.customers?.primary_phone && <div style={{ fontWeight: 600 }}><a href={`tel:${String(d.customers.primary_phone).replace(/[^\d+]/g, '')}`} style={{ color: 'inherit' }}>{d.customers.primary_phone}</a></div>}
            {d.customers?.email_1 && <div style={{ fontWeight: 600 }}>{d.customers.email_1}</div>}
            {d.filters.length > 0 && (
              <div style={{ marginTop: 14, fontWeight: 600 }}>Filters: {d.filters.map((f) => `(${f.quantity || 1}) ${[f.width, f.height].filter((n) => n != null).join(' × ')}${f.thickness ? ` × ${f.thickness}` : ''}${f.merv != null ? ` MERV ${f.merv}` : ''}`).join('; ')}</div>
            )}
            <button type="button" className="fa-navbtn" style={{ marginTop: 18 }} onClick={() => navigate(`/tech/${d.id}`)}>Open Job Card</button>
            <button type="button" className="fa-navbtn ghost" style={{ marginTop: 8 }} onClick={() => navigate(`/tech/messages/${d.id}`)}>Messages</button>
          </div>
        )}
      </div>
    </FieldShell>
  )
}
