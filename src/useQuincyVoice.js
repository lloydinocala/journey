// useQuincyVoice — hands-light voice for the Quincy chat.
// Speech-to-text for input (Web Speech API) and text-to-speech to read replies aloud.
// Degrades gracefully: on a browser without support, `supported`/`canSpeak` are false
// and the caller simply hides the mic / speaker buttons. Nothing here is required for
// the chat to work by typing.
import { useState, useRef, useCallback, useEffect } from 'react'

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

export default function useQuincyVoice(onHeard) {
  const [listening, setListening] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false) // read replies aloud
  const recRef = useRef(null)
  const heardRef = useRef(onHeard)
  heardRef.current = onHeard

  const supported = !!SR
  const canSpeak = !!synth

  const stopListening = useCallback(() => {
    try { recRef.current?.stop() } catch (_) { /* ignore */ }
    setListening(false)
  }, [])

  const startListening = useCallback(() => {
    if (!SR) return
    try { synth?.cancel() } catch (_) { /* ignore */ }
    try {
      const rec = new SR()
      rec.lang = 'en-US'
      rec.interimResults = false
      rec.maxAlternatives = 1
      rec.continuous = false
      rec.onresult = (e) => {
        let text = ''
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0]?.transcript || ''
        text = text.trim()
        if (text) heardRef.current?.(text)
      }
      rec.onerror = () => setListening(false)
      rec.onend = () => setListening(false)
      recRef.current = rec
      setVoiceOn(true) // if they're talking to Quincy, read the answer back
      setListening(true)
      rec.start()
    } catch (_) { setListening(false) }
  }, [])

  const speak = useCallback((text) => {
    if (!synth || !text) return
    try {
      synth.cancel()
      const u = new SpeechSynthesisUtterance(String(text))
      u.lang = 'en-US'
      u.rate = 1.02
      synth.speak(u)
    } catch (_) { /* ignore */ }
  }, [])

  const stopSpeaking = useCallback(() => { try { synth?.cancel() } catch (_) { /* ignore */ } }, [])

  useEffect(() => () => {
    try { recRef.current?.stop() } catch (_) { /* ignore */ }
    try { synth?.cancel() } catch (_) { /* ignore */ }
  }, [])

  return { supported, canSpeak, listening, startListening, stopListening, voiceOn, setVoiceOn, speak, stopSpeaking }
}
