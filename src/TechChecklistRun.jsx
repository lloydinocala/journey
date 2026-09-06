import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'

// Full-page checklist runner for a PM job. One job = one system = one checklist.
// Snapshots the checklist into an immutable run, then the tech works each item.
export default function TechChecklistRun({ profile }) {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [run, setRun] = useState(null)
  const [results, setResults] = useState([])
  const [openNotes, setOpenNotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => { load() }, [jobId])

  async function load() {
    setLoading(true); setErr('')
    const { data: j } = await supabase.from('jobs')
      .select('id, job_number, segment, job_type, org_id, property_id, properties(street_address, customers!properties_customer_id_fkey(display_name))')
      .eq('id', jobId).maybeSingle()
    if (!j) { setErr('Job not found.'); setLoading(false); return }
    setJob(j)

    // job type -> linked checklist
    const { data: jt } = await supabase.from('job_types')
      .select('checklist_id, checklists(id, name)')
      .eq('org_id', j.org_id).eq('name', j.job_type).maybeSingle()
    const checklist = jt?.checklists || null
    if (!checklist) { setErr('This job type has no checklist linked.'); setLoading(false); return }

    // existing run?
    let { data: existing } = await supabase.from('checklist_runs').select('*').eq('job_id', jobId).maybeSingle()
    if (!existing) {
      const { data: created, error: rErr } = await supabase.from('checklist_runs')
        .insert({ org_id: j.org_id, job_id: jobId, checklist_id: checklist.id, checklist_name: checklist.name, status: 'in_progress' })
        .select().single()
      if (rErr) { setErr('Could not start the checklist.'); setLoading(false); return }
      existing = created
      // snapshot the checklist items into results
      const [{ data: secs }, { data: items }] = await Promise.all([
        supabase.from('checklist_sections').select('id, name, sort_order').eq('checklist_id', checklist.id).order('sort_order'),
        supabase.from('checklist_items').select('*').eq('checklist_id', checklist.id).order('sort_order'),
      ])
      const secMap = {}; (secs || []).forEach((s) => { secMap[s.id] = s })
      const ordered = [...(items || [])].sort((a, b) =>
        ((secMap[a.section_id]?.sort_order ?? 0) - (secMap[b.section_id]?.sort_order ?? 0)) || (a.sort_order - b.sort_order))
      const rows = ordered.map((it, idx) => ({
        org_id: j.org_id, run_id: existing.id, item_id: it.id, sort_order: idx,
        section_name: secMap[it.section_id]?.name || '', inspection_task: it.inspection_task, maintenance_task: it.maintenance_task,
        item_type: it.item_type, record_units: it.record_units, spec_label: it.spec_label,
        add_to_estimate: it.add_to_estimate, system_health: it.system_health, create_system_estimate: it.create_system_estimate, red_tag: it.red_tag,
      }))
      if (rows.length) await supabase.from('checklist_results').insert(rows)
    }
    setRun(existing)
    const { data: res } = await supabase.from('checklist_results').select('*').eq('run_id', existing.id).order('sort_order')
    setResults(res || [])
    setLoading(false)
  }

  function patch(id, changes) {
    setResults((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)))
    supabase.from('checklist_results').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id).then(() => {})
  }

  async function complete() {
    await supabase.from('checklist_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', run.id)
    navigate(-1)
  }
  async function reopen() {
    await supabase.from('checklist_runs').update({ status: 'in_progress', completed_at: null }).eq('id', run.id)
    setRun((r) => ({ ...r, status: 'in_progress' }))
  }

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>
  if (err) return <div style={{ padding: 20 }}><button className="jc-btn ghost" onClick={() => navigate(-1)}>‹ Back</button><p style={{ color: '#C0392B', marginTop: 16 }}>{err}</p></div>

  const addressed = results.filter((r) => r.status).length
  const problems = results.filter((r) => r.status === 'problem')
  const estimateItems = problems.filter((r) => r.add_to_estimate).length
  const redTags = problems.filter((r) => r.red_tag).length
  const done = run?.status === 'completed'

  // group results by section, preserving order
  const groups = []
  for (const r of results) {
    let g = groups[groups.length - 1]
    if (!g || g.name !== r.section_name) { g = { name: r.section_name, rows: [] }; groups.push(g) }
    g.rows.push(r)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px 12px 120px' }}>
      <button className="jc-btn ghost" onClick={() => navigate(-1)}>‹ Back to job</button>
      <div style={{ margin: '12px 0 4px' }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{run?.checklist_name}</div>
        <div style={{ fontSize: 13, color: 'var(--mist)' }}>
          {job?.job_number}{job?.segment > 1 ? `-${job.segment}` : ''} · {job?.properties?.customers?.display_name || 'Customer'}
        </div>
      </div>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--surface,#fff)', padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
        <span><b>{addressed}</b>/{results.length} done</span>
        <span style={{ color: estimateItems ? '#2F5DE3' : 'var(--mist)' }}>{estimateItems} → estimate</span>
        <span style={{ color: redTags ? '#C0392B' : 'var(--mist)' }}>{redTags} red-tag</span>
        {done && <span style={{ color: '#16A34A', fontWeight: 700 }}>✓ Completed</span>}
      </div>

      {groups.map((g, gi) => (
        <div key={gi} style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: 8 }}>{g.name}</div>
          {g.rows.map((r) => (
            <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8, borderLeft: r.status === 'problem' ? '4px solid #C0392B' : r.status === 'ok' ? '4px solid #16A34A' : r.status === 'na' ? '4px solid #9CA3AF' : '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{r.inspection_task}</div>
              {r.maintenance_task && <div style={{ fontSize: 13, color: 'var(--mist)', marginTop: 2 }}>{r.maintenance_task}</div>}

              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {[['ok', 'OK', '#16A34A'], ['problem', 'Problem', '#C0392B'], ['na', 'N/A', '#6B7280']].map(([val, label, color]) => (
                  <button key={val} onClick={() => patch(r.id, { status: r.status === val ? null : val })}
                    style={{ padding: '8px 16px', borderRadius: 999, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', border: `1.5px solid ${r.status === val ? color : 'var(--border)'}`, background: r.status === val ? color : '#fff', color: r.status === val ? '#fff' : 'var(--mist)' }}>
                    {label}
                  </button>
                ))}
                <button onClick={() => setOpenNotes((o) => ({ ...o, [r.id]: !o[r.id] }))} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13, cursor: 'pointer', border: '1.5px solid var(--border)', background: '#fff', color: 'var(--mist)', marginLeft: 'auto' }}>
                  {r.notes ? '📝 Note' : '+ Note'}
                </button>
              </div>

              {r.item_type === 'measure' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input value={r.value_recorded || ''} onChange={(e) => patch(r.id, { value_recorded: e.target.value })} placeholder="Reading"
                    style={{ width: 130, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 15 }} />
                  {r.record_units && <span style={{ fontSize: 13, color: 'var(--mist)' }}>{r.record_units}</span>}
                  {r.spec_label && <span style={{ fontSize: 12, color: 'var(--mist)' }}>· spec: {r.spec_label}</span>}
                </div>
              )}

              {openNotes[r.id] && (
                <textarea value={r.notes || ''} onChange={(e) => patch(r.id, { notes: e.target.value })} placeholder="Notes…"
                  style={{ width: '100%', minHeight: 56, marginTop: 8, padding: 8, border: '1px solid var(--border)', borderRadius: 8, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14 }} />
              )}

              {r.status === 'problem' && (r.add_to_estimate || r.red_tag || r.create_system_estimate) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {r.add_to_estimate && <span style={{ fontSize: 11, fontWeight: 700, color: '#2F5DE3', background: 'rgba(47,93,227,.1)', padding: '3px 8px', borderRadius: 6 }}>→ Estimate</span>}
                  {r.create_system_estimate && <span style={{ fontSize: 11, fontWeight: 700, color: '#C8811B', background: 'rgba(200,129,27,.12)', padding: '3px 8px', borderRadius: 6 }}>→ System estimate</span>}
                  {r.red_tag && <span style={{ fontSize: 11, fontWeight: 700, color: '#C0392B', background: 'rgba(192,57,43,.1)', padding: '3px 8px', borderRadius: 6 }}>⚠ RED TAG</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface,#fff)', borderTop: '1px solid var(--border)', padding: 12, display: 'flex', gap: 10, justifyContent: 'center' }}>
        {done
          ? <button className="jc-btn ghost" onClick={reopen}>Re-open checklist</button>
          : <button className="action-btn" style={{ padding: '12px 28px', fontWeight: 700 }} onClick={complete}>Complete checklist ({addressed}/{results.length})</button>}
      </div>
    </div>
  )
}
