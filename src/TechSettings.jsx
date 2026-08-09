import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { IconChevronLeft } from './MobileIcons'
import { TERMS } from './techTerms'
import { getOpenShift, getOpenBreak, clockOut, startLunch, endLunch } from './utils/shiftClock'

const LEAVE_REASONS = ['Sick', 'Injury', 'Doctor / appointment', 'Family emergency', 'Released by supervisor', 'Other']

export default function TechSettings({ profile }) {
  const navigate = useNavigate()
  const [consent, setConsent] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('jc-theme') === 'dark' } catch { return false } })

  const [shift, setShift] = useState(null)
  const [openBreak, setOpenBreak] = useState(null)
  const [clockBusy, setClockBusy] = useState(false)
  const [clockMsg, setClockMsg] = useState('')
  const [showLeave, setShowLeave] = useState(false)
  const [leaveReason, setLeaveReason] = useState('')
  const [leaveNote, setLeaveNote] = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    const { data: u } = await supabase.auth.getUser()
    const uid = u?.user?.id
    if (uid) {
      const { data } = await supabase.from('tech_app_consents').select('terms_version, accepted_at').eq('user_id', uid).order('accepted_at', { ascending: false }).limit(1)
      setConsent((data && data[0]) || null)
      await loadClock(uid)
    }
    setLoaded(true)
  }
  async function loadClock(uid) {
    const sh = await getOpenShift(uid)
    setShift(sh)
    setOpenBreak(sh ? await getOpenBreak(sh.id) : null)
  }
  async function refreshClock() {
    const { data: u } = await supabase.auth.getUser()
    if (u?.user?.id) await loadClock(u.user.id)
  }
  async function doLunch(start) {
    if (!shift) return
    setClockBusy(true); setClockMsg('')
    const { error } = start ? await startLunch(shift.id, shift.org_id) : await endLunch(openBreak?.id)
    setClockBusy(false)
    if (error) { setClockMsg(error.message); return }
    await refreshClock()
  }
  async function doClockOut() {
    if (!shift) return
    setClockBusy(true); setClockMsg('')
    const reason = showLeave && leaveReason ? leaveReason + (leaveNote.trim() ? `: ${leaveNote.trim()}` : '') : null
    const { error } = await clockOut(shift.id, { endKind: reason ? 'early_leave' : 'manual', endReason: reason })
    setClockBusy(false)
    if (error) { setClockMsg(error.message); return }
    setShowLeave(false); setLeaveReason(''); setLeaveNote('')
    await refreshClock()
    setClockMsg('You are clocked out.')
  }
  function toggleDark(v) { setDark(v); try { localStorage.setItem('jc-theme', v ? 'dark' : 'light') } catch { /* ignore */ } }

  return (
    <div className={`mobile-shell job-card-v2${dark ? ' jc-dark' : ''}`}>
      <div className="jc-header">
        <button className="jc-back" onClick={() => navigate('/tech')}><IconChevronLeft /></button>
        <div className="jc-header-text"><div className="jc-title">Mobile App Settings</div></div>
      </div>
      <div className="jc-body">
        <div className="jc-task">
          <div className="jc-task-head blue" style={{ cursor: 'default' }}><span className="jc-th-title">Appearance</span></div>
          <div className="jc-task-body">
            <label className="consent-agree" style={{ marginBottom: 0 }}>
              <input type="checkbox" checked={dark} onChange={(e) => toggleDark(e.target.checked)} />
              <span>Dark mode (job card)</span>
            </label>
          </div>
        </div>

        <div className="jc-task">
          <div className="jc-task-head blue" style={{ cursor: 'default' }}><span className="jc-th-title">Time Clock</span></div>
          <div className="jc-task-body">
            {!loaded ? (
              <p className="jc-muted-note">Loading…</p>
            ) : !shift ? (
              <p className="jc-muted-note">You're not clocked in right now. Your shift clock starts from the Job Cards screen.</p>
            ) : (
              <>
                <p className="jc-muted-note" style={{ marginTop: 0 }}>
                  {openBreak ? 'On lunch — paid time is paused.' : `Clocked in since ${new Date(shift.clock_in).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Your clock keeps running between jobs.`}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {openBreak ? (
                    <button className="jc-btn" disabled={clockBusy} onClick={() => doLunch(false)}>End Lunch</button>
                  ) : (
                    <button className="jc-btn ghost" disabled={clockBusy} onClick={() => doLunch(true)}>Start Lunch</button>
                  )}
                  {!showLeave && (
                    <button className="jc-btn red" disabled={clockBusy} onClick={() => setShowLeave(true)}>Clock Out</button>
                  )}
                </div>
                {showLeave && (
                  <div style={{ marginTop: 12 }}>
                    <p className="jc-muted-note" style={{ marginTop: 0 }}>Leaving before the end of your day? Pick a reason so the office knows (optional if you're just clocking out normally).</p>
                    <select value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} style={{ width: '100%', padding: 12, fontSize: 16, borderRadius: 10, border: '1px solid var(--jc-line)', marginBottom: 8 }}>
                      <option value="">No reason / normal clock-out</option>
                      {LEAVE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input value={leaveNote} onChange={(e) => setLeaveNote(e.target.value)} placeholder="Optional note" style={{ width: '100%', padding: 12, fontSize: 16, borderRadius: 10, border: '1px solid var(--jc-line)', marginBottom: 10, boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="jc-btn ghost" disabled={clockBusy} onClick={() => { setShowLeave(false); setLeaveReason(''); setLeaveNote('') }}>Cancel</button>
                      <button className="jc-btn red wide" disabled={clockBusy} onClick={doClockOut}>{clockBusy ? 'Saving…' : 'Confirm Clock Out'}</button>
                    </div>
                  </div>
                )}
                {clockMsg && <p className="jc-muted-note" style={{ marginTop: 8 }}>{clockMsg}</p>}
              </>
            )}
          </div>
        </div>

        <div className="jc-task">
          <div className="jc-task-head blue" style={{ cursor: 'default' }}><span className="jc-th-title">Terms &amp; Consent</span></div>
          <div className="jc-task-body">
            {!loaded ? (
              <p className="jc-muted-note">Loading…</p>
            ) : consent ? (
              <p className="jc-muted-note">Accepted on {new Date(consent.accepted_at).toLocaleString()} (version {consent.terms_version}). Also covered by your signed onboarding form.</p>
            ) : (
              <p className="jc-muted-note">No acceptance on record for your account yet.</p>
            )}
            <button className="jc-btn ghost wide" style={{ marginTop: 10 }} onClick={() => setShowTerms((v) => !v)}>{showTerms ? 'Hide Terms' : 'Review Terms'}</button>
            {showTerms && (
              <div style={{ marginTop: 12 }}>
                {TERMS.map((t, i) => (
                  <div key={i} className="consent-item">
                    <div className="consent-num">{i + 1}</div>
                    <div><div className="consent-item-title">{t.title}</div><div className="consent-item-body">{t.body}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
