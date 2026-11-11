import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// "Ask Anything …" bar pinned to the bottom of the field-app screens (tech My Jobs, and the
// supervisor screens). Typing or speaking sends the question to Quincy; the face / "?" opens Quincy.
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

export default function AskBar({ placeholder = 'Ask Anything …', onHelp }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)

  function ask(q) {
    const v = String(q || '').trim()
    navigate('/tech/apollo', v ? { state: { ask: v } } : undefined)
  }
  function mic() {
    if (!SR) { ask(text); return }
    if (listening) { recRef.current?.stop(); return }
    const rec = new SR()
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1
    rec.onresult = (e) => { const heard = e.results?.[0]?.[0]?.transcript || ''; setText(heard); if (heard) ask(heard) }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec; setListening(true); rec.start()
  }

  return (
    <form className="ask-bar" onSubmit={(e) => { e.preventDefault(); ask(text) }}>
      <div className="ask-bar-field">
        <button type="button" className={`ask-bar-mic${listening ? ' on' : ''}`} onClick={mic} aria-label="Speak your question">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V20H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-2.59A6 6 0 0 0 18 11.5Z" /></svg>
        </button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={listening ? 'Listening…' : placeholder} enterKeyHint="send" />
      </div>
      <button type="button" className="ask-bar-quincy" onClick={() => (onHelp ? onHelp() : ask(''))} aria-label="Open Quincy">
        <img src="/brand/quincy-face.png" alt="" />
        <span>?</span>
      </button>
    </form>
  )
}
