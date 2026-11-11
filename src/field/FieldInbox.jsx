import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldShell from './FieldShell'
import { supabase } from '../utils/supabase'
import { usd, fmtPhone, shortWhen, callFn } from './fieldUtil'

// INBOX — everything that came in while you were on a roof: customer texts, online bookings,
// service requests, approved estimates and payments. Newest first; new since your last look in bold.
const SEEN_KEY = 'fa_inbox_seen'
const SOURCE = { duct_app: 'Duct Cleaning app', systems_app: 'Systems app', portal: 'Customer Portal', service_request: 'Service request' }
const last10 = (p) => String(p || '').replace(/\D/g, '').slice(-10)

export function useInboxSeen() {
  const [seen] = useState(() => { try { return Number(localStorage.getItem(SEEN_KEY) || 0) } catch { return 0 } })
  return seen
}

export default function FieldInbox({ profile }) {
  const navigate = useNavigate()
  const orgId = profile?.org_id
  const seen = useInboxSeen()
  const [items, setItems] = useState(null)
  const [open, setOpen] = useState(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!orgId) return
    let live = true
    ;(async () => {
      const since = new Date(Date.now() - 14 * 86400000).toISOString()
      const [jt, un, bk, sr, est, pay] = await Promise.all([
        supabase.from('job_texts').select('id, job_id, to_phone, body, created_at, recipient_name, jobs ( job_number, customers ( display_name ) )')
          .eq('org_id', orgId).eq('direction', 'inbound').is('deleted_at', null).is('archived_at', null).gte('created_at', since).order('created_at', { ascending: false }).limit(50),
        supabase.from('sms_inbound_unmatched').select('id, from_phone, body, received_at, customers ( id, display_name )')
          .eq('org_id', orgId).eq('direction', 'inbound').eq('status', 'new').order('received_at', { ascending: false }).limit(50),
        supabase.from('jobs').select('id, job_number, job_type, job_date, booking_source, received_at, created_at, customers ( display_name )')
          .eq('org_id', orgId).not('booking_source', 'is', null).is('deleted_at', null).gte('created_at', since).order('created_at', { ascending: false }).limit(30),
        supabase.from('service_requests').select('id, reporter_name, reporter_phone, category, urgency, details, status, created_at')
          .eq('org_id', orgId).in('status', ['pending', 'awaiting_owner']).is('archived_at', null).order('created_at', { ascending: false }).limit(30),
        supabase.from('invoices').select('id, invoice_number, job_total, approved_at, approved_by, job_id, converted_to_job_id, spawned_job_id, bills_to_customer_id')
          .eq('org_id', orgId).eq('kind', 'estimate').eq('approval_status', 'Approved').is('deleted_at', null).gte('approved_at', since).order('approved_at', { ascending: false }).limit(30),
        supabase.from('invoice_payments').select('id, amount, method, recorded_at, invoices ( invoice_number, job_id )')
          .eq('org_id', orgId).gte('recorded_at', since).order('recorded_at', { ascending: false }).limit(30),
      ])
      // Group unmatched texts into one item per phone number.
      const byPhone = new Map()
      for (const r of un.data || []) {
        const k = last10(r.from_phone)
        if (!byPhone.has(k)) byPhone.set(k, { ...r, ids: [], bodies: [] })
        const g = byPhone.get(k); g.ids.push(r.id); g.bodies.unshift(r.body)
      }
      const out = [
        ...(jt.data || []).map((t) => ({ key: 'jt' + t.id, kind: 'text', at: t.created_at, title: t.jobs?.customers?.display_name || t.recipient_name || fmtPhone(t.to_phone), sub: `Job #${t.jobs?.job_number || ''}`, body: t.body, go: `/tech/messages/${t.job_id}` })),
        ...[...byPhone.values()].map((g) => ({ key: 'un' + g.id, kind: 'newtext', at: g.received_at, title: g.customers?.display_name || fmtPhone(g.from_phone), sub: g.customers ? 'Text — no open job' : 'Text from a new number', body: g.bodies.join('\n'), phone: g.from_phone, ids: g.ids })),
        ...(bk.data || []).map((j) => ({ key: 'bk' + j.id, kind: 'booking', at: j.received_at || j.created_at, title: j.customers?.display_name || 'New booking', sub: `Booked online${j.booking_source ? ` — ${SOURCE[j.booking_source] || j.booking_source}` : ''}`, body: `${j.job_type || 'Job'} · ${j.job_date ? new Date(j.job_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'date to be set'}`, go: `/tech/field/job/${j.id}` })),
        ...(sr.data || []).map((r) => ({ key: 'sr' + r.id, kind: 'request', at: r.created_at, title: r.reporter_name || fmtPhone(r.reporter_phone) || 'Service request', sub: `Service request${r.urgency ? ` · ${r.urgency}` : ''}${r.status === 'awaiting_owner' ? ' · waiting on owner' : ''}`, body: [r.category, r.details].filter(Boolean).join(' — '), req: r })),
        ...(est.data || []).map((e) => ({ key: 'es' + e.id, kind: 'approved', at: e.approved_at, title: `Estimate #${e.invoice_number} approved`, sub: e.approved_by || '', body: usd(e.job_total), go: (e.spawned_job_id || e.converted_to_job_id || e.job_id) ? `/tech/field/job/${e.spawned_job_id || e.converted_to_job_id || e.job_id}` : null })),
        ...(pay.data || []).map((p) => ({ key: 'py' + p.id, kind: 'payment', at: p.recorded_at, title: `Payment ${usd(p.amount)}`, sub: `Invoice #${p.invoices?.invoice_number || ''} · ${p.method || ''}`, body: '', go: p.invoices?.job_id ? `/tech/field/job/${p.invoices.job_id}` : '/tech/field/money' })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at))
      if (live) setItems(out)
    })()
    return () => { live = false }
  }, [orgId, reload])
  // Mark everything as seen when leaving the screen.
  useEffect(() => () => { try { localStorage.setItem(SEEN_KEY, String(Date.now())) } catch { /* private mode */ } }, [])

  async function sendReply(it) {
    if (!reply.trim()) return
    setBusy('reply'); setMsg(null)
    const { error } = await callFn('send-sms', { to: it.phone, body: reply.trim(), orgId })
    setBusy('')
    if (error) { setMsg({ key: it.key, ok: false, t: error }); return }
    setReply(''); setMsg({ key: it.key, ok: true, t: 'Sent.' })
  }
  async function handled(it) {
    setBusy('handled')
    await supabase.from('sms_inbound_unmatched').update({ status: 'handled', handled_at: new Date().toISOString(), handled_by: profile?.id || null }).in('id', it.ids)
    setBusy(''); setOpen(null); setReload((n) => n + 1)
  }
  async function decide(it, ok) {
    setBusy('req'); setMsg(null)
    const { error } = await supabase.rpc(ok ? 'approve_service_request' : 'decline_service_request', { p_request_id: it.req.id })
    setBusy('')
    if (error) { setMsg({ key: it.key, ok: false, t: error.message }); return }
    setOpen(null); setReload((n) => n + 1)
  }

  const ICON = { text: '💬', newtext: '💬', booking: '📅', request: '🛠️', approved: '✅', payment: '💵' }
  return (
    <FieldShell profile={profile} title="Inbox" onBack={() => navigate('/tech/field')}>
      <div className="fa-panel">
        {!items ? <p className="fa-empty">Loading…</p> : !items.length ? <p className="fa-empty">Nothing new in the last two weeks.</p> : items.map((it) => {
          const fresh = new Date(it.at).getTime() > seen
          const expandable = it.kind === 'newtext' || it.kind === 'request'
          return (
            <div key={it.key} className="fa-info" role="button" tabIndex={0} style={{ cursor: 'pointer', padding: '10px 12px', borderWidth: fresh ? 2.5 : 1.5 }}
              onClick={() => (expandable ? setOpen(open === it.key ? null : it.key) : it.go && navigate(it.go))}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ fontSize: 20, lineHeight: '24px' }}>{ICON[it.kind]}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: fresh ? 900 : 700, fontSize: 15 }}>{it.title}</div>
                    <div className="fa-muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{shortWhen(it.at)}</div>
                  </div>
                  {it.sub && <div className="fa-muted" style={{ fontSize: 12.5 }}>{it.sub}</div>}
                  {it.body && <div style={{ fontSize: 14, marginTop: 3, whiteSpace: 'pre-wrap', ...(open === it.key ? {} : { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }) }}>{it.body}</div>}
                </div>
              </div>
              {open === it.key && it.kind === 'newtext' && (
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  <textarea className="fa-textarea" rows={2} placeholder="Reply from your company number…" value={reply} onChange={(e) => setReply(e.target.value)} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className="fa-small-btn" disabled={!!busy || !reply.trim()} onClick={() => sendReply(it)}>{busy === 'reply' ? 'Sending…' : 'Send'}</button>
                    <a className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)', textDecoration: 'none' }} href={`tel:${last10(it.phone)}`}>Call</a>
                    <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)' }} onClick={() => navigate('/tech/field/add', { state: { phone: it.phone } })}>+ Job</button>
                    <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)' }} disabled={!!busy} onClick={() => handled(it)}>Done</button>
                  </div>
                </div>
              )}
              {open === it.key && it.kind === 'request' && (
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {it.req.status === 'pending' && <button type="button" className="fa-small-btn" disabled={!!busy} onClick={() => decide(it, true)}>{busy === 'req' ? 'Saving…' : 'Approve → make a job'}</button>}
                  <button type="button" className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-red)', borderColor: 'var(--fa-red)' }} disabled={!!busy} onClick={() => decide(it, false)}>Decline</button>
                  {it.req.reporter_phone && <a className="fa-small-btn" style={{ background: '#fff', color: 'var(--fa-navy)', textDecoration: 'none' }} href={`tel:${last10(it.req.reporter_phone)}`}>Call</a>}
                </div>
              )}
              {msg?.key === it.key && <div className={`fa-msg ${msg.ok ? 'ok' : 'err'}`} style={{ marginTop: 8 }}>{msg.t}</div>}
            </div>
          )
        })}
      </div>
    </FieldShell>
  )
}

// Count of inbox items newer than the last look — for the badge on Field Management.
export async function inboxNewCount(orgId) {
  let seen = 0
  try { seen = Number(localStorage.getItem(SEEN_KEY) || 0) } catch { /* private mode */ }
  const since = new Date(Math.max(seen, Date.now() - 14 * 86400000)).toISOString()
  const q = (t) => t.then((r) => r.count || 0)
  const n = await Promise.all([
    q(supabase.from('job_texts').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('direction', 'inbound').is('deleted_at', null).gte('created_at', since)),
    q(supabase.from('sms_inbound_unmatched').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('direction', 'inbound').eq('status', 'new').gte('received_at', since)),
    q(supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('org_id', orgId).not('booking_source', 'is', null).gte('created_at', since)),
    q(supabase.from('service_requests').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'pending').gte('created_at', since)),
    q(supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('kind', 'estimate').eq('approval_status', 'Approved').gte('approved_at', since)),
    q(supabase.from('invoice_payments').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('recorded_at', since)),
  ])
  return n.reduce((a, b) => a + b, 0)
}
