import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'


const GREETING = {
  role: 'assistant',
  content: "Hi! I'm Quincy \u{1F44B}  Ask me anything about your heating & cooling \u2014 what a noise might be, why it's not cooling, your filters, your plan, whatever's on your mind.",
}

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

export default function CustomerQuincy() {
  const nav = useNavigate()
  const [messages, setMessages] = useState([GREETING])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [listening, setListening] = useState(false)
  const scrollRef = useRef(null)
  const recRef = useRef(null)
  const baseRef = useRef('')

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => () => { try { recRef.current?.stop() } catch { /* noop */ } }, [])

  function toggleMic() {
    if (!SR) return
    if (listening) { try { recRef.current?.stop() } catch { /* noop */ } setListening(false); return }
    const rec = new SR()
    recRef.current = rec
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false
    baseRef.current = input ? input.trim() + ' ' : ''
    rec.onresult = (e) => {
      let txt = ''
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript
      setInput(baseRef.current + txt)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    try { rec.start(); setListening(true) } catch { setListening(false) }
  }

  async function send(e) {
    e?.preventDefault()
    if (listening) { try { recRef.current?.stop() } catch { /* noop */ } setListening(false) }
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
        <img className="cp-chat-logo" src="/quincy-logo.png" alt="Quincy" />
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
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? 'Listening…' : 'Ask Quincy…'} disabled={sending} />
        {SR && (
          <button type="button" className={'cp-mic' + (listening ? ' on' : '')} onClick={toggleMic} aria-label="Talk to type" title="Talk to type">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0012 0M12 17v4M9 21h6" />
            </svg>
          </button>
        )}
        <button type="submit" disabled={sending || !input.trim()}>Send</button>
      </form>

      <button className="cp-btn" style={{ marginTop: 10 }} onClick={() => nav('/portal/schedule')}>Book Service</button>
    </div>
  )
}
