import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './utils/supabase'

// MAIL INBOX — a company's email, received into Journey (a copy of what reaches their real
// mailbox). The platform's own mailbox (Ventex IQ) shows only to the super-admin; a subscriber's
// mailbox shows to its office staff. Incoming mail is filed automatically: known customers /
// vendors / subscribers always land in the Inbox; unsolicited sales mail goes to Spam (reversible).
// Marking a sender as spam teaches the mailbox; "Not spam" whitelists them.

export function notifyMailChanged() { try { window.dispatchEvent(new Event('mail-changed')) } catch (_) { /* ignore */ } }

const FOLDERS = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'spam', label: 'Spam' },
  { key: 'archive', label: 'Archive' },
]
const CATS = {
  customer: { label: 'Customer', color: '#2E6FB5' },
  subscriber: { label: 'Subscriber', color: '#2E6FB5' },
  vendor: { label: 'Vendor', color: '#B45309' },
  official: { label: 'Official', color: '#6A54C4' },
  notification: { label: 'Notice', color: '#64748B' },
  personal: { label: 'Personal', color: '#15803D' },
  solicitation: { label: 'Sales pitch', color: '#B0342F' },
  other: { label: 'Other', color: '#64748B' },
}
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'people', label: 'Customers / Subscribers', cats: ['customer', 'subscriber'] },
  { key: 'vendor', label: 'Vendors', cats: ['vendor'] },
  { key: 'official', label: 'Official', cats: ['official'] },
  { key: 'notification', label: 'Notices', cats: ['notification'] },
  { key: 'other', label: 'Other', cats: ['personal', 'other', 'solicitation', null] },
]

const when = (ts) => {
  const d = new Date(ts)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
}
const fullWhen = (ts) => new Date(ts).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const sizeText = (n) => (!n ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`)
const sender = (m) => m.from_name || m.from_email || '(unknown sender)'

function Pill({ cat }) {
  const c = CATS[cat]
  if (!c) return null
  return <span style={{ fontSize: 11, fontWeight: 700, color: c.color, background: c.color + '16', border: `1px solid ${c.color}40`, borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' }}>{c.label}</span>
}

function Body({ msg }) {
  const [images, setImages] = useState(false)
  useEffect(() => { setImages(false) }, [msg.id])
  const hasRemote = !!msg.html_body && /<img[^>]+src=["']?https?:/i.test(msg.html_body)
  if (!msg.html_body) {
    return <div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.55, color: '#1E293B', padding: '4px 2px' }}>{msg.text_body || '(no text)'}</div>
  }
  // Rendered in a locked-down frame: no scripts, links open in a new tab, and outside images
  // (often trackers) stay off until asked for.
  const csp = `default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:${images ? ' https: http:' : ''};`
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14.5px;color:#1E293B;margin:8px;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${msg.html_body}</body></html>`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 360 }}>
      {hasRemote && !images && (
        <div style={{ fontSize: 12.5, color: 'var(--mist)', marginBottom: 6 }}>
          Pictures from outside sites are hidden to protect your privacy.{' '}
          <button type="button" onClick={() => setImages(true)} style={{ border: 0, background: 'none', color: '#2E6FB5', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Show pictures</button>
        </div>
      )}
      <iframe title="Email" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc}
        style={{ flex: 1, width: '100%', minHeight: 360, border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }} />
    </div>
  )
}

export default function MailInbox({ profile }) {
  const [boxes, setBoxes] = useState(null)
  const [boxId, setBoxId] = useState('')
  const [folder, setFolder] = useState('inbox')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [msgs, setMsgs] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [linked, setLinked] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  async function loadBoxes() {
    const { data } = await supabase.rpc('mail_unread_counts')
    const list = data || []
    setBoxes(list)
    if (list.length && !list.some((b) => b.mailbox_id === boxId)) setBoxId(list[0].mailbox_id)
  }
  useEffect(() => { loadBoxes() }, [profile?.id])

  async function load(quiet) {
    if (!boxId) return
    if (!quiet) setLoading(true)
    const { data } = await supabase.from('mail_messages')
      .select('id, folder, category, is_read, starred, from_name, from_email, subject, snippet, ai_summary, received_at, attachments, spam_reason')
      .eq('mailbox_id', boxId).eq('folder', folder).order('received_at', { ascending: false }).limit(300)
    setMsgs(data || [])
    const c = {}
    for (const f of FOLDERS) {
      const { count } = await supabase.from('mail_messages').select('id', { count: 'exact', head: true })
        .eq('mailbox_id', boxId).eq('folder', f.key).eq('is_read', false)
      c[f.key] = count || 0
    }
    setCounts(c)
    setLoading(false)
  }
  useEffect(() => { setOpenId(null); load() }, [boxId, folder])
  useEffect(() => {
    const t = setInterval(() => load(true), 60000)
    return () => clearInterval(t)
  }, [boxId, folder])

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)
    const s = q.trim().toLowerCase()
    return msgs.filter((m) => (!f?.cats || f.cats.includes(m.category ?? null))
      && (!s || `${m.from_name} ${m.from_email} ${m.subject} ${m.snippet}`.toLowerCase().includes(s)))
  }, [msgs, filter, q])

  // Full message for the reading pane.
  const [full, setFull] = useState(null)
  useEffect(() => {
    setFull(null); setLinked(null); setNote('')
    if (!openId) return
    let live = true
    supabase.from('mail_messages').select('*').eq('id', openId).single().then(async ({ data }) => {
      if (!live || !data) return
      setFull(data)
      if (!data.is_read) {
        await supabase.from('mail_messages').update({ is_read: true }).eq('id', data.id)
        setMsgs((l) => l.map((m) => (m.id === data.id ? { ...m, is_read: true } : m)))
        setCounts((c) => ({ ...c, [data.folder]: Math.max(0, (c[data.folder] || 0) - 1) }))
        notifyMailChanged()
      }
      if (data.customer_id) {
        const { data: c } = await supabase.from('customers').select('id, display_name').eq('id', data.customer_id).maybeSingle()
        if (live && c) setLinked({ kind: 'Customer', name: c.display_name, to: `/customers/${c.id}` })
      } else if (data.vendor_id) {
        const { data: v } = await supabase.from('vendors').select('id, name').eq('id', data.vendor_id).maybeSingle()
        if (live && v) setLinked({ kind: 'Vendor', name: v.name })
      } else if (data.subscriber_org_id) {
        const { data: o } = await supabase.from('organizations').select('id, name').eq('id', data.subscriber_org_id).maybeSingle()
        if (live && o) setLinked({ kind: 'Subscriber', name: o.name, to: '/organizations' })
      }
    })
    return () => { live = false }
  }, [openId])

  async function move(m, to, msg) {
    setBusy(true)
    await supabase.from('mail_messages').update({ folder: to }).eq('id', m.id)
    setBusy(false)
    setOpenId(null)
    if (msg) setNote(msg)
    load(true); notifyMailChanged()
  }

  async function markSpam(m, wholeDomain) {
    if (!m.from_email) return move(m, 'spam')
    setBusy(true)
    const domain = '@' + m.from_email.split('@')[1]
    const pattern = wholeDomain ? domain : m.from_email
    await supabase.from('mail_sender_rules').delete().eq('mailbox_id', m.mailbox_id).in('pattern', [m.from_email, domain]).eq('action', 'allow')
    await supabase.from('mail_sender_rules').upsert({ mailbox_id: m.mailbox_id, pattern, action: 'spam' }, { onConflict: 'mailbox_id,pattern' })
    // Everything else from them that's sitting in the Inbox goes too.
    let upd = supabase.from('mail_messages').update({ folder: 'spam', category: 'solicitation' }).eq('mailbox_id', m.mailbox_id).eq('folder', 'inbox')
    upd = wholeDomain ? upd.ilike('from_email', `%${domain}`) : upd.eq('from_email', m.from_email)
    await upd
    await supabase.from('mail_messages').update({ folder: 'spam', category: 'solicitation' }).eq('id', m.id)
    setBusy(false); setOpenId(null)
    setNote(`Future mail from ${pattern} will go straight to Spam.`)
    load(true); notifyMailChanged()
  }

  async function notSpam(m) {
    setBusy(true)
    if (m.from_email) {
      const domain = '@' + m.from_email.split('@')[1]
      await supabase.from('mail_sender_rules').delete().eq('mailbox_id', m.mailbox_id).in('pattern', [m.from_email, domain]).eq('action', 'spam')
      await supabase.from('mail_sender_rules').upsert({ mailbox_id: m.mailbox_id, pattern: m.from_email, action: 'allow' }, { onConflict: 'mailbox_id,pattern' })
    }
    await supabase.from('mail_messages').update({ folder: 'inbox', category: m.category === 'solicitation' ? 'other' : m.category }).eq('id', m.id)
    setBusy(false); setOpenId(null)
    setNote(`Moved to Inbox. Mail from ${m.from_email || 'this sender'} will always come to the Inbox.`)
    load(true); notifyMailChanged()
  }

  async function setCategory(m, cat) {
    await supabase.from('mail_messages').update({ category: cat }).eq('id', m.id)
    setFull((f) => ({ ...f, category: cat }))
    setMsgs((l) => l.map((x) => (x.id === m.id ? { ...x, category: cat } : x)))
  }

  async function markUnread(m) {
    await supabase.from('mail_messages').update({ is_read: false }).eq('id', m.id)
    setOpenId(null); load(true); notifyMailChanged()
  }

  async function openAttachment(a) {
    if (!a.path) return
    const { data, error } = await supabase.storage.from('mail-attachments').createSignedUrl(a.path, 300)
    if (error || !data?.signedUrl) { setNote('That attachment could not be opened.'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  if (boxes === null) return <p style={{ color: 'var(--mist)' }}>Loading…</p>
  if (!boxes.length) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div className="page-header-bar"><h2>Inbox</h2></div>
        <div className="section-card" style={{ padding: 18 }}><p style={{ margin: 0 }}>No email inbox is set up for you yet.</p></div>
      </div>
    )
  }
  const box = boxes.find((b) => b.mailbox_id === boxId) || boxes[0]
  const btn = { border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '6px 11px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#1E293B' }

  return (
    <div className="mail-inbox" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        .mail-grid{display:grid;grid-template-columns:minmax(300px,420px) 1fr;gap:14px;align-items:start}
        .mail-row:hover{background:#F1F5FB}
        @media (max-width:900px){.mail-grid{grid-template-columns:1fr}.mail-grid.has-open .mail-list{display:none!important}.mail-grid:not(.has-open) .mail-read{display:none!important}}
      `}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 className="page-title" style={{ margin: 0 }}>{box.name} Inbox</h2>
        <span style={{ color: 'var(--mist)', fontSize: 14 }}>{box.address}</span>
        {boxes.length > 1 && (
          <select value={boxId} onChange={(e) => setBoxId(e.target.value)} style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
            {boxes.map((b) => <option key={b.mailbox_id} value={b.mailbox_id}>{b.name}{b.unread ? ` (${b.unread})` : ''}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {FOLDERS.map((f) => {
          const on = folder === f.key
          return (
            <button key={f.key} type="button" onClick={() => setFolder(f.key)}
              style={{ ...btn, background: on ? '#1F3A5F' : '#fff', color: on ? '#fff' : '#1E293B', borderColor: on ? '#1F3A5F' : 'var(--border)' }}>
              {f.label}{counts[f.key] ? ` (${counts[f.key]})` : ''}
            </button>
          )
        })}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this folder" style={{ marginLeft: 'auto', minWidth: 200, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            style={{ border: 0, borderRadius: 999, padding: '4px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: filter === f.key ? '#2E6FB5' : '#E2E8F0', color: filter === f.key ? '#fff' : '#334155' }}>
            {f.label}
          </button>
        ))}
      </div>

      {note && <div className="section-card" style={{ padding: '9px 12px', marginBottom: 10, fontSize: 13.5 }}>{note}</div>}

      <div className={`mail-grid${openId ? ' has-open' : ''}`}>
        <div className="mail-list section-card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? <p style={{ padding: 14, color: 'var(--mist)', margin: 0 }}>Loading…</p>
            : !shown.length ? <p style={{ padding: 14, color: 'var(--mist)', margin: 0 }}>{folder === 'spam' ? 'No spam. 🎉' : 'Nothing here.'}</p>
            : shown.map((m) => (
              <div key={m.id} className="mail-row" role="button" tabIndex={0} onClick={() => setOpenId(m.id)} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(m.id) }}
                style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: openId === m.id ? '#E8F0FA' : undefined, borderLeft: `3px solid ${m.is_read ? 'transparent' : '#2E6FB5'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: m.is_read ? 600 : 800, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sender(m)}</span>
                  {(m.attachments || []).length > 0 && <span title="Has attachments" aria-label="Has attachments">📎</span>}
                  <span style={{ fontSize: 12, color: 'var(--mist)', whiteSpace: 'nowrap' }}>{when(m.received_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                  <span style={{ fontWeight: m.is_read ? 400 : 700, fontSize: 13.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject || '(no subject)'}</span>
                  <Pill cat={m.category} />
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.ai_summary || m.snippet}</div>
              </div>
            ))}
        </div>

        <div className="mail-read section-card" style={{ padding: 14, minHeight: 420, display: 'flex', flexDirection: 'column' }}>
          {!openId ? <p style={{ color: 'var(--mist)', margin: 0 }}>Select a message to read it.</p>
            : !full ? <p style={{ color: 'var(--mist)', margin: 0 }}>Opening…</p>
            : (
              <>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  <button type="button" style={btn} className="mail-back" onClick={() => setOpenId(null)}>← Back</button>
                  {full.folder !== 'inbox' && <button type="button" style={btn} disabled={busy} onClick={() => (full.folder === 'spam' ? notSpam(full) : move(full, 'inbox'))}>{full.folder === 'spam' ? 'Not spam' : 'Move to Inbox'}</button>}
                  {full.folder === 'inbox' && <button type="button" style={btn} disabled={busy} onClick={() => move(full, 'archive', 'Archived.')}>Archive</button>}
                  {full.folder !== 'spam' && <button type="button" style={{ ...btn, color: '#B0342F' }} disabled={busy} onClick={() => markSpam(full, false)}>Spam — block sender</button>}
                  {full.folder !== 'spam' && full.from_email && <button type="button" style={{ ...btn, color: '#B0342F' }} disabled={busy} onClick={() => markSpam(full, true)}>Block @{full.from_email.split('@')[1]}</button>}
                  <button type="button" style={btn} onClick={() => markUnread(full)}>Mark unread</button>
                  <select value={full.category || ''} onChange={(e) => setCategory(full, e.target.value || null)} title="Category"
                    style={{ ...btn, fontWeight: 600, marginLeft: 'auto' }}>
                    <option value="">No category</option>
                    {Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                  </select>
                </div>

                <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>{full.subject || '(no subject)'}</h3>
                <div style={{ fontSize: 13.5, color: '#334155' }}>
                  <b>{full.from_name || full.from_email}</b>{full.from_name && full.from_email ? <span style={{ color: 'var(--mist)' }}> &lt;{full.from_email}&gt;</span> : null}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--mist)', marginTop: 2 }}>
                  {fullWhen(full.received_at)}{full.to_emails?.length ? ` · to ${full.to_emails.join(', ')}` : ''}{full.cc_emails?.length ? ` · cc ${full.cc_emails.join(', ')}` : ''}
                </div>
                {linked && (
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    {linked.kind}: {linked.to ? <Link to={linked.to} style={{ fontWeight: 700 }}>{linked.name}</Link> : <b>{linked.name}</b>}
                  </div>
                )}
                {full.folder === 'spam' && full.spam_reason && (
                  <div style={{ marginTop: 10, background: '#FDECEC', border: '1px solid #F3C2C0', color: '#8A2420', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
                    In Spam: {full.spam_reason}. If that's wrong, click <b>Not spam</b>.
                  </div>
                )}
                {full.ai_summary && (
                  <div style={{ marginTop: 10, background: '#EEF4FB', border: '1px solid #C9DAEE', borderRadius: 8, padding: '8px 10px', fontSize: 13.5, color: '#1F3A5F' }}>
                    <b>Summary:</b> {full.ai_summary}
                  </div>
                )}
                {(full.attachments || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {full.attachments.map((a, i) => (
                      <button key={i} type="button" onClick={() => openAttachment(a)} disabled={!a.path} title={a.skipped ? `Not saved (${a.skipped})` : 'Open'}
                        style={{ ...btn, fontWeight: 600, fontSize: 12.5 }}>📎 {a.name} {a.size ? <span style={{ color: 'var(--mist)' }}>({sizeText(a.size)})</span> : null}{a.skipped ? ' — not saved' : ''}</button>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Body msg={full} />
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  )
}
