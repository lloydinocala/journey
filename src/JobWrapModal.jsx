import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'
import { formatTimeInZone } from './utils/tz'
import { getOpenShift, clockOut, startLunch } from './utils/shiftClock'

// Shown right after a job is closed (Stop My Time -> Complete or Incomplete).
// Routes the tech to the right next action so the SHIFT clock never gets
// forgotten and never gets closed mid-day by accident:
//   - last job of the day        -> CLOCK OUT (primary)
//   - another job soon            -> GET NEXT JOB
//   - a real gap before the next  -> STANDBY (stay clocked in) + Start Lunch
// A logged "leave early" path (sick / emergency) is always available when the
// day isn't over. The shift stays open (paid) through every gap — only Clock Out
// or a lunch break stops paid time.

const GAP_MIN = 45 // minutes; beyond this, the next job is a "gap" -> Standby
const LEAVE_REASONS = ['Sick', 'Injury', 'Doctor / appointment', 'Family emergency', 'Released by supervisor', 'Other']

function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

function parseStart(st, today) {
  if (!st) return null
  const s = String(st)
  const d = new Date(s.length > 10 ? s : `${today}T${s}`)
  return isNaN(d.getTime()) ? null : d
}

export default function JobWrapModal({ uid, orgId, jobId, finalStatus, navigate, onClose }) {
  const [loading, setLoading] = useState(true)
  const [shift, setShift] = useState(null)
  const [next, setNext] = useState(null)
  const [remaining, setRemaining] = useState(0)
  const [gapMin, setGapMin] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveReason, setLeaveReason] = useState('')
  const [leaveNote, setLeaveNote] = useState('')

  const today = todayISO()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const sh = await getOpenShift(uid)
      const { data: assigned } = await supabase
        .from('job_technicians').select('job_id').eq('org_id', orgId).eq('user_id', uid)
      const ids = [...new Set((assigned || []).map((r) => r.job_id))].filter((id) => id !== jobId)
      let rows = []
      if (ids.length) {
        const { data } = await supabase
          .from('jobs')
          .select('id, job_number, segment, start_time, job_type, status, customers ( display_name ), properties ( street_address, city )')
          .eq('org_id', orgId).eq('job_date', today).in('id', ids)
          .in('status', ['scheduled', 'on_my_way', 'in_progress'])
          .is('deleted_at', null)
          .order('start_time', { ascending: true })
        rows = data || []
      }
      if (cancelled) return
      const nx = rows[0] || null
      setShift(sh); setRemaining(rows.length); setNext(nx)
      if (nx) {
        const d = parseStart(nx.start_time, today)
        setGapMin(d ? Math.round((d.getTime() - Date.now()) / 60000) : null)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [uid, orgId, jobId])

  const mode = remaining === 0 ? 'last' : (gapMin == null || gapMin <= GAP_MIN ? 'next' : 'standby')
  const nextName = next?.customers?.display_name || (next ? `${next.job_number}${next.segment > 1 ? `-${next.segment}` : ''}` : '')
  const nextTime = next?.start_time ? formatTimeInZone(next.start_time) : ''
  const nextAddr = next?.properties?.street_address ? `${next.properties.street_address}${next.properties.city ? ', ' + next.properties.city : ''}` : ''
  const gapLabel = gapMin != null && gapMin > 0
    ? (gapMin >= 60 ? `${Math.floor(gapMin / 60)} hr ${gapMin % 60} min` : `${gapMin} min`)
    : ''

  async function doClockOut(endKind, endReason) {
    if (!shift) { navigate('/tech'); return }
    setBusy(true); setErr('')
    const { error } = await clockOut(shift.id, { endKind, endReason })
    setBusy(false)
    if (error) { setErr(error.message); return }
    navigate('/tech')
  }
  async function doStartLunch() {
    if (!shift) { navigate('/tech'); return }
    setBusy(true); setErr('')
    const { error } = await startLunch(shift.id, orgId)
    setBusy(false)
    if (error) { setErr(error.message); return }
    navigate('/tech')
  }
  function goStandby() {
    try {
      const note = `On standby${nextName ? ` — next: ${nextName}` : ''}${nextTime ? ` at ${nextTime}` : ''}. You're still clocked in.`
      localStorage.setItem('tech_standby_note', note)
    } catch { /* ignore */ }
    navigate('/tech')
  }
  function goNext() { if (next) navigate(`/tech/${next.id}`); else navigate('/tech') }
  async function submitLeave() {
    const reason = leaveReason + (leaveNote.trim() ? `: ${leaveNote.trim()}` : '')
    await doClockOut('early_leave', reason)
  }

  const sheet = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1600,
  }
  const card = {
    background: '#fff', width: '100%', maxWidth: 520,
    borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32,
  }

  return (
    <div style={sheet} onClick={() => !busy && onClose && onClose()}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <p className="jc-muted-note" style={{ margin: '6px 0' }}>One moment…</p>
        ) : (
          <>
            <h3 style={{ margin: '0 0 4px', fontSize: 19 }}>
              {finalStatus === 'incomplete' ? 'Job saved as Incomplete' : 'Job complete'}
            </h3>

            {mode === 'last' && (
              <>
                <p className="jc-muted-note" style={{ marginBottom: 16 }}>
                  That was your <strong>last job today</strong>. You're still on the clock — clock out to end your paid day.
                </p>
                <button className="jc-btn green wide" disabled={busy} onClick={() => doClockOut('last_job', null)}>
                  {busy ? 'Clocking out…' : 'Clock Out'}
                </button>
                <button className="jc-btn ghost wide" style={{ marginTop: 10 }} disabled={busy} onClick={() => navigate('/tech')}>
                  Not done yet — stay clocked in
                </button>
              </>
            )}

            {mode === 'next' && (
              <>
                <p className="jc-muted-note" style={{ marginBottom: 14 }}>
                  Next up{nextTime ? ` at ${nextTime}` : ''}: <strong>{nextName}</strong>{nextAddr ? ` · ${nextAddr}` : ''}
                </p>
                <button className="jc-btn wide" disabled={busy} onClick={goNext}>Get Next Job</button>
                {shift && (
                  <button className="jc-btn ghost wide" style={{ marginTop: 10 }} disabled={busy} onClick={doStartLunch}>Start Lunch</button>
                )}
              </>
            )}

            {mode === 'standby' && (
              <>
                <p className="jc-muted-note" style={{ marginBottom: 14 }}>
                  Next job{nextName ? `, ${nextName},` : ''} isn't until <strong>{nextTime || 'later'}</strong>{gapLabel ? ` — about ${gapLabel} from now` : ''}.
                  You'll <strong>stay clocked in</strong> on standby.
                </p>
                <button className="jc-btn wide" disabled={busy} onClick={goStandby}>Go on Standby</button>
                {shift && (
                  <button className="jc-btn ghost wide" style={{ marginTop: 10 }} disabled={busy} onClick={doStartLunch}>Start Lunch</button>
                )}
                <button className="jc-btn-sm" style={{ display: 'block', margin: '12px auto 0' }} disabled={busy} onClick={goNext}>Head to the next job now</button>
              </>
            )}

            {mode !== 'last' && shift && (
              <div style={{ marginTop: 18, borderTop: '1px solid var(--jc-line)', paddingTop: 12 }}>
                {!leaveOpen ? (
                  <button className="jc-btn-sm" style={{ color: 'var(--jc-red)' }} disabled={busy} onClick={() => setLeaveOpen(true)}>
                    I need to leave (sick / emergency)
                  </button>
                ) : (
                  <>
                    <p className="jc-muted-note" style={{ margin: '0 0 8px' }}>This clocks you out for the day and lets the office know why.</p>
                    <select value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)}
                      style={{ width: '100%', padding: 12, fontSize: 16, borderRadius: 10, border: '1px solid var(--jc-line)', marginBottom: 8 }}>
                      <option value="">Select a reason…</option>
                      {LEAVE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input value={leaveNote} onChange={(e) => setLeaveNote(e.target.value)} placeholder="Optional note"
                      style={{ width: '100%', padding: 12, fontSize: 16, borderRadius: 10, border: '1px solid var(--jc-line)', marginBottom: 10, boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="jc-btn ghost" disabled={busy} onClick={() => setLeaveOpen(false)}>Cancel</button>
                      <button className="jc-btn red wide" disabled={busy || !leaveReason} onClick={submitLeave}>
                        {busy ? 'Saving…' : 'Clock Out & Notify'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {!shift && (
              <p className="jc-muted-note" style={{ marginTop: 12 }}>You're not clocked in, so there's nothing to clock out of.</p>
            )}
            {err && <p style={{ color: 'var(--jc-red)', fontSize: 13, marginTop: 10 }}>{err}</p>}
          </>
        )}
      </div>
    </div>
  )
}
