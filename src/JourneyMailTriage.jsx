import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { canUseJourneyDesk } from './JourneyAppointmentModal'

// Quincy's inbox sort (Journey (Platform) org). Every email in the Journey inbox is sorted into the same types
// as calls; Quincy files the pitches, creates follow-ups and demo requests, and drafts replies.
// Nothing is sent until someone here approves it.
const TZ = 'America/New_York'
const TYPES = {
  demo_request: { l: 'Demo request', c: '#2F79C4' }, signup_request: { l: 'Sign-up', c: '#0E7C66' }, support: { l: 'Support', c: '#B45309' },
  suggestion: { l: 'Suggestion', c: '#16A34A' }, vendor: { l: 'Vendor', c: '#9C6A12' }, employee: { l: 'Employee', c: '#475569' },
  offer: { l: 'Sales pitch', c: '#94A3B8' }, inquiry: { l: 'Inquiry', c: '#DB2777' }, family: { l: 'Personal', c: '#7C3AED' },
  notification: { l: 'Notice', c: '#CBD5E1' }, other: { l: 'Other', c: '#64748B' },
}
const fmtWhen = (ts) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })

export default function JourneyMailTriage({ profile }) {
  const [rows, setRows] = useState(null)
  const [view, setView] = useState('replies')
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')

  const load = async () => {
    let q = supabase.from('journey_email_triage').select('*, mail:mail_messages(id, from_name, received_at, snippet)').order('created_at', { ascending: false }).limit(300)
    if (view === 'replies') q = q.eq('reply_status', 'pending')
    else if (view === 'action') q = q.not('followup_id', 'is', null)
    else if (view === 'filed') q = q.in('type', ['offer', 'notification'])
    const { data } = await q
    setRows(data || [])
    setDrafts(Object.fromEntries((data || []).filter((r) => r.reply_status === 'pending').map((r) => [r.id, { subject: r.draft_subject || '', body: r.draft_reply || '' }])))
  }
  useEffect(() => { if (canUseJourneyDesk(profile)) load() }, [view])
  if (!canUseJourneyDesk(profile)) return <div className="page-container">Journey platform account only.</div>

  const send = async (r) => {
    setBusy(r.id); setMsg('')
    const d = drafts[r.id]
    const { data, error } = await supabase.functions.invoke('journey-mail-triage', { body: { action: 'send', triage_id: r.id, subject: d.subject, body: d.body } })
    setBusy(null)
    if (error || data?.error) { setMsg((data && data.error) || 'Sending failed.'); return }
    setMsg(`Reply sent to ${r.from_email}.`); load()
  }
  const dismiss = async (r) => { await supabase.from('journey_email_triage').update({ reply_status: 'dismissed', updated_at: new Date().toISOString() }).eq('id', r.id); load() }
  const checkNow = async () => {
    setBusy('check'); setMsg('')
    const { data, error } = await supabase.functions.invoke('journey-mail-triage', { body: { action: 'run' } })
    setBusy(null); setMsg(error ? 'Could not check right now.' : `${data?.sorted || 0} new email${data?.sorted === 1 ? '' : 's'} sorted.`); load()
  }

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Quincy's inbox sort</h1>
        <button className="btn" style={{ marginLeft: 'auto' }} disabled={busy === 'check'} onClick={checkNow}>{busy === 'check' ? 'Checking…' : '↻ Check now'}</button>
        <Link className="btn" to="/mail">Open Mail →</Link>
      </div>
      <p style={{ color: '#64748B', marginTop: 4 }}>Quincy reads the Journey inbox every few minutes, sorts each email, files the sales pitches, and creates the follow-ups and demo requests. Replies wait here for your OK — nothing is sent until you approve it.</p>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        {[['replies', 'Replies to approve'], ['action', 'Follow-ups created'], ['all', 'Everything'], ['filed', 'Filed (pitches & notices)']].map(([k, l]) => <button key={k} className={view === k ? 'btn btn-primary' : 'btn'} onClick={() => setView(k)}>{l}</button>)}
      </div>
      {msg && <div style={{ marginBottom: 10, fontWeight: 700, color: /fail|could|not/i.test(msg) ? '#B42318' : '#15803D' }}>{msg}</div>}
      {!rows && <p style={{ color: '#64748B' }}>Loading…</p>}
      {rows && !rows.length && <p style={{ color: '#64748B' }}>{view === 'replies' ? 'No replies waiting. 🎉' : 'Nothing here yet.'}</p>}
      {(rows || []).map((r) => {
        const t = TYPES[r.type] || TYPES.other, pending = r.reply_status === 'pending', d = drafts[r.id]
        return (
          <div key={r.id} className="section-card" style={{ padding: 16, marginBottom: 12, borderLeft: `4px solid ${t.c}`, background: r.priority === 'important' ? '#FFF7ED' : undefined }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ background: t.c, color: r.type === 'notification' ? '#334155' : '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{t.l}</span>
              {r.priority === 'important' && <span style={{ color: '#C2410C', fontWeight: 700 }}>⚑ Important</span>}
              <b>{r.contact_name || r.mail?.from_name || r.from_email}</b>{r.company ? <span style={{ color: '#64748B' }}>· {r.company}</span> : null}
              <span style={{ marginLeft: 'auto', color: '#64748B', fontSize: 13 }}>{fmtWhen(r.mail?.received_at || r.created_at)}</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 14.5 }}><b>{r.subject || '(no subject)'}</b></div>
            {r.summary && <div style={{ fontSize: 14, color: '#334155', marginTop: 2 }}>{r.summary}</div>}
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 6 }}>
              Quincy: {r.action_taken || '—'}
              {r.followup_id && <> · <Link to="/journey-followups">Follow-ups →</Link></>}
              {r.sales_lead_id && <> · <Link to="/sales-leads">Demo Requests →</Link></>}
              {r.customer_id && <> · <Link to={`/customers/${r.customer_id}`}>Customer →</Link></>}
              {r.reply_status === 'sent' && <> · ✓ Reply sent {r.sent_at ? fmtWhen(r.sent_at) : ''}</>}
              {r.reply_status === 'dismissed' && <> · reply dismissed</>}
            </div>
            {pending && d && (
              <div style={{ marginTop: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Reply to {r.from_email} — edit as you like</div>
                <input value={d.subject} onChange={(e) => setDrafts({ ...drafts, [r.id]: { ...d, subject: e.target.value } })} style={{ width: '100%', marginBottom: 6, boxSizing: 'border-box' }} />
                <textarea rows={Math.min(14, Math.max(5, d.body.split('\n').length + 1))} value={d.body} onChange={(e) => setDrafts({ ...drafts, [r.id]: { ...d, body: e.target.value } })} style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.45 }} />
                {r.error && <div style={{ color: '#B42318', fontSize: 13 }}>Last try: {r.error}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary" disabled={busy === r.id || !d.body.trim()} onClick={() => send(r)}>{busy === r.id ? 'Sending…' : '✓ Approve & send'}</button>
                  <button className="btn" onClick={() => dismiss(r)}>Don't reply</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
