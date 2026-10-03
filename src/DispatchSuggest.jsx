import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'

// AI Dispatch panel — for each UNASSIGNED job, ask the dispatch-suggest edge function
// to rank technicians (drive time + workload + territory) with a plain-English reason,
// then let the dispatcher APPROVE a tech. It never auto-assigns: a tech is placed only
// when the dispatcher clicks Assign. Self-contained so it drops into DispatchMap with
// one line; calls onAssigned() after a successful assign so the map refreshes.

const ORIGIN_LABEL = {
  gps: 'from live GPS',
  stop: 'from their first stop',
  gps_stale: 'from last known GPS',
}

function fitColor(score) {
  if (score >= 85) return '#1F8A4C'
  if (score >= 65) return '#B7791F'
  return '#B5462F'
}

export default function DispatchSuggest({ profile, selectedOrg, date, onAssigned }) {
  const [rows, setRows] = useState([])          // unassigned jobs
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(true)
  const [sg, setSg] = useState({})              // jobId -> { loading, error, usedMapbox, suggestions }
  const [assigning, setAssigning] = useState('') // `${jobId}:${techId}` while a write is in flight

  async function load() {
    if (!selectedOrg) { setRows([]); return }
    setLoading(true)
    // (a) jobs on the selected date with no technician, and (b) pending bookings (any date).
    const sel = 'id, job_number, job_type, job_date, date_pending, requested_window, property_id, job_technicians(id), properties(street_address, unit, city, state, zip, latitude, longitude, customers!properties_customer_id_fkey(display_name))'
    const [{ data: dayJobs }, { data: pend }] = await Promise.all([
      supabase.from('jobs').select(sel).eq('org_id', selectedOrg).eq('job_date', date).is('deleted_at', null).neq('status', 'cancelled'),
      supabase.from('jobs').select(sel).eq('org_id', selectedOrg).eq('date_pending', true).is('deleted_at', null).neq('status', 'cancelled'),
    ])
    const seen = new Set()
    const mk = (j, pending) => ({
      id: j.id, job_number: j.job_number, job_type: j.job_type, job_date: j.job_date,
      date_pending: pending, requested_window: j.requested_window,
      customer_name: j.properties?.customers?.display_name || 'Customer',
      address: [j.properties?.street_address, j.properties?.city].filter(Boolean).join(', '),
      has_loc: j.properties?.latitude != null,
    })
    const out = []
    for (const j of (dayJobs || [])) {
      if ((j.job_technicians || []).length > 0) continue      // already assigned
      if (seen.has(j.id)) continue; seen.add(j.id)
      out.push(mk(j, j.date_pending))
    }
    for (const j of (pend || [])) {
      if ((j.job_technicians || []).length > 0) continue
      if (seen.has(j.id)) continue; seen.add(j.id)
      out.push(mk(j, true))
    }
    setRows(out)
    setLoading(false)
  }

  useEffect(() => { load() }, [selectedOrg, date]) // eslint-disable-line react-hooks/exhaustive-deps

  async function suggest(jobId) {
    setSg((s) => ({ ...s, [jobId]: { loading: true } }))
    try {
      const { data, error } = await supabase.functions.invoke('dispatch-suggest', { body: { jobId } })
      if (error || !data?.ok) {
        setSg((s) => ({ ...s, [jobId]: { error: data?.reason || 'Could not get suggestions right now.' } }))
        return
      }
      setSg((s) => ({ ...s, [jobId]: { usedMapbox: data.usedMapbox, suggestions: data.suggestions || [] } }))
    } catch {
      setSg((s) => ({ ...s, [jobId]: { error: 'Could not reach the suggestion service.' } }))
    }
  }

  async function assign(job, tech) {
    const key = `${job.id}:${tech.techId}`
    setAssigning(key)
    const { error } = await supabase.from('job_technicians')
      .insert({ org_id: selectedOrg, job_id: job.id, user_id: tech.techId, sort_order: 0 })
    if (!error && job.date_pending) {
      await supabase.from('jobs').update({ date_pending: false, job_date: job.job_date || date }).eq('id', job.id)
    }
    setAssigning('')
    if (!error) {
      setRows((r) => r.filter((x) => x.id !== job.id))   // drop from the unassigned list
      setSg((s) => { const n = { ...s }; delete n[job.id]; return n })
      onAssigned && onAssigned()                          // refresh the map
    }
  }

  const card = { padding: 16, marginBottom: 14, border: '1px solid var(--border)' }
  const btn = { border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#176E7A' }

  return (
    <div className="section-card" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>✨ AI Dispatch — unassigned jobs</div>
          <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 2 }}>
            Ranks your techs by drive time, workload, and territory. You make the final call — nothing is assigned until you approve it.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={load} disabled={loading} style={btn}>{loading ? 'Loading…' : 'Refresh'}</button>
          <button onClick={() => setOpen((o) => !o)} style={{ ...btn, width: 34, padding: 6 }}>{open ? '–' : '+'}</button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {rows.length === 0 && (
            <p style={{ color: 'var(--mist)', fontSize: 13, margin: 0 }}>
              {loading ? 'Checking…' : 'No unassigned jobs for this date. 🎉'}
            </p>
          )}

          {rows.map((job) => {
            const s = sg[job.id] || {}
            return (
              <div key={job.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {job.customer_name}
                      {job.date_pending && <span style={{ marginLeft: 8, fontSize: 11.5, color: '#B5462F', fontWeight: 700 }}>⏳ needs dispatch</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>
                      {job.job_number ? job.job_number + ' · ' : ''}{job.job_type || 'Service'}{job.address ? ' · ' + job.address : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => suggest(job.id)}
                    disabled={s.loading || !job.has_loc}
                    title={job.has_loc ? '' : "This job has no mapped location yet — open it on the map to geocode its address first."}
                    style={{ border: 'none', background: job.has_loc ? '#176E7A' : '#9aa6b2', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: job.has_loc ? 'pointer' : 'not-allowed', flex: '0 0 auto' }}>
                    {s.loading ? 'Thinking…' : s.suggestions ? '↻ Re-suggest' : '✨ Suggest tech'}
                  </button>
                </div>

                {s.error && <div style={{ fontSize: 12.5, color: '#B5462F', marginTop: 8 }}>{s.error}</div>}

                {s.suggestions && (
                  <div style={{ marginTop: 10 }}>
                    {s.suggestions.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>No eligible technicians found.</div>}
                    {s.suggestions.slice(0, 4).map((t, i) => (
                      <div key={t.techId} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, background: i === 0 ? '#F2F8F8' : 'transparent', border: i === 0 ? '1px solid #D4E6E6' : '1px solid transparent', marginBottom: 6 }}>
                        <span style={{ width: 14, height: 14, borderRadius: '50%', background: t.calendarColor || '#2F5DE3', flex: '0 0 auto', marginTop: 3 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: 13.5 }}>{t.name}</span>
                            {i === 0 && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#176E7A', background: '#D4E6E6', borderRadius: 6, padding: '1px 6px' }}>BEST MATCH</span>}
                            <span style={{ fontSize: 11, fontWeight: 800, color: fitColor(t.fitScore) }}>{t.fitScore}% fit</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: '#152238', marginTop: 2 }}>{t.reason}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--mist)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <span>{t.driveMinutes != null ? `🚗 ${t.driveMinutes} min (${t.driveMiles} mi) ${ORIGIN_LABEL[t.originSource] || ''}` : '🚗 drive time unknown'}</span>
                            <span>📋 {t.jobsToday} today</span>
                            {t.ownsTerritory && <span style={{ color: '#1F8A4C' }}>📍 in territory</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => assign(job, t)}
                          disabled={assigning === `${job.id}:${t.techId}`}
                          style={{ border: 'none', background: '#1F8A4C', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flex: '0 0 auto' }}>
                          {assigning === `${job.id}:${t.techId}` ? 'Assigning…' : 'Assign'}
                        </button>
                      </div>
                    ))}
                    {s.usedMapbox === false && s.suggestions.some((t) => t.driveMinutes != null) && (
                      <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 2 }}>Drive times are straight-line estimates (road-accurate once a tech has live GPS or a stop scheduled that day).</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
