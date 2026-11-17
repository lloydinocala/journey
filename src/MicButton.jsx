import { useEffect, useRef, useState } from 'react'

// Talk-to-text for any message box. Tap the mic, speak, and the words are added to what's
// already typed (so you can dictate, fix a word by hand, and dictate more).
// Works in phone browsers and in the Journey Android app (src/native/speechPolyfill.js hands it
// to Android's own voice input). Hidden where the device has no speech-to-text.
export const canDictate = () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

export default function MicButton({ value, onChange, className, style, lang }) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  useEffect(() => () => { try { recRef.current?.abort() } catch { /* ignore */ } }, [])
  if (!canDictate()) return null

  function toggle() {
    if (listening) { try { recRef.current?.stop() } catch { /* ignore */ } setListening(false); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = lang || (navigator.language || 'en-US')
    rec.interimResults = true
    rec.continuous = false
    const base = value && !/\s$/.test(value) ? value + ' ' : (value || '')
    let finalTxt = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalTxt += t; else interim += t
      }
      let txt = (finalTxt + interim).replace(/\s+/g, ' ').trim()
      // Capitalize the start of a new message.
      if (!base.trim() && txt) txt = txt[0].toUpperCase() + txt.slice(1)
      onChange(base + txt)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    try { rec.start() } catch { setListening(false) }
  }

  return (
    <button type="button" className={className} onClick={toggle} aria-label={listening ? 'Stop talk-to-text' : 'Talk to text'} title={listening ? 'Stop' : 'Talk to text'}
      style={{ background: listening ? '#DC2626' : undefined, color: listening ? '#fff' : undefined, ...style }}>
      {listening ? '● Stop' : '🎤'}
    </button>
  )
}
