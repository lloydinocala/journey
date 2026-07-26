import { useEffect, useState, useMemo } from 'react'
import { supabase } from './utils/supabase'

const BLUE = '#215F9A'

function fmtDateTime(t) {
  const d = new Date(t)
  return isNaN(d) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Office-side archive of the per-job text threads. Read-only, org-scoped (RLS),
// organized by customer + job. Not exposed to any customer-facing link.
export default function TextArchive({ profile }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('job_texts')
      .select('id, body, direction, created_at, archived_at, job_id, jobs ( job_number, segment, customers ( display_name ) )')
      .order('created_at', { ascending: true })
    setRows(data || [])
    setLoading(false)
  }

  // Group into threads by job_id.
  const threads = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      if (!map.has(r.job_id)) {
        map.set(r.job_id, {
          jobId: r.job_id,
          jobNumber: r.jobs?.job_number || '—',
          segment: r.jobs?.segment || 1,
          customer: r.jobs?.customers?.display_name || 'Customer',
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
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return t.customer.toLowerCase().includes(s) || String(t.jobNumber).toLowerCase().includes(s)
  })

  const current = filtered.find((t) => t.jobId === selectedJob) || null

  return (
    <div>
      <div className="page-title">Text Archive</div>

      <div className="inline-form" style={{ marginBottom: 20 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 280 }}>
          <label>Search by customer or job #</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Aquino or J-0006" />
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--mist)' }}>No archived text threads yet. Threads appear here after a technician messages on a job and the job is stopped.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Thread list */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            {filtered.map((t) => {
              const isActive = t.jobId === selectedJob
              const last = t.messages[t.messages.length - 1]
              return (
                <button
                  key={t.jobId}
                  onClick={() => setSelectedJob(t.jobId)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                    padding: '12px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'inherit',
                    background: isActive ? 'rgba(33,95,154,0.08)' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ color: '#101418' }}>{t.customer}</strong>
                    <span style={{ fontSize: 12, color: 'var(--mist)' }}>{t.messages.length} msg</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: BLUE, fontWeight: 700, marginTop: 2 }}>
                    Job {t.jobNumber}{t.segment > 1 ? `-${t.segment}` : ''}{t.archived ? '' : ' · active'}
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
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#101418' }}>{current.customer}</div>
                  <div style={{ fontSize: 13, color: BLUE, fontWeight: 700 }}>
                    Job {current.jobNumber}{current.segment > 1 ? `-${current.segment}` : ''} · {current.messages.length} messages{current.archived ? ' · archived' : ' · active'}
                  </div>
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
