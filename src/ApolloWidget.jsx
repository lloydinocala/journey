import { useEffect, useRef, useState } from 'react'
import { supabase } from './utils/supabase'
import { IconSparkles, IconPhone } from './MobileIcons'

const SUPPORT_PHONE_DISPLAY = '(352) 484-6341'

const GREETING = { role: 'assistant', content: "Hi, I'm Apollo. Ask me anything about using Journey, or a general question — I'm here to help." }

export default function ApolloWidget({ profile }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([GREETING])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [supportOpen, setSupportOpen] = useState(false)
  const [uid, setUid] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (open && !historyLoaded) loadHistory()
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, open])

  async function loadHistory() {
    setLoadingHistory(true)
    const { data: userData } = await supabase.auth.getUser()
    const currentUid = userData?.user?.id
    setUid(currentUid)
    if (!currentUid) {
      setLoadingHistory(false)
      return
    }
    const { data } = await supabase
      .from('apollo_messages')
      .select('role, content')
      .eq('user_id', currentUid)
      .order('created_at', { ascending: true })
      .limit(100)
    if (data && data.length > 0) {
      setMessages(data.map((m) => ({ role: m.role, content: m.content })))
    }
    setHistoryLoaded(true)
    setLoadingHistory(false)
  }

  async function saveMessage(role, content, topic) {
    if (!uid) return null
    const { data } = await supabase
      .from('apollo_messages')
      .insert({ org_id: profile?.org_id ?? null, user_id: uid, role, content, topic: topic || null })
      .select('id')
      .single()
    return data?.id || null
  }

  async function sendMessage(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setError('')
    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    const userMessageId = await saveMessage('user', text)

    const { data, error: fnError } = await supabase.functions.invoke('apollo-chat', {
      body: { messages: nextMessages },
    })

    setSending(false)

    if (fnError || data?.error) {
      setError(data?.error || fnError?.message || 'Apollo is having trouble responding right now.')
      return
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    saveMessage('assistant', data.reply)
    if (userMessageId && data.topic) {
      await supabase.from('apollo_messages').update({ topic: data.topic }).eq('id', userMessageId)
    }
  }

  return (
    <>
      <button className="apollo-widget-fab" onClick={() => setOpen((v) => !v)} title="Apollo">
        <IconSparkles />
      </button>

      {open && (
        <div className="apollo-widget-panel">
          <div className="apollo-widget-header">
            <span><IconSparkles style={{ verticalAlign: 'middle', marginRight: 6 }} />Apollo</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="apollo-widget-icon-btn" title="Contact Support" onClick={() => setSupportOpen(true)}>
                <IconPhone />
              </button>
              <button className="apollo-widget-icon-btn" title="Close" onClick={() => setOpen(false)}>×</button>
            </div>
          </div>

          <div className="apollo-widget-scroll" ref={scrollRef}>
            {loadingHistory ? (
              <p style={{ color: 'var(--mist)', textAlign: 'center', fontSize: 13 }}>Loading conversation…</p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={'apollo-bubble ' + (m.role === 'user' ? 'apollo-bubble-user' : 'apollo-bubble-assistant')}>
                  {m.content}
                </div>
              ))
            )}
            {sending && <div className="apollo-bubble apollo-bubble-assistant apollo-typing">Thinking…</div>}
            {error && <div className="apollo-bubble apollo-bubble-error">{error}</div>}
          </div>

          <form className="apollo-widget-input-row" onSubmit={sendMessage}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Apollo…"
              disabled={sending || loadingHistory}
            />
            <button type="submit" disabled={sending || loadingHistory || !input.trim()}>Send</button>
          </form>
        </div>
      )}

      {supportOpen && (
        <>
          <div className="support-modal-backdrop" onClick={() => setSupportOpen(false)} />
          <div className="support-modal" style={{ left: 'auto', right: 24, bottom: 24, width: 320 }}>
            <div className="support-modal-title">Contact Support</div>
            <p className="support-modal-text">
              There may be a wait to reach a Support Agent by phone. It may be faster to chat with Apollo first.
            </p>
            <p className="support-modal-question">Call Support directly:</p>
            <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 800, color: 'var(--route-blue)', marginBottom: 14, letterSpacing: 0.3 }}>
              {SUPPORT_PHONE_DISPLAY}
            </div>
            <div className="support-modal-actions">
              <button className="action-btn" style={{ background: '#F0F1F3', color: 'var(--paper)' }} onClick={() => setSupportOpen(false)}>
                Return to Chat
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
