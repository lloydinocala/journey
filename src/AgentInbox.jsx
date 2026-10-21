import { useState, useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { isSettingsAdmin, settingsHref } from './utils/settingsMap'
import { notifyAgentInbox } from './AgentInboxBadge'

// The Agent Inbox. Journey's AI agents watch for situations (a customer texted back, an
// estimate went unanswered, an invoice is overdue, a visit needs rescheduling), draft the
// message, and file it here. Each person sees only the drafts their roles & permissions
// cover — the database enforces it. Approve sends it (after any edits); Dismiss drops it.
// Activity is the full log of what the agents drafted, sent, or did on their own.

const MODE_LABEL = { suggest: 'Suggest', draft: 'Draft for approval', auto: 'Did it and reported' }
const STATUS = {
  pending: ['Waiting on you', '#1F3A5F', '#E8EEF6'],
  failed: ['Failed — retry', '#B42318', '#FDECEA'],
  done: ['Done', '#15803D', '#E8F5EC'],
  dismissed: ['Dismissed', '#64748B', '#F1F5F9'],
  expired: ['No longer needed', '#64748B', '#F1F5F9'],
}
const when = (t) => (t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
const fmtPhone = (p) => { const d = String(p || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p || '' }

export default function AgentInbox({ profile }) {
  const location = useLocation()
  const focus = new URLSearchParams(location.search).get('focus')
  const isSuper = profile?.role === 'super_admin'
  const [orgs, setOrgs] = useState([])
  const [orgId, setOrgId] = useState(profile?.org_id || '')
  const [tab, setTab] = useState('inbox')
  const [area, setArea] = useState('')
  const [skills, setSkills] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState('')
  const admin = isSettingsAdmin(profile)

  useEffect(() => {
    supabase.from('agent_skills').select('*').order('sort').then(({ data }) => setSkills(data || []))
    if (isSuper) supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      setOrgs(data || []); if (!orgId && data?.length) setOrgId(data[0].id)
    })
  }, [])

  async function load() {
    if (!orgId) return
    setLoading(true)
    let q = supabase.from('agent_actions').select('*').eq('org_id', orgId)
    if (tab === 'inbox') q = q.in('status', ['pending', 'failed']).order('priority', { ascending: false }).order('created_at', { ascending: true })
    else q = q.in('status', ['done', 'dismissed', 'expired']).gte('created_at', new Date(Date.now() - 60 * 86400000).toISOString()).order('created_at', { ascending: false }).limit(300)
    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [orgId, tab])

  const skillBy = useMemo(() => Object.fromEntries(skills.map((s) => [s.key, s])), [skills])
  const areas = [...new Set(skills.map((s) => s.area))]
  const shown = rows.filter((r) => !area || skillBy[r.skill_key]?.area === area)

  async function runNow() {
    setRunning(true); setMsg('')
    const { data, error } = await supabase.functions.invoke('agent', { body: { mode: 'run', orgId } })
    setRunning(false)
    if (error || data?.error) { setMsg(data?.error || error.message); return }
    const r = data?.reports?.[0] || {}
    setMsg(`Agents ran: ${r.created || 0} new item${r.created === 1 ? '' : 's'}${r.expired ? `, ${r.expired} cleared (no longer needed)` : ''}${r.deferred ? `, ${r.deferred} more next run` : ''}${r.skipped_cap ? ` — daily limit reached, ${r.skipped_cap} waiting` : ''}.`)
    load(); notifyAgentInbox()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>🤖 Agent Inbox</h2>
          <p style={{ color: 'var(--mist)', margin: 0, fontSize: 14, maxWidth: 720 }}>
            Journey's agents spot what needs doing and prepare it. Review, edit if you like, and approve — or dismiss. You see the items your role covers.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {isSuper && (
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          {admin && <button className="logout-button" disabled={running || !orgId} onClick={runNow}>{running ? 'Running…' : '▶ Run agents now'}</button>}
          {admin && <Link to={settingsHref('agents', '/agent-inbox', 'Agent Inbox')} className="logout-button" style={{ textDecoration: 'none' }}>⚙ Agent settings</Link>}
        </div>
      </div>
      {msg && <div style={{ background: '#EEF4FB', border: '1px solid #C9DAEE', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13.5 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        {[['inbox', 'Needs you'], ['activity', 'Activity log']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 14px', borderRadius: 999, border: '1px solid ' + (tab === k ? '#1F3A5F' : 'var(--border)'), background: tab === k ? '#1F3A5F' : '#fff', color: tab === k ? '#fff' : '#334155', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{l}</button>
        ))}
        <select value={area} onChange={(e) => setArea(e.target.value)} style={{ marginLeft: 'auto', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
          <option value="">All areas</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading ? <p style={{ color: 'var(--mist)' }}>Loading…</p>
        : !shown.length ? (
          <div className="section-card" style={{ padding: 28, textAlign: 'center', color: 'var(--mist)' }}>
            {tab === 'inbox' ? 'Nothing waiting on you. The agents check every 15 minutes.' : 'No agent activity in the last 60 days.'}
          </div>
        ) : shown.map((r) => (
          <ActionCard key={r.id} row={r} skill={skillBy[r.skill_key]} focused={focus === r.id} onChanged={() => { load(); notifyAgentInbox() }} />
        ))}
    </div>
  )
}

function ActionCard({ row, skill, focused, onChanged }) {
  const d = row.draft || {}
  const editable = row.status === 'pending' || row.status === 'failed'
  const [subject, setSubject] = useState(d.subject || '')
  const [body, setBody] = useState(d.body || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [st, label, bg] = [STATUS[row.status]?.[1], STATUS[row.status]?.[0], STATUS[row.status]?.[2]]
  const channel = d.channel || 'none'

  async function approve() {
    setBusy(true); setErr('')
    const { data, error } = await supabase.functions.invoke('agent', { body: { mode: 'approve', actionId: row.id, draft: channel === 'none' ? {} : { subject, body } } })
    setBusy(false)
    if (error || data?.error) {
      let m = data?.error || error?.message
      try { const j = await error?.context?.json?.(); if (j?.error) m = j.error } catch (e) { /* ignore */ }
      setErr(m || 'Could not send'); onChanged(); return
    }
    onChanged()
  }
  async function dismiss() {
    setBusy(true)
    const { error } = await supabase.from('agent_actions').update({ status: 'dismissed' }).eq('id', row.id)
    setBusy(false)
    if (error) setErr(error.message); else onChanged()
  }

  return (
    <div className="section-card" style={{ padding: 16, marginBottom: 12, borderLeft: `4px solid ${row.priority === 'urgent' ? '#DC2626' : '#2E6FB5'}`, outline: focused ? '2px solid #215F9A' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
            {row.priority === 'urgent' && <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#DC2626', borderRadius: 999, padding: '2px 8px' }}>URGENT</span>}
            <span style={{ fontSize: 11, fontWeight: 800, color: '#1F3A5F', background: '#E8EEF6', borderRadius: 999, padding: '2px 8px' }}>{skill?.name || row.skill_key}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: st, background: bg, borderRadius: 999, padding: '2px 8px' }}>{label}</span>
            {d.category && <span style={{ fontSize: 11, color: 'var(--mist)' }}>· {d.category.replace('_', ' ')}</span>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 15.5 }}>{row.title}</div>
          {row.reason && <div style={{ fontSize: 13.5, color: '#475569', whiteSpace: 'pre-wrap', marginTop: 3 }}>{row.reason}</div>}
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--mist)', flex: 'none' }}>
          <div>{when(row.created_at)}</div>
          {row.link && <Link to={row.link} style={{ fontWeight: 700 }}>Open {row.subject_label || 'record'} →</Link>}
        </div>
      </div>

      {channel !== 'none' && (
        <div style={{ marginTop: 12, background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12.5, color: 'var(--mist)', marginBottom: 6 }}>
            {channel === 'sms' ? '💬 Text' : '✉️ Email'} to <b style={{ color: '#334155' }}>{d.to_name || ''}</b> {channel === 'sms' ? fmtPhone(d.to) : d.to}
            {d.links?.length > 1 ? <> · {d.links.length} pay buttons, one per invoice</> : d.link && <> · button: “{d.link.label}”</>}
          </div>
          {channel === 'email' && (editable
            ? <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, fontWeight: 700 }} />
            : <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.subject}</div>)}
          {editable
            ? <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={channel === 'sms' ? 3 : 8} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }} />
            : <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{d.body}</div>}
          {channel === 'sms' && editable && <div style={{ fontSize: 11.5, color: body.length > 320 ? '#B42318' : 'var(--mist)', textAlign: 'right' }}>{body.length} characters</div>}
        </div>
      )}

      {(row.error || err) && <div style={{ color: '#B42318', fontSize: 13, marginTop: 8 }}>⚠ {err || row.error}</div>}
      {!editable && row.result && (
        <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 8 }}>
          {row.mode === 'auto' && !row.decided_by ? 'Sent automatically' : row.status === 'done' ? (row.result.note || 'Handled') : ''}
          {row.executed_at ? ` · ${when(row.executed_at)}` : ''}
        </div>
      )}

      {editable && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="logout-button" disabled={busy} onClick={approve} style={{ background: '#15803D', color: '#fff', borderColor: '#15803D' }}>
            {busy ? 'Working…' : channel === 'none' ? '✓ Mark handled' : row.status === 'failed' ? '↻ Retry send' : channel === 'sms' ? '✓ Approve & send text' : '✓ Approve & send email'}
          </button>
          <button className="logout-button" disabled={busy} onClick={dismiss}>Dismiss</button>
          <span style={{ fontSize: 12, color: 'var(--mist)', alignSelf: 'center' }}>{MODE_LABEL[row.mode]}</span>
        </div>
      )}
    </div>
  )
}
