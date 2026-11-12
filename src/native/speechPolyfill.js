// Voice typing inside the Android store app. The app's web view has no working speech-to-text,
// so on Android this stands in for the browser's SpeechRecognition and hands the job to
// Android's own voice input. Every mic button in Journey (Ask Anything, Quincy, job-card
// dictation) keeps working without changes. Browsers and the iPhone are left alone.
import { Capacitor, registerPlugin } from '@capacitor/core'

const JourneySpeech = registerPlugin('JourneySpeech')

class AndroidSpeechRecognition {
  constructor() {
    this.lang = 'en-US'
    this.continuous = false
    this.interimResults = false
    this.maxAlternatives = 1
    this.onresult = null; this.onerror = null; this.onend = null; this.onstart = null
    this._done = false
  }
  addEventListener(type, fn) { this['on' + type] = fn }
  removeEventListener(type) { this['on' + type] = null }
  start() {
    this._done = false
    try { this.onstart && this.onstart({}) } catch { /* ignore */ }
    JourneySpeech.listen({ lang: this.lang || 'en-US' }).then((r) => {
      if (this._done) return
      const text = String(r?.text || '').trim()
      if (text) {
        const alt = { transcript: text, confidence: 1 }
        const res = [alt]; res.isFinal = true
        const results = [res]
        try { this.onresult && this.onresult({ resultIndex: 0, results }) } catch { /* ignore */ }
      } else if (!r?.cancelled) {
        try { this.onerror && this.onerror({ error: 'no-speech' }) } catch { /* ignore */ }
      }
    }).catch((e) => {
      try { this.onerror && this.onerror({ error: 'not-allowed', message: e?.message }) } catch { /* ignore */ }
    }).finally(() => {
      if (this._done) return
      this._done = true
      try { this.onend && this.onend({}) } catch { /* ignore */ }
    })
  }
  stop() { /* Android's voice box finishes on its own when the person stops talking */ }
  abort() {
    if (this._done) return
    this._done = true
    try { this.onend && this.onend({}) } catch { /* ignore */ }
  }
}

try {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    window.SpeechRecognition = AndroidSpeechRecognition
    window.webkitSpeechRecognition = AndroidSpeechRecognition
  }
} catch { /* not in the app */ }
