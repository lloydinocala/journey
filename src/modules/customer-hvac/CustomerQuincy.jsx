import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const GREETING = {
  role: 'assistant',
  content: "Hi! I'm Quincy \u{1F44B}  Ask me anything about your heating & cooling \u2014 what a noise might be, why it's not cooling, your filters, your plan, whatever's on your mind.",
}

export default function CustomerQuincy() {
  const nav = useNavigate()
  const [messages, setMessages] = useState([GREETING])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  async function send(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setError('')
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next); setInput(''); setSending(true)
    const { data, error: fnErr } = await supabase.functions.invoke('quincy-portal', { body: { messages: next } })
    setSending(false)
    if (fnErr || data?.error) { setError(data?.error || fnErr?.message || 'Quincy is having trouble right now. Please try again.'); return }
    setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
  }

  return (
    <div className="cp-wrap cp-chat">
      <button className="cp-back" onClick={() => nav('/portal')}>‹ Home</button>
      <div className="cp-chat-head">
        <span className="cp-chat-badge">Q</span>
        <div>
          <div className="cp-chat-title">Ask Quincy</div>
          <div className="cp-chat-sub">Your AI helper for anything about your home’s air</div>
        </div>
      </div>

      <div className="cp-chat-scroll" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={'cp-bubble ' + (m.role === 'user' ? 'me' : 'bot')}>{m.content}</div>
        ))}
        {sending && <div className="cp-bubble bot cp-bubble-typing">Thinking…</div>}
        {error && <div className="cp-bubble err">{error}</div>}
      </div>

      <form className="cp-chat-input" onSubmit={send}>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Quincy…" disabled={sending} />
        <button type="submit" disabled={sending || !input.trim()}>Send</button>
      </form>

      <button className="cp-btn" style={{ marginTop: 10 }} onClick={() => nav('/portal/schedule')}>Book Service</button>
    </div>
  )
}
