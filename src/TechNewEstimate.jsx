import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'

function IconChevronLeft() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
}

export default function TechNewEstimate({ profile }) {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    // RLS scopes this: a regular tech sees only their own jobs, a supervisor the org's.
    const { data } = await supabase
      .from('jobs')
      .select('id, job_number, segment, job_date, job_type, customer_id, properties(street_address, city, customers!properties_customer_id_fkey(display_name))')
      .eq('org_id', profile.org_id)
      .order('job_date', { ascending: false, nullsFirst: false })
      .limit(60)
    setJobs(data || [])
    setLoading(false)
  }

  async function createFollowup(job) {
    if (creating) return
    setCreating(true); setErr('')
    const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('org_id', profile.org_id).eq('kind', 'estimate')
    const num = 'EST-' + String((count || 0) + 1).padStart(4, '0')
    const { data: created, error } = await supabase.from('invoices').insert({
      org_id: profile.org_id,
      invoice_number: num,
      kind: 'estimate',
      estimate_type: 'service',
      job_id: null,
      reference_job_id: job.id,
      bills_to_customer_id: job.customer_id,
      invoice_date: new Date().toISOString().slice(0, 10),
      discount_type: 'dollar',
    }).select('id').single()
    if (error) { setErr(error.message); setCreating(false); return }
    navigate(`/tech/estimate/${job.id}?followup=${created.id}`)
  }

  const filtered = jobs.filter((j) => {
    if (!q.trim()) return true
    const s = q.toLowerCase()
    const name = (j.properties?.customers?.display_name || '').toLowerCase()
    const addr = (j.properties?.street_address || '').toLowerCase()
    return name.includes(s) || addr.includes(s) || (j.job_number || '').toLowerCase().includes(s)
  })

  return (
    <div className="mobile-shell">
      <div className="mobile-header">
        <button className="mobile-back" onClick={() => navigate(-1)}><IconChevronLeft /></button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>New Estimate</span>
      </div>
      <div className="mobile-body">
        <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 0 }}>
          Pick the customer/job this estimate is for. It attaches to that job for reference and pricing but stays separate — it won&apos;t change that job or block it from closing. When the customer approves, it becomes a new unscheduled job for the office to schedule.
        </p>
        <input
          type="text"
          placeholder="Search name, address, or J#…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%', marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line, #D5DAE1)', fontSize: 15 }}
        />
        {err && <p style={{ color: '#C0392B' }}>{err}</p>}
        {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {filtered.map((j) => (
              <button
                key={j.id}
                disabled={creating}
                onClick={() => createFollowup(j)}
                style={{ textAlign: 'left', cursor: 'pointer', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--line, #E2E6ED)', background: 'var(--panel, #fff)' }}
              >
                <div style={{ fontWeight: 600 }}>{j.properties?.customers?.display_name || 'Unknown customer'}</div>
                <div style={{ fontSize: 13, color: 'var(--mist)' }}>{j.properties?.street_address || ''}{j.properties?.city ? `, ${j.properties.city}` : ''}</div>
                <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 2 }}>{j.job_number}{j.segment > 1 ? `-${j.segment}` : ''} · {j.job_type || '—'} · {j.job_date || 'no date'}</div>
              </button>
            ))}
            {filtered.length === 0 && <p style={{ color: 'var(--mist)' }}>No matching jobs.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
