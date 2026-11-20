// Voice typing inside the store apps. The apps' web views have no working speech-to-text, so
// this stands in for the browser's SpeechRecognition: on Android it hands the job to Android's
// own voice input (JourneySpeech), on iPhone to Apple's speech recognizer
// (@capgo/capacitor-speech-recognition). Every mic button in Journey (Ask Anything, Quincy,
// job-card dictation) keeps working without changes. Browsers are left alone.
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

// iPhone: Apple's recognizer keeps listening through pauses, so the session ends when the mic
// button calls stop() or after a short silence once something has been said.
const SILENCE_MS = 1800
class IOSSpeechRecognition {
  constructor() {
    this.lang = 'en-US'
    this.continuous = false
    this.interimResults = false
    this.maxAlternatives = 1
    this.onresult = null; this.onerror = null; this.onend = null; this.onstart = null
    this._done = true; this._text = ''; this._subs = []; this._timer = null; this._SR = null
  }
  addEventListener(type, fn) { this['on' + type] = fn }
  removeEventListener(type) { this['on' + type] = null }
  _emit(text, isFinal) {
    const alt = { transcript: text, confidence: 1 }
    const res = [alt]; res.isFinal = isFinal
    try { this.onresult && this.onresult({ resultIndex: 0, results: [res] }) } catch { /* ignore */ }
  }
  _finish(err) {
    if (this._done) return
    this._done = true
    clearTimeout(this._timer)
    this._subs.forEach((h) => { try { h.remove() } catch { /* ignore */ } })
    this._subs = []
    if (err) { try { this.onerror && this.onerror({ error: err }) } catch { /* ignore */ } }
    else if (this._text) this._emit(this._text, true)
    else { try { this.onerror && this.onerror({ error: 'no-speech' }) } catch { /* ignore */ } }
    try { this.onend && this.onend({}) } catch { /* ignore */ }
  }
  start() {
    this._done = false; this._text = ''
    ;(async () => {
      try {
        const { SpeechRecognition: SR } = await import('@capgo/capacitor-speech-recognition')
        this._SR = SR
        const perm = await SR.requestPermissions()
        if (perm?.speechRecognition !== 'granted') { this._finish('not-allowed'); return }
        this._subs.push(await SR.addListener('partialResults', (e) => {
          const t = String(e?.accumulatedText ?? ((e?.accumulated || '') + (e?.matches?.[0] || ''))).trim()
          if (!t || this._done) return
          this._text = t
          if (this.interimResults) this._emit(t, false)
          clearTimeout(this._timer)
          this._timer = setTimeout(() => this.stop(), SILENCE_MS)
        }))
        this._subs.push(await SR.addListener('listeningState', (e) => {
          if ((e?.state || e?.status) === 'stopped') this._finish()
        }))
        try { this.onstart && this.onstart({}) } catch { /* ignore */ }
        await SR.start({ language: this.lang || 'en-US', partialResults: true, popup: false })
      } catch { this._finish('not-allowed') }
    })()
  }
  stop() {
    if (this._done) return
    const SR = this._SR
    if (!SR) { this._finish(); return }
    SR.stop().catch(() => {}).finally(() => setTimeout(() => this._finish(), 600))
  }
  abort() {
    if (this._done) return
    this._text = ''
    try { this._SR?.stop() } catch { /* ignore */ }
    this._done = true
    clearTimeout(this._timer)
    this._subs.forEach((h) => { try { h.remove() } catch { /* ignore */ } })
    this._subs = []
    try { this.onend && this.onend({}) } catch { /* ignore */ }
  }
}

try {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    window.SpeechRecognition = AndroidSpeechRecognition
    window.webkitSpeechRecognition = AndroidSpeechRecognition
  } else if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
    window.SpeechRecognition = IOSSpeechRecognition
    window.webkitSpeechRecognition = IOSSpeechRecognition
  }
} catch { /* not in the app */ }
