import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import OrgPicker from './OrgPicker'

export default function NewFollowupEstimate({ profile }) {
  const navigate = useNavigate()
  const isSuperAdmin = profile.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(profile.org_id || '')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
        setOrgs(data || [])
        if (!selectedOrg && data && data.length) setSelectedOrg(data[0].id)
      })
    }
  }, [])

  async function load(orgId) {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select('id, job_number, segment, job_date, job_type, customer_id, properties(street_address, city, customers!properties_customer_id_fkey(display_name))')
      .eq('org_id', orgId)
      .order('job_date', { ascending: false, nullsFirst: false })
      .limit(100)
    setJobs(data || [])
    setLoading(false)
  }
  useEffect(() => { load(selectedOrg) }, [selectedOrg])

  async function createFollowup(job) {
    if (creating) return
    setCreating(true); setErr('')
    const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('org_id', selectedOrg).eq('kind', 'estimate')
    const num = 'EST-' + String((count || 0) + 1).padStart(4, '0')
    const { data: created, error } = await supabase.from('invoices').insert({
      org_id: selectedOrg,
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
    navigate(`/estimate/${job.id}?followup=${created.id}`)
  }

  const filtered = jobs.filter((j) => {
    if (!q.trim()) return true
    const s = q.toLowerCase()
    const name = (j.properties?.customers?.display_name || '').toLowerCase()
    const addr = (j.properties?.street_address || '').toLowerCase()
    return name.includes(s) || addr.includes(s) || (j.job_number || '').toLowerCase().includes(s)
  })

  return (
    <div>
      <h2 className="page-title">New Estimate</h2>
      <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: -8, marginBottom: 20 }}>
        Pick the customer/job this estimate is for. It references that job for pricing and context but stays separate — it won&apos;t change the job or block it from closing. When the customer approves, it becomes a new unscheduled job for the office to schedule.
      </p>

      {isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--mist)', marginBottom: 6 }}>Viewing organization</label>
          <OrgPicker orgs={orgs} value={selectedOrg} onChange={setSelectedOrg} />
        </div>
      )}

      <input
        type="text"
        placeholder="Search customer, address, or J#…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: 480, marginBottom: 16, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--line, #D5DAE1)', fontSize: 14 }}
      />
      {err && <div className="auth-error">{err}</div>}

      {loading ? (
        <p style={{ color: 'var(--mist)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
          {filtered.map((j) => (
            <button
              key={j.id}
              disabled={creating}
              onClick={() => createFollowup(j)}
              style={{ textAlign: 'left', cursor: 'pointer', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--line, #E2E6ED)', background: 'var(--panel)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{j.properties?.customers?.display_name || 'Unknown customer'}</div>
                <div style={{ fontSize: 13, color: 'var(--mist)' }}>{j.properties?.street_address || ''}{j.properties?.city ? `, ${j.properties.city}` : ''}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--mist)', whiteSpace: 'nowrap' }}>{j.job_number}{j.segment > 1 ? `-${j.segment}` : ''} · {j.job_type || '—'}<br />{j.job_date || 'no date'}</div>
            </button>
          ))}
          {filtered.length === 0 && <p style={{ color: 'var(--mist)' }}>No matching jobs.</p>}
        </div>
      )}
    </div>
  )
}
