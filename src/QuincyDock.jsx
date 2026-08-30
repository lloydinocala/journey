// Journey · Mobile · QuincyDock — Quincy access during an active service call.
// A tech engaged in a job opens Quincy as a slide-over panel WITHOUT leaving the
// call: the underlying screen stays mounted (position: fixed overlay), so nothing
// in progress is lost. Reuses the same conversation (apollo_messages) and the
// apollo-chat function as the full Quincy screen, so history is continuous.
//
// `context` is accepted now (shown in the header) and is the hook for future
// job-aware diagnosis — pass { label, jobId, ... } and wire it into apollo-chat
// when that lands. Drop <QuincyDock profile={profile} context={...} /> anywhere
// inside a screen; it floats regardless of where it sits in the tree.
import { useEffect, useRef, useState } from 'react'
import { supabase } from './utils/supabase'
import QuincyBadge from './QuincyBadge'

const GREETING = { role: 'assistant', content: "Hi, I'm Quincy. Ask me anything while you're on the job — I'm here to help." }

export default function QuincyDock({ profile, context = null }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([GREETING])
  const [loaded, setLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [uid, setUid] = useState(null)
  const scrollRef = useRef(null)

  // Lazy-load history the first time it's opened, so it costs nothing until used.
  useEffect(() => { if (open && !loaded) loadHistory() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, open])

  async function loadHistory() {
    const { data: u } = await supabase.auth.getUser()
    const cu = u?.user?.id
    setUid(cu)
    if (cu) {
      const { data } = await supabase.from('apollo_messages')
        .select('role, content').eq('user_id', cu).order('created_at', { ascending: true }).limit(100)
      if (data && data.length) setMessages(data.map((m) => ({ role: m.role, content: m.content })))
    }
    setLoaded(true)
  }

  async function saveMessage(role, content) {
    if (!uid) return
    await supabase.from('apollo_messages').insert({ org_id: profile?.org_id ?? null, user_id: uid, role, content, topic: null })
  }

  async function send(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setError('')
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next); setInput(''); setSending(true)
    saveMessage('user', text)
    const { data, error: fnErr } = await supabase.functions.invoke('apollo-chat', { body: { messages: next } })
    setSending(false)
    if (fnErr || data?.error) { setError(data?.error || fnErr?.message || 'Quincy is having trouble responding right now.'); return }
    setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    saveMessage('assistant', data.reply)
  }

  const label = context?.label ? `Quincy · ${context.label}` : 'Quincy'

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Ask Quincy"
          style={{ position: 'fixed', right: 16, bottom: 24, zIndex: 900, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 999, border: 'none', background: '#0B2545', color: '#fff', boxShadow: '0 6px 20px rgba(11,37,69,0.35)', fontWeight: 700, fontSize: 15 }}>
          <QuincyBadge size={20} /> Ask Quincy
        </button>
      )}

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(11,37,69,0.38)', zIndex: 950 }} />
          <div role="dialog" aria-label="Quincy"
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 960, background: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, boxShadow: '0 -8px 30px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', height: '85vh', maxHeight: '85vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: '#0B2545', color: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
              <QuincyBadge size={22} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                <div style={{ fontSize: 12, color: '#9DB6D6' }}>Here to help while you work</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close Quincy"
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 26, lineHeight: 1, padding: '2px 6px' }}>×</button>
            </div>

            <div ref={scrollRef} className="apollo-scroll" style={{ flex: 1, overflowY: 'auto', padding: 14, background: '#EEF3F9' }}>
              {!loaded ? (
                <p style={{ color: 'var(--mist)', textAlign: 'center' }}>Loading…</p>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={'apollo-bubble ' + (m.role === 'user' ? 'apollo-bubble-user' : 'apollo-bubble-assistant')}>{m.content}</div>
                ))
              )}
              {sending && <div className="apollo-bubble apollo-bubble-assistant apollo-typing">Thinking…</div>}
              {error && <div className="apollo-bubble apollo-bubble-error">{error}</div>}
            </div>

            <form className="apollo-input-row" onSubmit={send} style={{ borderTop: '1px solid var(--line, #E2E8F0)' }}>
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Quincy…" disabled={sending || !loaded} />
              <button type="submit" disabled={sending || !loaded || !input.trim()}>Send</button>
            </form>
          </div>
        </>
      )}
    </>
  )
}
