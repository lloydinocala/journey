import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGgAAABpCAYAAADWQGYEAAAjQ0lEQVR42u2deZRdV3Xmf/ucO7xXazYy/ysW645EIQVIQfeANi6nUXHly3LuA493KccwnW/B2muG+gjFCIUPiCnhUwzM8Td/HcFUPDJ0vKMRhe1tOtpD9q5fNEW4Kfyz7vUvRcNH+VsaCaSpHZsah3yCGGP5sF/wq1Zt6AJLbxvYj1CIuHcAhSg+Bf0Z/97PRi8fc/nb9gA5l7PpmmP5MHvwBRvyRA5HfEPczMRPWApP/RtL336f/eZ6j/3k8vt4eHhKQifmJ9150PTgyOxMPF/TdO8kcbx9TxV3LSw5mWOhp8718VcXi0sHi8VycfnY39ssKISeaQX76fN+LcBz/cK7+WUxYS6420vv1v+QTjZGMPe/2BlJTKeLrqG+liJx1SS/qWKaBh9zW0vuqIdQncPu9OyU/RB8esXn0dQmWAtzrTRR//QAN+K5WeGhxVN/9NCFOVJs3XA3FYDM8GW8NRy1+7eRXj3rain2zL/Wzcl31niWh4em4eGK//Dpvek7ymx93FV3dDi78OpM99aQ8/gEby1LGd1pmNZ3PH5hGNjcZNosfkDtzcDBzDGUwkZZqmGVm0h133znooGKM3a+MwGyIvUwKyeShZidWMMR3EI+XmVzRm4j9FfE3Z1e7FwZecBgeLGaDazb1Jd1TClJf1kVTcI2ZtxJpdMSn9ocTpETx5xF7cgd7rscUywbLuZd8/IuhQni88JX43ZZM0FZNwq6xAMBrho/lv83lI6IUx4hDTHpyYcfsLvTxqa4aUG/dx6M/PoWtzos8/SgHqKBpVCa8OHKLl5LRZW6eMILWz4EFPefzQIpmIj/vLMOQCtra/T6+tbCjJMPSqYJj1ag33RYFUukZERTQ5oSkefgM2MVCSRjHgBNzkctRSCntJeHMI1Oc/Waq5sMdRo+J9e7i7whet3Av7RxRf1/2e3tBO37AaquJJENHsc4uopKr1/N5qKz/abNNCTP0OEkmHpfotT0FcCCTyRZJR2FAPSuru5rvwkEt7q44MwXewCdvKg+CcxtfK/ALVRkySyMSuP4ojiAjgfYdPMP3qPRLfhMyJKI1Sq0IVLGZP8bvwFwjCB3OkJYGmGYlzD66YYkFakbJYXpDhgtTW1p6kmanY57Lrjy4xkcfem1rafzi3lk929e1nu2FfcNPf1e6JLv5wu6kxfZy7ZaIGffDvxcaqp0iaBqKfDBJWlOKqQRAKH5aoZa7DrkjdQLQgTdGXm8Cnss/Gab8l/lsobI3XnhOTJe8KnEglfTxgkcHh9fn0fcX92FyvXvZQftYNkWwqj9h+fBCIOj8x5JYH2oX6Sip8Ct8bRSoMj4v5RvnAiAYcaJoLq/gY38lOQT8ZUzbixDJRyWDPvkU7vJoaZLu1n6P2UzQit93FfY3moehhDJ3HVG8/C6VAkcGSUbG0QzULMUJfJq3PBtuuANAJjgDyhBkAIbRO7lihqWNTz0B23MIqqBmByrmvHafoByKnDXlNkCKwKkQ/BFpKUoCMHTodm3rZHVN8H5/c6GgFxLcDrWe0RhA97Hr48HDWK/ceExRI38J4OY0/89on4zcC/9tH8MAReFI7wKN6tvExwRDE0ahJp3vG7WMv8wAAAAAElFTkSuQmCC"

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
        <img className="cp-chat-logo" src={LOGO} alt="Quincy" />
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
