import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { isFieldAdmin } from '../../MobileNav'
import { IconChevronLeft } from '../../MobileIcons'
import { hasFeature } from '../../utils/entitlements'
import { today, fmtDate, phaseLabel } from './data'
import { uploadFiles } from './files'

// Field app · Commercial project mode for leads and supervisors: file the daily
// log, add punch items with photos, close punch items, record inspection results.
// Everything else about a commercial project stays in the office.
export default function TechProjects({ profile }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const dark = (() => { try { return localStorage.getItem('jc-theme') === 'dark' } catch { return false } })()
  const shell = `mobile-shell job-card-v2${dark ? ' jc-dark' : ''}`
  const allowed = isFieldAdmin(profile) && hasFeature(profile, 'commercial_projects')

  const header = (title, sub, back) => (
    <div className="jc-header">
      <button className="jc-back" onClick={() => navigate(back)}><IconChevronLeft /></button>
      <div className="jc-header-text"><div className="jc-title">{title}</div>{sub ? <div className="jc-sub">{sub}</div> : null}</div>
    </div>
  )
  if (!allowed) return <div className={shell}>{header('Commercial Projects', null, '/tech')}<div className="jc-body"><p className="jc-muted-note" style={{ padding: 16 }}>Commercial project tools are for field leads and supervisors.</p></div></div>
  return id ? <ProjectDetail id={id} profile={profile} shell={shell} header={header} /> : <ProjectList profile={profile} shell={shell} header={header} navigate={navigate} />
}

function ProjectList({ profile, shell, header, navigate }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    let q = supabase.from('cp_projects').select('id, name, project_number, phase, properties(street_address, city)').eq('status', 'active').order('name')
    if (profile?.org_id) q = q.eq('org_id', profile.org_id)
    q.then(({ data }) => setRows(data || []))
  }, [profile?.org_id])
  return (
    <div className={shell}>
      {header('Commercial Projects', 'Daily logs, punch list, inspections', '/tech')}
      <div className="jc-body">
        {!rows ? <p className="jc-muted-note">Loading…</p> : rows.length === 0 ? <p className="jc-muted-note">No active commercial projects.</p> : rows.map((p) => (
          <button key={p.id} className="jc-task" onClick={() => navigate(`/tech/projects/${p.id}`)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 15px', cursor: 'pointer' }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{p.name}</div>
            <div className="jc-muted-note">{p.properties ? `${p.properties.street_address}, ${p.properties.city || ''}` : ''}{p.properties ? ' · ' : ''}{phaseLabel(p.phase)}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

const big = { width: '100%', padding: '13px 14px', fontSize: 17, fontWeight: 800, borderRadius: 12, border: 'none', background: 'var(--jc-blue, #215F9A)', color: '#fff', cursor: 'pointer', marginBottom: 10 }
const fld = { width: '100%', padding: '11px 12px', fontSize: 16, borderRadius: 10, border: '1px solid var(--jc-line, #ccd)', marginBottom: 10, boxSizing: 'border-box', fontFamily: 'inherit' }

function ProjectDetail({ id, profile, shell, header }) {
  const [p, setP] = useState(null)
  const [mode, setMode] = useState(null)
  const [punch, setPunch] = useState([])
  const [insp, setInsp] = useState([])
  const [logs, setLogs] = useState([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState({ crew: '', crew_hours: '', weather: '', work_performed: '', deliveries: '', delays: '', files: [] })
  const [pi, setPi] = useState({ description: '', location: '', files: [] })
  const [ni, setNi] = useState({ inspection_type: 'Rough-in mechanical', status: 'passed', notes: '' })

  const load = useCallback(async () => {
    const [{ data: proj }, { data: pu }, { data: ins }, { data: lg }] = await Promise.all([
      supabase.from('cp_projects').select('id, org_id, name, project_number').eq('id', id).maybeSingle(),
      supabase.from('cp_punch_items').select('*').eq('project_id', id).neq('status', 'verified').order('number'),
      supabase.from('cp_inspections').select('*').eq('project_id', id).eq('status', 'scheduled').order('scheduled_date'),
      supabase.from('cp_daily_logs').select('id, log_date, author_name').eq('project_id', id).order('log_date', { ascending: false }).limit(5),
    ])
    setP(proj); setPunch(pu || []); setInsp(ins || []); setLogs(lg || [])
  }, [id])
  useEffect(() => { load() }, [load])
  if (!p) return <div className={shell}>{header('Project', null, '/tech/projects')}<div className="jc-body"><p className="jc-muted-note">Loading…</p></div></div>

  const done = (text) => { setMsg(text); setMode(null); setBusy(false); load() }
  async function upload(list, folder) {
    const { files, error } = await uploadFiles(p.org_id, p.id, folder, list)
    if (error) setMsg(error)
    return files
  }
  async function saveLog() {
    if (!log.work_performed.trim()) { setMsg('Describe the work performed.'); return }
    setBusy(true)
    const { error } = await supabase.from('cp_daily_logs').insert({
      org_id: p.org_id, project_id: p.id, log_date: today(), author_id: profile?.id || null, author_name: profile?.full_name || null,
      crew: log.crew || null, crew_hours: log.crew_hours === '' ? null : Number(log.crew_hours), weather: log.weather || null,
      work_performed: log.work_performed, deliveries: log.deliveries || null, delays: log.delays || null, attachments: log.files,
    })
    if (error) { setBusy(false); setMsg(error.message); return }
    setLog({ crew: '', crew_hours: '', weather: '', work_performed: '', deliveries: '', delays: '', files: [] })
    done("Today's daily log is filed.")
  }
  async function savePunch() {
    if (!pi.description.trim()) { setMsg('Describe the punch item.'); return }
    setBusy(true)
    const { data: mx } = await supabase.from('cp_punch_items').select('number').eq('project_id', p.id).order('number', { ascending: false }).limit(1)
    const { error } = await supabase.from('cp_punch_items').insert({
      org_id: p.org_id, project_id: p.id, number: (mx?.[0]?.number || 0) + 1, description: pi.description, location: pi.location || null,
      raised_by: profile?.full_name || null, attachments: pi.files,
    })
    if (error) { setBusy(false); setMsg(error.message); return }
    setPi({ description: '', location: '', files: [] })
    done('Punch item added.')
  }
  async function markPunchDone(item) {
    await supabase.from('cp_punch_items').update({ status: 'done', done_date: today() }).eq('id', item.id)
    setMsg(`Punch item #${item.number} marked done — the office will verify it.`); load()
  }
  async function recordResult(item, status) {
    await supabase.from('cp_inspections').update({ status, result_date: today() }).eq('id', item.id)
    setMsg(`${item.inspection_type}: ${status}.`); load()
  }
  async function saveNewInspection() {
    setBusy(true)
    const { error } = await supabase.from('cp_inspections').insert({
      org_id: p.org_id, project_id: p.id, inspection_type: ni.inspection_type, status: ni.status, scheduled_date: today(),
      result_date: ni.status === 'scheduled' ? null : today(), notes: ni.notes || null,
    })
    if (error) { setBusy(false); setMsg(error.message); return }
    setNi({ inspection_type: 'Rough-in mechanical', status: 'passed', notes: '' })
    done('Inspection recorded.')
  }

  const photoInput = (state, setState, folder) => (
    <label style={{ ...big, display: 'block', textAlign: 'center', background: 'transparent', color: 'var(--jc-blue, #215F9A)', border: '2px dashed var(--jc-line, #ccd)' }}>
      📷 Add photos{state.files.length ? ` (${state.files.length} added)` : ''}
      <input type="file" accept="image/*" capture="environment" multiple hidden
        onChange={async (e) => { const fl = e.target.files; e.target.value = ''; const up = await upload(fl, folder); setState((s) => ({ ...s, files: [...s.files, ...up] })) }} />
    </label>
  )

  return (
    <div className={shell}>
      {header(p.name, p.project_number, '/tech/projects')}
      <div className="jc-body">
        {msg && <div className="jc-task" style={{ padding: '10px 14px', fontWeight: 700 }}>{msg}</div>}

        {mode === null && <>
          <button style={big} onClick={() => { setMode('log'); setMsg('') }}>📝 File today's daily log</button>
          <button style={big} onClick={() => { setMode('punch'); setMsg('') }}>➕ Add a punch item</button>
          <button style={big} onClick={() => { setMode('inspect'); setMsg('') }}>✅ Record an inspection</button>

          <div className="jc-task"><div className="jc-task-head blue"><span className="jc-th-title">Open punch list ({punch.length})</span></div>
            <div className="jc-task-body">
              {punch.length === 0 ? <p className="jc-muted-note">Nothing open.</p> : punch.map((x) => (
                <div key={x.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--jc-line)' }}>
                  <div style={{ flex: 1 }}><strong>#{x.number}</strong> {x.description}<div className="jc-muted-note">{x.location || ''}{x.status === 'done' ? ' · done, awaiting verification' : ''}</div></div>
                  {x.status === 'open' && <button className="jc-flow-btn" style={{ flex: '0 0 auto', padding: '8px 12px' }} onClick={() => markPunchDone(x)}>Done</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="jc-task"><div className="jc-task-head blue"><span className="jc-th-title">Recent daily logs</span></div>
            <div className="jc-task-body">{logs.length === 0 ? <p className="jc-muted-note">None yet.</p> : logs.map((l) => <div key={l.id} className="jc-kv"><span>{fmtDate(l.log_date)}</span><span>{l.author_name || ''}</span></div>)}</div>
          </div>
        </>}

        {mode === 'log' && (
          <div className="jc-task"><div className="jc-task-body">
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Daily log — {fmtDate(today())}</div>
            <input style={fld} placeholder="Crew on site (names)" value={log.crew} onChange={(e) => setLog({ ...log, crew: e.target.value })} />
            <input style={fld} type="number" inputMode="decimal" placeholder="Total crew hours" value={log.crew_hours} onChange={(e) => setLog({ ...log, crew_hours: e.target.value })} />
            <input style={fld} placeholder="Weather" value={log.weather} onChange={(e) => setLog({ ...log, weather: e.target.value })} />
            <textarea style={{ ...fld, minHeight: 110 }} placeholder="Work performed today *" value={log.work_performed} onChange={(e) => setLog({ ...log, work_performed: e.target.value })} />
            <textarea style={fld} placeholder="Deliveries received" value={log.deliveries} onChange={(e) => setLog({ ...log, deliveries: e.target.value })} />
            <textarea style={fld} placeholder="Delays or problems" value={log.delays} onChange={(e) => setLog({ ...log, delays: e.target.value })} />
            {photoInput(log, setLog, 'cp_daily_logs')}
            <button style={big} onClick={saveLog} disabled={busy}>{busy ? 'Saving…' : 'File daily log'}</button>
            <button style={{ ...big, background: 'transparent', color: 'inherit', border: '1px solid var(--jc-line)' }} onClick={() => setMode(null)}>Cancel</button>
          </div></div>
        )}

        {mode === 'punch' && (
          <div className="jc-task"><div className="jc-task-body">
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>New punch item</div>
            <textarea style={{ ...fld, minHeight: 90 }} placeholder="What needs fixing? *" value={pi.description} onChange={(e) => setPi({ ...pi, description: e.target.value })} />
            <input style={fld} placeholder="Location (floor, room, unit tag)" value={pi.location} onChange={(e) => setPi({ ...pi, location: e.target.value })} />
            {photoInput(pi, setPi, 'cp_punch_items')}
            <button style={big} onClick={savePunch} disabled={busy}>{busy ? 'Saving…' : 'Add punch item'}</button>
            <button style={{ ...big, background: 'transparent', color: 'inherit', border: '1px solid var(--jc-line)' }} onClick={() => setMode(null)}>Cancel</button>
          </div></div>
        )}

        {mode === 'inspect' && (
          <div className="jc-task"><div className="jc-task-body">
            {insp.length > 0 && <>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Scheduled inspections</div>
              {insp.map((x) => (
                <div key={x.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--jc-line)' }}>
                  <div><strong>{x.inspection_type}</strong> <span className="jc-muted-note">{fmtDate(x.scheduled_date)}</span></div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button className="jc-flow-btn" onClick={() => recordResult(x, 'passed')}>Passed</button>
                    <button className="jc-flow-btn" onClick={() => recordResult(x, 'failed')}>Failed</button>
                  </div>
                </div>
              ))}
              <div style={{ fontWeight: 800, fontSize: 16, margin: '14px 0 8px' }}>Or record one that wasn't scheduled</div>
            </>}
            <select style={fld} value={ni.inspection_type} onChange={(e) => setNi({ ...ni, inspection_type: e.target.value })}>
              {['Rough-in mechanical', 'Above-ceiling', 'Duct / pressure test', 'Refrigerant piping pressure test', 'Gas piping', 'Fire / smoke damper', 'Final mechanical', 'Other'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <select style={fld} value={ni.status} onChange={(e) => setNi({ ...ni, status: e.target.value })}>
              <option value="passed">Passed</option><option value="failed">Failed</option><option value="scheduled">Scheduled (no result yet)</option>
            </select>
            <textarea style={fld} placeholder="Notes or corrections required" value={ni.notes} onChange={(e) => setNi({ ...ni, notes: e.target.value })} />
            <button style={big} onClick={saveNewInspection} disabled={busy}>{busy ? 'Saving…' : 'Save inspection'}</button>
            <button style={{ ...big, background: 'transparent', color: 'inherit', border: '1px solid var(--jc-line)' }} onClick={() => setMode(null)}>Back</button>
          </div></div>
        )}
      </div>
    </div>
  )
}
