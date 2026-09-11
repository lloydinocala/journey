import { useEffect, useState, useMemo } from 'react'
import { supabase } from './utils/supabase'
import { can } from './utils/permissions'

const BLUE = '#215F9A'

function fmtDateTime(t) {
  const d = new Date(t)
  return isNaN(d) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Office-side archive of the per-job text threads. Read-only, org-scoped (RLS).
// Access limited to Reception/Dispatch (view_text_archive); Admin can delete.
export default function TextArchive({ profile }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const canView = can(profile, 'view_text_archive')
  const canDelete = can(profile, 'delete_text_archive')

  useEffect(() => { if (canView) load(); else setLoading(false) }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('job_texts')
      .select('id, body, direction, created_at, archived_at, job_id, jobs ( job_number, segment, customers ( display_name ), job_technicians ( users ( full_name ) ) )')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    setRows(data || [])
    setLoading(false)
  }

  async function deleteThread(t) {
    if (!canDelete) return
    if (confirmDelete !== t.jobId) { setConfirmDelete(t.jobId); return }
    await supabase.from('job_texts').update({ deleted_at: new Date().toISOString() }).eq('job_id', t.jobId)
    setConfirmDelete(null); setSelectedJob(null); load()
  }

  const threads = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      if (!map.has(r.job_id)) {
        map.set(r.job_id, {
          jobId: r.job_id,
          jobNumber: r.jobs?.job_number || '—',
          segment: r.jobs?.segment || 1,
          customer: r.jobs?.customers?.display_name || 'Customer',
          techs: [...new Set((r.jobs?.job_technicians || []).map((jt) => jt.users?.full_name).filter(Boolean))],
          messages: [],
          lastAt: r.created_at,
          archived: !!r.archived_at,
        })
      }
      const t = map.get(r.job_id)
      t.messages.push(r)
      t.lastAt = r.created_at
      if (r.archived_at) t.archived = true
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))
  }, [rows])

  const filtered = threads.filter((t) => {
    if (q.trim()) {
      const s = q.toLowerCase()
      const hit = t.customer.toLowerCase().includes(s)
        || String(t.jobNumber).toLowerCase().includes(s)
        || t.techs.some((n) => n.toLowerCase().includes(s))
      if (!hit) return false
    }
    if (dateFilter) {
      if (!t.messages.some((m) => (m.created_at || '').slice(0, 10) === dateFilter)) return false
    }
    return true
  })

  const current = filtered.find((t) => t.jobId === selectedJob) || null

  if (!canView) {
    return (
      <div>
        <div className="page-title">Text Archive</div>
        <div className="section-card" style={{ padding: 24, maxWidth: 520 }}>
          <p style={{ margin: 0, color: 'var(--mist)' }}>You don't have access to the text archive. Access is limited to Reception and Dispatch.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-title">Text Archive</div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 300 }}>
          <label>Search by customer, tech, or job #</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Aquino, Orlando, or J-0006" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Date</label>
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>
        {(q || dateFilter) && <button className="logout-button" style={{ margin: 0 }} onClick={() => { setQ(''); setDateFilter('') }}>Clear</button>}
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>{threads.length === 0 ? 'No text threads yet. A thread appears here as soon as a technician sends a message on a job (shown as “active”), and stays here as “archived” once the job is stopped.' : 'No threads match your search.'}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Thread list */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            {filtered.map((t) => {
              const isActive = t.jobId === selectedJob
              const last = t.messages[t.messages.length - 1]
              return (
                <button key={t.jobId} onClick={() => setSelectedJob(t.jobId)} style={{
                  display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                  padding: '12px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'inherit',
                  background: isActive ? 'rgba(33,95,154,0.08)' : '#fff',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ color: '#101418' }}>{t.customer}</strong>
                    <span style={{ fontSize: 12, color: 'var(--mist)' }}>{t.messages.length} msg</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: BLUE, fontWeight: 700, marginTop: 2 }}>
                    Job {t.jobNumber}{t.segment > 1 ? `-${t.segment}` : ''}{t.archived ? '' : ' · active'}{t.techs.length ? ` · ${t.techs.join(', ')}` : ''}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {last?.direction === 'inbound' ? '↩ ' : ''}{last?.body}
                  </div>
                  <div style={{ fontSize: 11, color: '#9AA6B2', marginTop: 3 }}>{fmtDateTime(t.lastAt)}</div>
                </button>
              )
            })}
          </div>

          {/* Thread view */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: '#fff', minHeight: 320, padding: current ? 18 : 40 }}>
            {!current ? (
              <p style={{ color: 'var(--mist)', textAlign: 'center', marginTop: 40 }}>Select a thread on the left to read it.</p>
            ) : (
              <>
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#101418' }}>{current.customer}</div>
                    <div style={{ fontSize: 13, color: BLUE, fontWeight: 700 }}>
                      Job {current.jobNumber}{current.segment > 1 ? `-${current.segment}` : ''} · {current.messages.length} messages{current.archived ? ' · archived' : ' · active'}
                    </div>
                    {current.techs.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 2 }}>Tech: {current.techs.join(', ')}</div>}
                  </div>
                  {canDelete && (
                    confirmDelete === current.jobId ? (
                      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', background: '#FBECE8', border: '1px solid #EAC5BC', borderRadius: 8, padding: '5px 10px', flex: 'none' }}>
                        <span style={{ fontSize: 12.5, color: '#B5462F', fontWeight: 600 }}>Delete this thread?</span>
                        <button onClick={() => deleteThread(current)} style={{ border: 'none', background: '#B5462F', color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDelete(current.jobId)} style={{ border: '1px solid #EAC5BC', background: '#fff', color: '#B5462F', borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flex: 'none' }}>Delete thread</button>
                    )
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {current.messages.map((m) => {
                    const out = m.direction !== 'inbound'
                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: out ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '72%', padding: '9px 13px', borderRadius: 14, fontSize: 14, lineHeight: 1.4,
                          background: out ? BLUE : '#EEF1F4', color: out ? '#fff' : '#101418',
                          borderBottomRightRadius: out ? 4 : 14, borderBottomLeftRadius: out ? 14 : 4,
                        }}>{m.body}</div>
                        <div style={{ fontSize: 11, color: '#9AA6B2', marginTop: 3 }}>
                          {out ? 'Technician' : 'Customer'} · {fmtDateTime(m.created_at)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
