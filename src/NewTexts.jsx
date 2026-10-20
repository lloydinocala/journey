// Text Archive → "New texts": texts that came in on the company's number but aren't part of a
// job thread — a possible new customer, or an existing customer without a job. Grouped into
// one conversation per phone number. The office can reply (sent from the company's own
// number), link the number to a customer, or mark it handled.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { notifyAgentInbox } from './AgentInboxBadge'

const BLUE = '#215F9A'
const last10 = (p) => String(p || '').replace(/\D/g, '').slice(-10)
const pretty = (p) => { const d = last10(p); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (p || '') }
const fmt = (t) => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }

export function useNewTextCount(enabled) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!enabled) return
    supabase.from('sms_inbound_unmatched').select('from_phone').eq('direction', 'inbound').eq('status', 'new').limit(500)
      .then(({ data }) => setN(new Set((data || []).map((r) => last10(r.from_phone))).size))
  }, [enabled])
  return n
}

export default function NewTexts({ profile, onCount }) {
  const isSuper = profile?.role === 'super_admin'
  const [rows, setRows] = useState([])
  const [orgNames, setOrgNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [showHandled, setShowHandled] = useState(false)
  const [sel, setSel] = useState(() => { try { return new URLSearchParams(window.location.search).get('new') || null } catch (e) { return null } })
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [custQ, setCustQ] = useState('')
  const [custHits, setCustHits] = useState([])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('sms_inbound_unmatched')
      .select('id, org_id, customer_id, from_phone, to_phone, body, direction, status, error, received_at, handled_at, customers ( id, display_name )')
      .order('received_at', { ascending: true }).limit(2000)
    setRows(data || [])
    if (isSuper) {
      const ids = [...new Set((data || []).map((r) => r.org_id).filter(Boolean))]
      if (ids.length) {
        const { data: o } = await supabase.from('organizations').select('id, name, dba_name').in('id', ids)
        setOrgNames(Object.fromEntries((o || []).map((x) => [x.id, x.dba_name || x.name])))
      }
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const convos = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      const k = (r.org_id || 'none') + ':' + last10(r.from_phone)
      if (!map.has(k)) map.set(k, { key: k, phone: last10(r.from_phone), orgId: r.org_id, messages: [], customer: null, isNew: false, lastAt: r.received_at })
      const c = map.get(k)
      c.messages.push(r)
      c.lastAt = r.received_at
      if (r.customers) c.customer = r.customers
      if (r.direction === 'inbound' && r.status === 'new') c.isNew = true
    }
    return [...map.values()].sort((a, b) => (b.isNew - a.isNew) || (new Date(b.lastAt) - new Date(a.lastAt)))
  }, [rows])

  const newCount = convos.filter((c) => c.isNew).length
  useEffect(() => { onCount && onCount(newCount) }, [newCount])
  const shown = convos.filter((c) => showHandled || c.isNew || c.phone === sel || c.key === sel)
  const cur = convos.find((c) => c.key === sel) || convos.find((c) => c.phone === sel) || null

  async function send() {
    if (!cur || !reply.trim()) return
    setBusy(true); setErr('')
    const { data, error } = await supabase.functions.invoke('send-sms', { body: { to: cur.phone, body: reply.trim(), orgId: cur.orgId } })
    setBusy(false)
    if (error || data?.error) {
      let msg = data?.error
      if (!msg && error?.context?.json) { try { msg = (await error.context.json()).error } catch (e) { /* ignore */ } }
      setErr(msg || error?.message || 'Could not send')
    } else { setReply(''); notifyAgentInbox(); load() }
  }

  async function markHandled(c, handled) {
    const ids = c.messages.filter((m) => m.direction === 'inbound').map((m) => m.id)
    await supabase.from('sms_inbound_unmatched').update(handled ? { status: 'handled', handled_at: new Date().toISOString(), handled_by: profile?.id || null } : { status: 'new', handled_at: null, handled_by: null }).in('id', ids)
    load()
  }

  async function searchCustomers(q) {
    setCustQ(q)
    if (q.trim().length < 2) { setCustHits([]); return }
    let qb = supabase.from('customers').select('id, display_name, primary_phone').ilike('display_name', `%${q.trim()}%`).limit(8)
    if (cur?.orgId) qb = qb.eq('org_id', cur.orgId)
    const { data } = await qb
    setCustHits(data || [])
  }
  async function linkCustomer(c, customerId) {
    await supabase.from('sms_inbound_unmatched').update({ customer_id: customerId }).in('id', c.messages.map((m) => m.id))
    setCustQ(''); setCustHits([]); load()
  }

  if (loading) return <p style={{ color: 'var(--mist)' }}>Loading…</p>

  return (
    <div>
      <p style={{ color: 'var(--mist)', fontSize: 13.5, marginTop: 0 }}>
        Texts sent to your company's number that aren't part of a job thread — often a new customer, or a customer who doesn't have a job right now. Replies go out from your company's number. Texts from customers who have a job go straight into that job's thread instead.
      </p>
      <label style={{ fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
        <input type="checkbox" checked={showHandled} onChange={(e) => setShowHandled(e.target.checked)} /> Show handled conversations
      </label>
      {!shown.length ? (
        <p style={{ color: 'var(--mist)' }}>{convos.length ? 'Nothing new — every conversation has been handled.' : 'No new texts yet.'}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)', background: '#fff' }}>
            {shown.map((c) => {
              const last = c.messages[c.messages.length - 1]
              const active = cur?.key === c.key
              return (
                <button key={c.key} onClick={() => { setSel(c.key); setErr('') }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'inherit', background: active ? 'rgba(33,95,154,0.08)' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ color: '#101418' }}>{c.isNew && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#D92D20', marginRight: 6 }} />}{c.customer?.display_name || pretty(c.phone)}</strong>
                    <span style={{ fontSize: 11, color: '#9AA6B2' }}>{fmt(c.lastAt)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: BLUE, fontWeight: 700, marginTop: 2 }}>{c.customer ? pretty(c.phone) : 'Not a customer yet'}{isSuper && c.orgId ? ` · ${orgNames[c.orgId] || ''}` : ''}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last.direction === 'inbound' ? '↩ ' : 'You: '}{last.body}</div>
                </button>
              )
            })}
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: '#fff', minHeight: 320, padding: cur ? 18 : 40 }}>
            {!cur ? <p style={{ color: 'var(--mist)', textAlign: 'center', marginTop: 40 }}>Select a conversation on the left.</p> : (
              <>
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{cur.customer?.display_name || pretty(cur.phone)}</div>
                    <div style={{ fontSize: 13, color: 'var(--mist)' }}>
                      {pretty(cur.phone)}{cur.customer ? <> · <Link to={`/customers/${cur.customer.id}`} style={{ color: BLUE }}>Open customer</Link></> : ' · not linked to a customer'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {cur.isNew
                      ? <button className="logout-button" style={{ margin: 0 }} onClick={() => markHandled(cur, true)}>✓ Mark handled</button>
                      : <button className="logout-button" style={{ margin: 0 }} onClick={() => markHandled(cur, false)}>Mark as new</button>}
                  </div>
                </div>

                {!cur.customer && (
                  <div style={{ background: '#F6F8FA', border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 14, fontSize: 13 }}>
                    <b>Who is this?</b> Link the number to an existing customer, or <Link to="/customers" style={{ color: BLUE }}>add them as a new customer</Link> (put {pretty(cur.phone)} in their phone so future texts find them).
                    <div style={{ position: 'relative', marginTop: 8, maxWidth: 360 }}>
                      <input value={custQ} onChange={(e) => searchCustomers(e.target.value)} placeholder="Search customers by name…" style={{ width: '100%' }} />
                      {custHits.length > 0 && (
                        <div style={{ position: 'absolute', zIndex: 5, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,.08)' }}>
                          {custHits.map((h) => (
                            <button key={h.id} onClick={() => linkCustomer(cur, h.id)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: '#fff', padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                              {h.display_name}{h.primary_phone ? <span style={{ color: 'var(--mist)' }}> · {h.primary_phone}</span> : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  {cur.messages.map((m) => {
                    const out = m.direction === 'outbound'
                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: out ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '72%', padding: '9px 13px', borderRadius: 14, fontSize: 14, lineHeight: 1.4, background: out ? BLUE : '#EEF1F4', color: out ? '#fff' : '#101418', borderBottomRightRadius: out ? 4 : 14, borderBottomLeftRadius: out ? 14 : 4, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                        <div style={{ fontSize: 11, color: m.status === 'failed' ? '#B5462F' : '#9AA6B2', marginTop: 3 }}>
                          {out ? (m.status === 'failed' ? `✗ Not sent${m.error ? ` (${m.error})` : ''}` : '✓ Sent') : 'Received'} · {fmt(m.received_at)}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply…" style={{ flex: 1 }} maxLength={1200} />
                  <button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={send} disabled={busy || !reply.trim()}>{busy ? 'Sending…' : 'Send'}</button>
                </div>
                {err && <div className="auth-error" style={{ marginTop: 8 }}>{err}</div>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
