import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './utils/supabase'
import './modules/customer-hvac/portal.css'

const CAT = { repair: 'Repair', tuneup: 'Tune-up', question: 'Question' }

// Public page the account holder lands on from the approval email (/a/:token).
// They approve or decline a service request made by someone else (e.g. a tenant)
// before we schedule and bill it.
export default function ServiceApproval() {
  const { token } = useParams()
  const [info, setInfo] = useState(undefined) // undefined=loading, null=invalid
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)  // 'approved' | 'declined'

  useEffect(() => {
    supabase.functions.invoke('service-request', { body: { mode: 'owner_resolve', atoken: token } })
      .then(({ data }) => setInfo(data?.ok ? data : null))
      .catch(() => setInfo(null))
  }, [token])

  async function decide(decision) {
    setBusy(true)
    const { data } = await supabase.functions.invoke('service-request', { body: { mode: 'owner_decide', atoken: token, decision } })
    setBusy(false)
    if (data?.ok) setResult(decision === 'approve' ? 'approved' : 'declined')
  }

  if (info === undefined) return <div className="cp-root"><div className="cp-center">Loading…</div></div>
  if (info === null) return (
    <div className="cp-root"><div className="cp-center">
      <div style={{ fontSize: 42 }}>🔎</div>
      <h2 className="cp-h2">This link isn’t active</h2>
      <p className="cp-lead" style={{ maxWidth: 340 }}>It may have already been handled. Please call the office if you have questions.</p>
    </div></div>
  )

  const finished = result || info.decided
  if (finished) {
    const approved = result ? result === 'approved' : info.approved
    return (
      <div className="cp-root"><div className="cp-center">
        <div style={{ fontSize: 46 }}>{approved ? '✅' : '☑️'}</div>
        <h2 className="cp-h2">{approved ? 'Approved — thank you' : 'Declined'}</h2>
        <p className="cp-lead" style={{ maxWidth: 360 }}>
          {approved
            ? `${info.org_name} has been notified and will schedule the service.`
            : `We’ve let ${info.org_name} know you declined. Nothing will be scheduled or billed.`}
        </p>
      </div></div>
    )
  }

  return (
    <div className="cp-root">
      <div className="cp-wrap" style={{ maxWidth: 460, margin: '0 auto', paddingTop: 24 }}>
        <div className="cp-brandtag" style={{ position: 'static', marginBottom: 8 }}>{info.org_name}</div>
        <h2 className="cp-h2">Approve service at your property?</h2>
        <p className="cp-lead" style={{ marginTop: -4 }}>📍 {info.address}</p>
        <p style={{ fontSize: 14, color: '#334155' }}>
          You’re the account holder, so we need your okay before scheduling — and only the account holder is billed. Here’s what was requested:
        </p>
        <div style={{ padding: 14, marginBottom: 16, background: '#fff', border: '1px solid #E2E6ED', borderRadius: 10 }}>
          <div style={{ fontWeight: 800 }}>{CAT[info.category] || 'Request'}{info.urgency ? ` · ${info.urgency}` : ''}</div>
          {info.details && <div style={{ marginTop: 6 }}>{info.details}</div>}
          <div style={{ marginTop: 8, fontSize: 13, color: '#64748B' }}>Requested by: {info.reporter_name || '—'}</div>
        </div>
        <button className="cp-btn" style={{ background: '#1f7a43', marginBottom: 10 }} disabled={busy} onClick={() => decide('approve')}>{busy ? 'Working…' : 'Approve — schedule it'}</button>
        <button className="cp-btn" style={{ background: '#b0342f' }} disabled={busy} onClick={() => decide('decline')}>{busy ? 'Working…' : 'Decline'}</button>
        <p className="cp-note">Nothing is scheduled or billed until you approve.</p>
      </div>
    </div>
  )
}
