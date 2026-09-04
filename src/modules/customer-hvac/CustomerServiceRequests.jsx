import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const CAT = { repair: 'Repair', tuneup: 'Tune-up', question: 'Question' }

export default function CustomerServiceRequests() {
  const nav = useNavigate()
  const [reqs, setReqs] = useState(null)
  const [busy, setBusy] = useState(null)

  async function load() {
    const { data } = await supabase.from('service_requests')
      .select('*, properties(street_address, unit, city)')
      .eq('status', 'pending').order('created_at', { ascending: false })
    setReqs(data || [])
  }
  useEffect(() => { load() }, [])

  async function approve(r) { setBusy(r.id); const { error } = await supabase.rpc('approve_service_request', { p_request_id: r.id }); setBusy(null); if (error) { alert(error.message); return } load() }
  async function decline(r) { if (!window.confirm('Decline this request?')) return; setBusy(r.id); await supabase.rpc('decline_service_request', { p_request_id: r.id }); setBusy(null); load() }

  return (
    <div className="cp-wrap">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <h2 className="cp-h2">Service Requests</h2>
      <p className="cp-lead" style={{ marginTop: -4 }}>Requests reported for your properties. Approve to have us schedule the work — it’s billed to your account.</p>

      {reqs === null ? <div className="cp-empty">Loading…</div>
        : reqs.length === 0 ? <div className="cp-card"><p style={{ margin: 0 }}>Nothing waiting for approval. 🎉</p></div>
        : reqs.map((r) => (
          <div key={r.id} className="cp-card" style={{ marginBottom: 12, borderLeft: `4px solid ${r.urgency === 'emergency' ? '#DC2626' : 'var(--sky)'}` }}>
            <div style={{ fontWeight: 800 }}>{CAT[r.category] || 'Request'}{r.urgency ? ` · ${r.urgency}` : ''}</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', margin: '2px 0 6px' }}>
              📍 {[r.properties?.street_address, r.properties?.unit, r.properties?.city].filter(Boolean).join(' ')}
            </div>
            {r.details && <div style={{ fontSize: 14.5, marginBottom: 6 }}>{r.details}</div>}
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Reported by {r.reporter_name || 'someone'}{r.reporter_phone ? ` · ${r.reporter_phone}` : ''} · {new Date(r.created_at).toLocaleDateString()}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="cp-btn" style={{ flex: 1 }} disabled={busy === r.id} onClick={() => approve(r)}>{busy === r.id ? 'Working…' : 'Approve'}</button>
              <button className="cp-btn ghost" style={{ flex: 1 }} disabled={busy === r.id} onClick={() => decline(r)}>Decline</button>
            </div>
          </div>
        ))}
    </div>
  )
}
