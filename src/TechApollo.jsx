import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { IconChevronLeft, IconSparkles, IconPhone } from './MobileIcons'
import MobileNav from './MobileNav'

// Single support number for all orgs/licensees (Journey platform support).
// Edit this constant if the number changes — it's not org-specific.
const SUPPORT_PHONE_DISPLAY = '(352) 484-6341'
const SUPPORT_PHONE_TEL = '3524846341'

export default function TechApollo({ profile }) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi, I'm Apollo. Ask me anything about using Journey, or a general question — I'm here to help." },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [supportOpen, setSupportOpen] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  async function sendMessage(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setError('')
    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)

    const { data, error: fnError } = await supabase.functions.invoke('apollo-chat', {
      body: { messages: nextMessages },
    })

    setSending(false)

    if (fnError || data?.error) {
      setError(data?.error || fnError?.message || 'Apollo is having trouble responding right now.')
      return
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
  }

  return (
    <div className="mobile-shell">
      <div className="mobile-header job-detail-header">
        <button className="mobile-back" onClick={() => navigate(-1)}><IconChevronLeft /></button>
        <div className="job-detail-header-text">
          <div className="job-detail-title"><IconSparkles style={{ verticalAlign: 'middle', marginRight: 6 }} />Apollo</div>
          <div className="job-detail-sub">In-app help &amp; support</div>
        </div>
        <button className="gps-icon-btn" title="Contact Support" onClick={() => setSupportOpen(true)}>
          <IconPhone />
        </button>
      </div>

      <div className="apollo-scroll" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={'apollo-bubble ' + (m.role === 'user' ? 'apollo-bubble-user' : 'apollo-bubble-assistant')}>
            {m.content}
          </div>
        ))}
        {sending && <div className="apollo-bubble apollo-bubble-assistant apollo-typing">Thinking…</div>}
        {error && <div className="apollo-bubble apollo-bubble-error">{error}</div>}
      </div>

      <form className="apollo-input-row" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Apollo…"
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()}>Send</button>
      </form>

      <MobileNav profile={profile} />

      {supportOpen && (
        <>
          <div className="support-modal-backdrop" onClick={() => setSupportOpen(false)} />
          <div className="support-modal">
            <div className="support-modal-title">Contact Support</div>
            <p className="support-modal-text">
              There may be a wait to reach a Support Agent by phone. It may be faster to chat with Apollo first.
            </p>
            <p className="support-modal-question">Do you wish to continue this call to a live Support Agent?</p>
            <div className="support-modal-actions">
              <button className="action-btn" style={{ background: '#F0F1F3', color: 'var(--paper)' }} onClick={() => setSupportOpen(false)}>
                Return to Chat
              </button>
              <a
                className="action-btn primary"
                style={{ textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                href={`tel:${SUPPORT_PHONE_TEL}`}
                onClick={() => setSupportOpen(false)}
              >
                Place Call — {SUPPORT_PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
