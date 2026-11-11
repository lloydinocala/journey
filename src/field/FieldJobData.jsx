import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FieldShell, { isLate } from './FieldShell'
import { supabase } from '../utils/supabase'
import { formatTimeInZone, utcToZonedInputs, zonedToUtcIso } from '../utils/tz'

// JOBS DATA — one job at a glance for the supervisor, with "Open Job Card" to work it.
export default function FieldJobData({ profile }) {
  const navigate = useNavigate()
  const { jobId } = useParams()
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [act, setAct] = useState(null)  // 'when' | 'techs' | 'cancel'
  const [form, setForm] = useState({})
  const [people, setPeople] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let live = true
    ;(async () => {
      const { data: j, error } = await supabase.from('jobs')
        .select('id, org_id, internal_notes, job_number, segment, status, job_date, start_time, duration_hours, arrival_at, job_type, service_complaint, property_id, customers ( display_name, primary_phone, email_1 ), properties ( street_address, unit, city, state, zip )')
        .eq('id', jobId).maybeSingle()
      if (!live) return
      if (error || !j) { setErr('Job not found.'); return }
      const [{ data: jt }, { data: filters }] = await Promise.all([
        supabase.from('job_technicians').select('user_id, sort_order, users ( full_name )').eq('job_id', jobId).order('sort_order'),
        j.property_id ? supabase.from('property_filters').select('width, height, thickness, merv, quantity').eq('property_id', j.property_id) : Promise.resolve({ data: [] }),
      ])
      if (live) setD({ ...j, techIds: (jt || []).map((r) => r.user_id), techs: (jt || []).map((r) => r.users?.full_name).filter(Boolean), filters: filters || [] })
    })()
    return () => { live = false }
  }, [jobId, reload])

  function openAct(a) {
    setMsg(null)
    if (act === a) { setAct(null); return }
    setAct(a)
    if (a === 'when') { const z = utcToZonedInputs(d.start_time); setForm({ date: z.date || d.job_date || '', time: z.time || '08:00', hours: d.duration_hours ?? '' }) }
    if (a === 'techs') {
      setForm({ ids: [...(d.techIds || [])] })
      if (!people.length) supabase.from('users').select('id, full_name, role, is_field_supervisor, is_active').eq('org_id', d.org_id || profile?.org_id).order('full_name')
        .then(({ data }) => setPeople((data || []).filter((u) => u.is_active !== false && (u.role === 'tech' || u.role === 'org_admin' || u.is_field_supervisor))))
    }
    if (a === 'cancel') setForm({ reason: '' })
  }
  async function saveWhen() {
    if (!form.date || !form.time) { setMsg({ ok: false, t: 'Pick a date and time.' }); return }
    setBusy(true)
    const patch = { job_date: form.date, start_time: zonedToUtcIso(form.date, form.time), date_pending: false }
    if (form.hours !== '' && Number(form.hours) > 0) patch.duration_hours = Number(form.hours)
    const { error } = await supabase.from('jobs').update(patch).eq('id', jobId)
    setBusy(false)
    if (error) { setMsg({ ok: false, t: error.message }); return }
    setAct(null); setMsg({ ok: true, t: 'Rescheduled.' }); setReload((n) => n + 1)
  }
  async function saveTechs() {
    setBusy(true)
    const orgId = d.org_id || profile?.org_id
    const { error: e1 } = await supabase.from('job_technicians').delete().eq('job_id', jobId)
    let error = e1
    if (!error && form.ids.length) ({ error } = await supabase.from('job_technicians').insert(form.ids.map((uid, i) => ({ org_id: orgId, job_id: jobId, user_id: uid, sort_order: i }))))
    setBusy(false)
    if (error) { setMsg({ ok: false, t: error.message }); return }
    setAct(null); setMsg({ ok: true, t: form.ids.length ? 'Assigned.' : 'Unassigned.' }); setReload((n) => n + 1)
  }
  async function setStatus(status) {
    setBusy(true)
    const patch = { status }
    if (status === 'canceled' && form.reason?.trim()) patch.internal_notes = [d.internal_notes, `Canceled: ${form.reason.trim()}`].filter(Boolean).join('\n')
    const { error } = await supabase.from('jobs').update(patch).eq('id', jobId)
    setBusy(false)
    if (error) { setMsg({ ok: false, t: error.message }); return }
    setAct(null); setMsg({ ok: true, t: status === 'canceled' ? 'Job canceled.' : 'Job restored.' }); setReload((n) => n + 1)
  }

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
            {d.status !== 'completed' && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {d.status !== 'canceled' && <button type="button" className={`fa-small-btn`} style={act === 'when' ? undefined : { background: '#fff', color: 'var(--fa-navy)' }} onClick={() => openAct('when')}>Reschedule</button>}
                  {d.status !== 'canceled' && <button type="button" className="fa-small-btn" style={act === 'techs' ? undefined : { background: '#fff', color: 'var(--fa-navy)' }} onClick={() => openAct('techs')}>Assign</button>}
                  {d.status !== 'canceled'
                    ? <button type="button" className="fa-small-btn" style={act === 'cancel' ? { background: 'var(--fa-red)', borderColor: 'var(--fa-red)' } : { background: '#fff', color: 'var(--fa-red)', borderColor: 'var(--fa-red)' }} onClick={() => openAct('cancel')}>Cancel</button>
                    : <button type="button" className="fa-small-btn" style={{ gridColumn: '1 / -1' }} disabled={busy} onClick={() => setStatus('scheduled')}>Restore Job</button>}
                </div>
                {act === 'when' && (
                  <div className="fa-info" style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                    <label className="fa-section-label">Date<input className="fa-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
                    <label className="fa-section-label">Arrival time<input className="fa-input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
                    <label className="fa-section-label">Hours<input className="fa-input" inputMode="decimal" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></label>
                    <button type="button" className="fa-navbtn" disabled={busy} onClick={saveWhen}>{busy ? 'Saving…' : 'Save New Time'}</button>
                  </div>
                )}
                {act === 'techs' && (
                  <div className="fa-info" style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                    {!people.length ? <p className="fa-muted">Loading…</p> : people.map((u) => (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 600, padding: '6px 2px' }}>
                        <input type="checkbox" style={{ width: 22, height: 22 }} checked={form.ids.includes(u.id)} onChange={(e) => setForm({ ids: e.target.checked ? [...form.ids, u.id] : form.ids.filter((x) => x !== u.id) })} />
                        {u.full_name}{form.ids[0] === u.id && form.ids.length > 1 ? <span className="fa-muted" style={{ fontSize: 12 }}> (lead)</span> : ''}
                      </label>
                    ))}
                    <button type="button" className="fa-navbtn" disabled={busy || !people.length} onClick={saveTechs}>{busy ? 'Saving…' : 'Save'}</button>
                  </div>
                )}
                {act === 'cancel' && (
                  <div className="fa-info" style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                    <div style={{ fontWeight: 700 }}>Cancel this job? It comes off the calendar and the tech&apos;s list.</div>
                    <input className="fa-input" placeholder="Reason (optional)" value={form.reason} onChange={(e) => setForm({ reason: e.target.value })} />
                    <button type="button" className="fa-navbtn" style={{ background: 'var(--fa-red)', borderColor: 'var(--fa-red)' }} disabled={busy} onClick={() => setStatus('canceled')}>{busy ? 'Canceling…' : 'Yes, Cancel Job'}</button>
                  </div>
                )}
              </div>
            )}
            {msg && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`} style={{ marginTop: 8 }}>{msg.t}</div>}
          </div>
        )}
      </div>
    </FieldShell>
  )
}
