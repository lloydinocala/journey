import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import './marketing.css'

const TRIGGER_STEPS = [
  'Job marked complete (Journey)',
  'Review request sent by text',
  'Hyperlocal check-in posted to GBP',
  'New review → responded + reported',
]

export default function MarketingReviews({ profile }) {
  const orgId = profile?.org_id
  const [requests, setRequests] = useState(null)
  const [completedJobs, setCompletedJobs] = useState(0)

  useEffect(() => {
    if (!orgId) return
    async function load() {
      const { data: reqs } = await supabase.from('marketing_review_requests')
        .select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(25)
      setRequests(reqs || [])
      const { count } = await supabase.from('jobs')
        .select('*', { count: 'exact', head: true }).eq('org_id', orgId).not('completed_at', 'is', null)
      setCompletedJobs(count || 0)
    }
    load()
  }, [orgId])

  return (
    <div className="mkt">
      <div className="view-head">
        <h2>Reviews &amp; reputation</h2>
        <p>The #1 contractor marketing lever. Journey fires a review request the moment a job is marked complete — and reviews lift both your Local Pack and Local Services Ads ranking.</p>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="kpi"><div className="label">Completed jobs</div><div className="val">{completedJobs}</div><div className="sub">eligible to trigger a request</div></div>
        <div className="kpi"><div className="label">Requests logged</div><div className="val">{requests ? requests.length : '—'}</div><div className="sub">sent + queued</div></div>
        <div className="kpi"><div className="label">Auto-requests</div><div className="val">Off</div><div className="sub">trigger wires in next pass</div></div>
      </div>

      <div className="card mb16">
        <div className="card-head"><h3>Job-completion trigger</h3></div>
        <div className="card-body">
          <p className="muted" style={{ marginTop: 0 }}>When a tech marks a job complete in Journey, this sequence will fire automatically:</p>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TRIGGER_STEPS.map((s, i) => (
              <div className="step-row" key={i}><span className="n">{i + 1}</span><span>{s}</span></div>
            ))}
          </div>
          <div className="note" style={{ marginTop: 16 }}>
            <span className="i">i</span>
            <span>The trigger runs on <code>jobs.completed_at</code> via an edge function (queued next), which writes a row here and sends the request through your existing Twilio. 4+ stars and 50+ reviews convert leads at roughly 2–3× the rate of unrated competitors.</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Recent review requests</h3></div>
        <div className="card-body">
          {requests === null && <p className="muted">Loading…</p>}
          {requests && requests.length === 0 && (
            <p className="muted">None yet — requests will appear here once the completion trigger is live.</p>
          )}
          {requests && requests.map((r) => (
            <div className="rev-item" key={r.id}>
              <span className="glyph" style={{ background: '#c78320', width: 30, height: 30 }}>★</span>
              <div style={{ flex: 1 }}>
                <div className="rev-name">{r.platform === 'facebook' ? 'Facebook' : 'Google'} review request</div>
                <div className="rev-when">Status: {r.status}{r.sent_at ? ` · sent ${new Date(r.sent_at).toLocaleDateString()}` : ''}</div>
                {r.rating && <div className="stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
