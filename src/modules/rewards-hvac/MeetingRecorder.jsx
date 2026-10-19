// Rewards-HVAC · Record a discipline meeting — only with everyone's consent.
// Florida requires the consent of ALL parties to record a conversation (Fla. Stat. 934.03),
// so recording can't start until each person present is listed and has agreed, and the
// consent statement is read aloud at the start so it's on the recording too.
// The audio is stored privately; a live transcript is captured where the browser supports it
// (Chrome / Edge), and the AI can turn the transcript into a factual summary for the record.
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../utils/supabase'
import { signedHrUrl } from './hrData'

const CONSENT_SCRIPT = 'This meeting is being recorded and transcribed for the employee\'s personnel file. Does everyone here agree to being recorded? Please each say your name and "I agree."'
const SUMMARY_SYS = `You summarize an employee discipline meeting from its transcript for the personnel file. Write a short, neutral, factual summary: who attended, what conduct or issue was discussed, what the employee said in response, what expectations and next steps were agreed, and any follow-up date. Use ONLY what is in the transcript — never add facts, motives, or opinions, and never mention protected characteristics or health. Plain sentences, under 200 words.`
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function RecordingsList({ disciplineId, onRecord }) {
  const [rows, setRows] = useState([])
  async function load() { const { data } = await supabase.from('rewards_recordings').select('*').eq('discipline_id', disciplineId).order('created_at'); setRows(data || []) }
  useEffect(() => { load() }, [disciplineId])
  async function play(r) { const u = await signedHrUrl(r.storage_path); if (u) window.open(u, '_blank') }
  async function share(r) { await supabase.from('rewards_recordings').update({ employee_visible: !r.employee_visible }).eq('id', r.id); load() }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--mist)', textTransform: 'uppercase' }}>Meeting recordings</div>
        <button className="logout-button" onClick={onRecord}>🎙 Record a meeting…</button>
      </div>
      {rows.map((r) => (
        <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginTop: 6, fontSize: 13 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>{new Date(r.created_at).toLocaleString()}</b> · {fmtTime(r.duration_seconds || 0)} · consent: {(r.consent?.participants || []).map((p) => p.name).join(', ')}
            {r.storage_path && <button className="logout-button" onClick={() => play(r)}>▶ Listen</button>}
            <label style={{ cursor: 'pointer', marginLeft: 'auto' }}><input type="checkbox" checked={r.employee_visible} onChange={() => share(r)} /> In employee's file</label>
          </div>
          {r.summary && <div style={{ marginTop: 4 }}><b>Summary:</b> {r.summary}</div>}
          {r.transcript && <details><summary style={{ cursor: 'pointer', color: 'var(--mist)' }}>Transcript</summary><div style={{ whiteSpace: 'pre-wrap' }}>{r.transcript}</div></details>}
        </div>
      ))}
    </div>
  )
}

export default function MeetingRecorder({ orgId, employee, disciplineId, profile, onClose, onSaved }) {
  const [step, setStep] = useState('consent')       // consent | recording | review
  const [people, setPeople] = useState([{ name: employee?.full_name || '', role: 'Employee', consented: false }, { name: profile?.full_name || '', role: 'Supervisor / recorder', consented: false }])
  const [newName, setNewName] = useState('')
  const [secs, setSecs] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const rec = useRef(null), chunks = useRef([]), stream = useRef(null), timer = useRef(null), speech = useRef(null), blob = useRef(null), startedAt = useRef(null)
  const canTranscribe = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const allConsent = people.length >= 2 && people.every((p) => p.name.trim() && p.consented)

  useEffect(() => () => { try { rec.current?.state === 'recording' && rec.current.stop() } catch (e) { /* */ } stream.current?.getTracks().forEach((t) => t.stop()); clearInterval(timer.current); try { speech.current?.stop() } catch (e) { /* */ } }, [])

  async function start() {
    setErr('')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) { setErr('Microphone access was blocked. Allow the microphone for this site and try again.'); return }
    chunks.current = []
    const mr = new MediaRecorder(stream.current)
    mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
    mr.onstop = () => { blob.current = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }) }
    mr.start(1000); rec.current = mr
    startedAt.current = new Date().toISOString()
    setSecs(0); timer.current = setInterval(() => setSecs((s) => s + 1), 1000)
    if (canTranscribe) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      const sr = new SR(); sr.continuous = true; sr.interimResults = true; sr.lang = 'en-US'
      sr.onresult = (ev) => {
        let fin = '', tmp = ''
        for (let i = ev.resultIndex; i < ev.results.length; i++) { const t = ev.results[i][0].transcript; if (ev.results[i].isFinal) fin += t.trim() + '\n'; else tmp += t }
        if (fin) setTranscript((x) => x + fin); setInterim(tmp)
      }
      sr.onend = () => { if (rec.current?.state === 'recording') { try { sr.start() } catch (e) { /* */ } } }
      try { sr.start() } catch (e) { /* */ } speech.current = sr
    }
    setStep('recording')
  }
  function stop() {
    clearInterval(timer.current)
    try { speech.current?.stop() } catch (e) { /* */ }
    speech.current = null
    rec.current?.stop(); stream.current?.getTracks().forEach((t) => t.stop())
    setInterim(''); setStep('review')
  }
  async function summarize() {
    if (!transcript.trim()) return
    setBusy(true)
    const { data } = await supabase.functions.invoke('ai-assist', { body: { system: SUMMARY_SYS, prompt: 'Summarize this discipline meeting for the personnel file.', context: { attendees: people.map((p) => `${p.name} (${p.role})`), transcript } } })
    setBusy(false); if (data?.text) setSummary(data.text.trim())
  }
  async function save() {
    setBusy(true); setErr('')
    await new Promise((r) => setTimeout(r, 300))   // let the recorder flush its last chunk
    let path = null
    if (blob.current?.size) {
      path = `${orgId}/${employee?.id || 'org'}/recordings/${Date.now()}.webm`
      const { error } = await supabase.storage.from('hr-docs').upload(path, blob.current, { contentType: blob.current.type || 'audio/webm' })
      if (error) { setErr('Upload failed: ' + error.message); setBusy(false); return }
    }
    const { error } = await supabase.from('rewards_recordings').insert({
      org_id: orgId, employee_id: employee?.id || null, discipline_id: disciplineId || null, storage_path: path, mime: blob.current?.type || null,
      duration_seconds: secs, transcript: transcript.trim() || null, summary: summary.trim() || null,
      consent: { participants: people.map((p) => ({ name: p.name.trim(), role: p.role, consented: true })), statement: CONSENT_SCRIPT, recorded_by: profile?.id || null, started_at: startedAt.current, law: 'Florida all-party consent (Fla. Stat. 934.03)' },
    })
    setBusy(false); if (error) setErr(error.message); else onSaved()
  }

  return (
    <div className="modal-backdrop" onClick={step === 'recording' ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, width: '96vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>🎙 Record meeting — {employee?.full_name}</h3>

        {step === 'consent' && (
          <div>
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: 10, fontSize: 13, color: '#7C2D12' }}>
              Florida law requires <b>everyone present</b> to consent before a conversation is recorded. List every person in the room and confirm each one agrees. If anyone declines, don't record — take written notes instead.
            </div>
            <div style={{ marginTop: 10 }}>
              {people.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input value={p.name} onChange={(e) => setPeople(people.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))} placeholder="Name" style={{ flex: 2, padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--mist)' }}>{p.role}</span>
                  <label style={{ fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}><input type="checkbox" checked={p.consented} onChange={(e) => setPeople(people.map((x, n) => (n === i ? { ...x, consented: e.target.checked } : x)))} /> Consents</label>
                  {i > 1 && <button className="logout-button" onClick={() => setPeople(people.filter((_, n) => n !== i))}>×</button>}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add another person present (witness, HR…)" style={{ flex: 1, padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 8 }} />
                <button className="logout-button" onClick={() => { if (newName.trim()) { setPeople([...people, { name: newName.trim(), role: 'Present', consented: false }]); setNewName('') } }}>Add</button>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 13.5 }}><b>Read this aloud as soon as recording starts:</b><div style={{ background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginTop: 4, fontStyle: 'italic' }}>"{CONSENT_SCRIPT}"</div></div>
            <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 8 }}>{canTranscribe ? 'A live transcript will be captured as you talk (Chrome/Edge).' : 'This browser can record audio but not transcribe live — use Chrome or Edge for a transcript.'}</div>
            {err && <div className="auth-error" style={{ marginTop: 8 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="logout-button" onClick={onClose}>Cancel</button>
              <button className="auth-button" style={{ width: 'auto', margin: 0, background: '#B42318' }} disabled={!allConsent} onClick={start}>● Start recording</button>
            </div>
          </div>
        )}

        {step === 'recording' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 800, color: '#B42318' }}>● Recording {fmtTime(secs)}</div>
            <div style={{ fontSize: 13, margin: '6px 0', fontStyle: 'italic' }}>Start by reading: "{CONSENT_SCRIPT}"</div>
            {canTranscribe && <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 8, padding: 10, minHeight: 120, maxHeight: 280, overflowY: 'auto', background: '#fff' }}>{transcript}<span style={{ color: 'var(--mist)' }}>{interim}</span></div>}
            <div style={{ textAlign: 'right', marginTop: 12 }}><button className="auth-button" style={{ width: 'auto', margin: 0 }} onClick={stop}>■ Stop</button></div>
          </div>
        )}

        {step === 'review' && (
          <div>
            <div style={{ fontSize: 13.5 }}>Recorded {fmtTime(secs)}. Review the transcript — you can correct mistakes before saving.</div>
            <label style={{ fontSize: 12.5, display: 'block', marginTop: 8 }}>Transcript<textarea rows={8} value={transcript} onChange={(e) => setTranscript(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} /></label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <button className="logout-button" disabled={busy || !transcript.trim()} onClick={summarize}>✦ Summarize for the record</button>
              <span style={{ fontSize: 12, color: 'var(--mist)' }}>Facts from the transcript only.</span>
            </div>
            <label style={{ fontSize: 12.5, display: 'block', marginTop: 8 }}>Summary<textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} /></label>
            {err && <div className="auth-error" style={{ marginTop: 8 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="logout-button" onClick={() => { if (confirm('Discard this recording?')) onClose() }}>Discard</button>
              <button className="auth-button" style={{ width: 'auto', margin: 0 }} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save to the record'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
